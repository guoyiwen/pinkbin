import { api } from './api';
import { buildCleanerReadModel, type CleanerReadModel } from './cleanerReadModel';
import type { Node, Scaffold } from './types';

export interface CleanerScanAdapter {
  scan(path: string): Promise<Node>;
  listScaffolds(): Promise<Scaffold[]>;
}

/** Production adapter: the Tauri branch of api.scan performs the local scan. */
export const apiCleanerScanAdapter: CleanerScanAdapter = {
  scan: (path) => api.scan(path),
  listScaffolds: () => api.listScaffolds(),
};

export type CleanerWorkflowStatus = 'idle' | 'scanning' | 'ready' | 'empty' | 'error';

export interface CleanerWorkflowSnapshot {
  status: CleanerWorkflowStatus;
  scanPath: string;
  model: CleanerReadModel | null;
  selectedIds: ReadonlySet<string>;
  error: string | null;
  scanAttempt: number;
}

const WINDOWS_SEGMENT = '[^\\/:*?"<>|]+';
const WINDOWS_PATH = new RegExp(`^[A-Za-z]:\\\\(?:${WINDOWS_SEGMENT}(?:\\\\${WINDOWS_SEGMENT})*)?$`);
const UNC_PATH = new RegExp(`^\\\\\\\\${WINDOWS_SEGMENT}\\\\${WINDOWS_SEGMENT}(?:\\\\${WINDOWS_SEGMENT})*$`);

export function normalizeWindowsScanRoot(value: string): string {
  const normalized = value.trim().replace(/\//g, '\\').replace(/^([a-z]):/i, (_, drive: string) => `${drive.toUpperCase()}:`);
  if (!normalized) return '';
  if (/^[A-Za-z]:\\*$/.test(normalized)) return `${normalized.slice(0, 2)}\\`;
  return normalized.replace(/\\+$/, '');
}

export function isWindowsScanRoot(value: string): boolean {
  const normalized = normalizeWindowsScanRoot(value);
  return WINDOWS_PATH.test(normalized) || UNC_PATH.test(normalized);
}

export function displayWindowsScanRoot(path: string): string {
  const drive = path.match(/^([A-Za-z]):[\\/]?$/);
  return drive ? `Windows (${drive[1].toUpperCase()}:)` : path;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const text = String(error);
  return text.startsWith('Error: ') ? text.slice('Error: '.length) : text;
}

function emptySelection(): ReadonlySet<string> {
  return new Set<string>();
}

export class CleanerWorkflow {
  private readonly adapter: CleanerScanAdapter;
  private readonly nextScanId: () => number;
  private activeRequest = 0;
  private state: CleanerWorkflowSnapshot = {
    status: 'idle',
    scanPath: '',
    model: null,
    selectedIds: emptySelection(),
    error: null,
    scanAttempt: 0,
  };

  constructor(adapter: CleanerScanAdapter = apiCleanerScanAdapter, nextScanId: () => number = () => Date.now()) {
    this.adapter = adapter;
    this.nextScanId = nextScanId;
  }

  get snapshot(): CleanerWorkflowSnapshot {
    return {
      ...this.state,
      selectedIds: new Set(this.state.selectedIds),
    };
  }

  async scan(
    requestedRoot: string,
    onState?: (snapshot: CleanerWorkflowSnapshot) => void,
  ): Promise<CleanerWorkflowSnapshot> {
    const scanPath = normalizeWindowsScanRoot(requestedRoot);
    const requestId = ++this.activeRequest;
    const scanAttempt = this.state.scanAttempt + 1;

    if (!isWindowsScanRoot(scanPath)) {
      this.state = {
        status: 'error',
        scanPath,
        model: null,
        selectedIds: emptySelection(),
        error: '扫描范围必须是 Windows 盘符或目录，例如 C:\\ 或 D:\\Projects。',
        scanAttempt,
      };
      onState?.(this.snapshot);
      return this.snapshot;
    }

    // Clearing the model and selection before I/O prevents a failed or stale
    // request from displaying the previous scan as if it were current.
    this.state = {
      status: 'scanning',
      scanPath,
      model: null,
      selectedIds: emptySelection(),
      error: null,
      scanAttempt,
    };
    onState?.(this.snapshot);

    try {
      const [root, scaffolds] = await Promise.all([
        this.adapter.scan(scanPath),
        this.adapter.listScaffolds(),
      ]);
      if (requestId !== this.activeRequest) return this.snapshot;

      const model = buildCleanerReadModel(root, scaffolds, this.nextScanId());
      const selectedIds = new Set(
        model.items.filter((item) => item.defaultSelected && item.canSelect).map((item) => item.id),
      );
      this.state = {
        status: model.items.length ? 'ready' : 'empty',
        scanPath,
        model,
        selectedIds,
        error: null,
        scanAttempt,
      };
      onState?.(this.snapshot);
    } catch (error) {
      if (requestId !== this.activeRequest) return this.snapshot;
      this.state = {
        status: 'error',
        scanPath,
        model: null,
        selectedIds: emptySelection(),
        error: errorMessage(error),
        scanAttempt,
      };
      onState?.(this.snapshot);
    }

    return this.snapshot;
  }

  toggleSelection(itemId: string): CleanerWorkflowSnapshot {
    if (!this.state.model || (this.state.status !== 'ready' && this.state.status !== 'empty')) return this.snapshot;
    const item = this.state.model.items.find((candidate) => candidate.id === itemId);
    if (!item || !item.canSelect) return this.snapshot;

    const selectedIds = new Set(this.state.selectedIds);
    if (selectedIds.has(itemId)) selectedIds.delete(itemId);
    else selectedIds.add(itemId);
    this.state = { ...this.state, selectedIds };
    return this.snapshot;
  }
}
