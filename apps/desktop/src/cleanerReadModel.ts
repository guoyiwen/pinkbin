import { buildLocalCandidates, buildScanContext } from './scanContext';
import type {
  CleanupCandidate,
  CleanupCandidateBoundary,
  CleanupScopeStatus,
  Node,
  Risk,
  ScanContext,
  ScanEntry,
  Scaffold,
} from './types';

export type CleanerIconKey = 'browser' | 'dev' | 'chat' | 'game' | 'container' | 'media' | 'system' | 'unknown';
export type CleanerItemState = 'ready' | 'review' | 'view-only';
export type CleanerEvidenceSource = 'scanned' | 'scaffold';
export type CleanerSelection = 'default' | 'manual' | 'view-only';
export type CleanerItemBoundary = CleanupCandidateBoundary;
export type CleanerItemScopeStatus = CleanupScopeStatus;

export interface CleanerReadItem {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  groupLabel: string;
  risk: Risk;
  label: string;
  size: number;
  files: string;
  iconKey: CleanerIconKey;
  tone: string;
  description: string;
  consequence: string;
  paths: string[];
  defaultSelected: boolean;
  state: CleanerItemState;
  selection: CleanerSelection;
  selectionLabel: string;
  selectionReason: string;
  canSelect: boolean;
  boundary: CleanerItemBoundary;
  boundaryLabel: string;
  scopeStatus: CleanerItemScopeStatus;
  evidence: string[];
  audited: boolean;
  planEligible: boolean;
  source: CleanerEvidenceSource;
}

export interface CleanerReadModel {
  scanId: number;
  rootPath: string;
  scannedBytes: number;
  scannedFiles: number;
  displayedDirectorySample: ScanEntry[];
  estimatedReclaimableBytes: number;
  estimatedReclaimableFiles: number;
  coverage: ScanContext['coverage'];
  /** Backwards-compatible aliases for callers that only need the exact root totals. */
  totalBytes: number;
  totalFiles: number;
  items: CleanerReadItem[];
}

type CleanerMeta = {
  title?: string;
  iconKey: CleanerIconKey;
  tone: string;
  group: string;
  groupLabel: string;
};

const SCAFFOLD_META: Record<string, CleanerMeta> = {
  edge: { title: '浏览器缓存', iconKey: 'browser', tone: 'pink', group: 'system', groupLabel: '系统与应用' },
  chrome: { title: '浏览器缓存', iconKey: 'browser', tone: 'pink', group: 'system', groupLabel: '系统与应用' },
  brave: { title: '浏览器缓存', iconKey: 'browser', tone: 'pink', group: 'system', groupLabel: '系统与应用' },
  firefox: { title: '浏览器缓存', iconKey: 'browser', tone: 'pink', group: 'system', groupLabel: '系统与应用' },
  npm: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  pnpm: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  pip: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  cargo: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  conda: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  'go-mod': { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  gradle: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  maven: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  nuget: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  jetbrains: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  vscode: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  cursor: { title: '开发环境缓存', iconKey: 'dev', tone: 'violet', group: 'dev', groupLabel: '开发环境' },
  'wechat-pc': { title: '微信媒体缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  'qq-pc': { title: '聊天媒体缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  dingtalk: { title: '聊天媒体缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  feishu: { title: '聊天媒体缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  slack: { title: '应用缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  discord: { title: '应用缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  telegram: { title: '聊天媒体缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  teams: { title: '应用缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  spotify: { title: '应用缓存', iconKey: 'chat', tone: 'mint', group: 'app', groupLabel: '应用数据' },
  steam: { title: 'Steam 缓存', iconKey: 'game', tone: 'orange', group: 'game', groupLabel: '游戏' },
  epicgames: { title: '游戏缓存', iconKey: 'game', tone: 'orange', group: 'game', groupLabel: '游戏' },
  battlenet: { title: '游戏缓存', iconKey: 'game', tone: 'orange', group: 'game', groupLabel: '游戏' },
  docker: { title: 'Docker 数据', iconKey: 'container', tone: 'blue', group: 'dev', groupLabel: '开发环境' },
  ollama: { title: 'AI 模型缓存', iconKey: 'container', tone: 'blue', group: 'dev', groupLabel: '开发环境' },
  huggingface: { title: 'AI 模型缓存', iconKey: 'container', tone: 'blue', group: 'dev', groupLabel: '开发环境' },
  'windows-temp': { title: 'Windows 临时文件', iconKey: 'system', tone: 'pink', group: 'system', groupLabel: '系统与应用' },
  'crash-dumps': { title: '崩溃转储', iconKey: 'system', tone: 'pink', group: 'system', groupLabel: '系统与应用' },
};

function pathKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}

function compactPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : path;
}

function filesLabel(fileCount: number): string {
  return fileCount > 0 ? `${fileCount.toLocaleString()} 个文件` : '文件数量待确认';
}

function riskLabel(risk: Risk): string {
  return risk === 'low' ? '可直接清理' : risk === 'medium' ? '需要确认' : '仅建议查看';
}

function metadataFor(candidate: CleanupCandidate): CleanerMeta {
  if (candidate.scaffold_id && SCAFFOLD_META[candidate.scaffold_id]) return SCAFFOLD_META[candidate.scaffold_id];
  if (candidate.boundary === 'user-content') {
    return { title: '用户内容', iconKey: 'media', tone: 'sun', group: 'media', groupLabel: '用户内容' };
  }
  if (candidate.boundary === 'system-protected') {
    return { title: candidate.name, iconKey: 'system', tone: 'blue', group: 'system', groupLabel: '系统与应用' };
  }
  return { iconKey: 'unknown', tone: 'blue', group: 'other', groupLabel: '其他' };
}

function effectiveRisk(candidate: CleanupCandidate): Risk {
  if (candidate.boundary === 'user-content' || candidate.boundary === 'system-protected' || candidate.boundary === 'unknown') return 'high';
  if (candidate.boundary === 'experimental-scope' && candidate.risk === 'low') return 'medium';
  return candidate.risk;
}

function planEligibleFor(candidate: CleanupCandidate, risk: Risk): boolean {
  return candidate.scope_status === 'stable' && candidate.audited_scaffold && risk !== 'high';
}

function stateFor(candidate: CleanupCandidate, risk: Risk, planEligible: boolean): CleanerItemState {
  if (!planEligible || risk === 'high' || candidate.status === 'keep') return 'view-only';
  if (candidate.status === 'preview' && risk === 'low') return 'ready';
  return 'review';
}

function consequenceFor(candidate: CleanupCandidate, risk: Risk): string {
  if (candidate.boundary === 'unknown') return '身份、归属和后果尚未得到规则支持；Pinkbin 不会把未知项加入清理计划。';
  if (candidate.boundary === 'user-content') return '可能包含个人或工作资料；Pinkbin 不会把用户内容加入默认清理计划。';
  if (candidate.boundary === 'system-protected') return '系统保护路径不会进入清理计划；警告不能覆盖这条安全边界。';
  if (candidate.boundary === 'experimental-scope') return '这是实验范围，当前只展示发现证据；不会静默进入默认计划。';
  if (risk === 'high') return '可能包含个人或系统状态；Pinkbin 不会把它加入默认清理计划。';
  if (risk === 'low') return '应用会在需要时重建，可能导致下次启动或安装时重新生成。';
  return '可能影响应用状态或触发重新下载，执行前需要人工确认。';
}

function boundaryLabel(boundary: CleanerItemBoundary): string {
  if (boundary === 'audited-scope') return '稳定范围';
  if (boundary === 'experimental-scope') return '实验范围';
  if (boundary === 'user-content') return '用户内容';
  if (boundary === 'system-protected') return '系统保护路径';
  return '未知项';
}

function selectionReason(candidate: CleanupCandidate, risk: Risk, planEligible: boolean): string {
  if (candidate.boundary === 'unknown') return '未知项只能查看，不能进入清理计划。';
  if (candidate.boundary === 'user-content') return '用户内容只能查看，不能进入默认清理计划。';
  if (candidate.boundary === 'system-protected') return '系统保护路径已排除，不能加入清理计划。';
  if (candidate.boundary === 'experimental-scope') return '实验范围不会静默进入默认计划；本轮只提供发现证据。';
  if (planEligible && risk === 'low') return '稳定范围且属于低风险可重建内容，默认选择。';
  if (planEligible) return '稳定范围但风险为中，需要人工审核后主动选择。';
  return '当前没有满足审核清理规则的选择入口。';
}

function toReadItem(candidate: CleanupCandidate): CleanerReadItem {
  const risk = effectiveRisk(candidate);
  const planEligible = planEligibleFor(candidate, risk);
  const state = stateFor(candidate, risk, planEligible);
  const meta = metadataFor(candidate);
  const defaultSelected = planEligible && risk === 'low';
  const selection: CleanerSelection = !planEligible ? 'view-only' : defaultSelected ? 'default' : 'manual';
  return {
    id: `scan:${pathKey(candidate.path)}`,
    title: meta.title ?? candidate.name,
    subtitle: `${candidate.name} · ${compactPath(candidate.path)}`,
    group: meta.group,
    groupLabel: meta.groupLabel,
    risk,
    label: riskLabel(risk),
    size: candidate.size_bytes,
    files: filesLabel(candidate.file_count),
    iconKey: meta.iconKey,
    tone: meta.tone,
    description: candidate.reason,
    consequence: consequenceFor(candidate, risk),
    paths: [candidate.path],
    defaultSelected,
    state,
    selection,
    selectionLabel: selection === 'default' ? '默认选择' : selection === 'manual' ? '可手动加入' : '仅建议查看',
    selectionReason: selectionReason(candidate, risk, planEligible),
    canSelect: planEligible,
    boundary: candidate.boundary,
    boundaryLabel: boundaryLabel(candidate.boundary),
    scopeStatus: candidate.scope_status,
    evidence: candidate.evidence,
    audited: candidate.audited_scaffold,
    planEligible,
    source: candidate.source,
  };
}

function sumNonOverlapping(items: CleanerReadItem[]): { bytes: number; files: number } {
  const selected = [...items]
    .filter((item) => item.defaultSelected)
    .sort((a, b) => pathKey(a.paths[0]).length - pathKey(b.paths[0]).length);
  const accepted: string[] = [];
  let bytes = 0;
  let files = 0;
  for (const item of selected) {
    const path = pathKey(item.paths[0]);
    const covered = accepted.some((parent) => path === parent || path.startsWith(`${parent}/`));
    if (covered) continue;
    accepted.push(path);
    bytes += item.size;
    const count = Number.parseInt(item.files.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(count)) files += count;
  }
  return { bytes, files };
}

export function buildCleanerReadModel(root: Node, scaffolds: Scaffold[], scanId = Date.now()): CleanerReadModel {
  const context = buildScanContext(root, scaffolds, scanId);
  const candidates = [
    ...buildLocalCandidates(context, 'list-cleanable'),
    ...buildLocalCandidates(context, 'protected'),
  ];
  const unique = new Map<string, CleanupCandidate>();
  for (const candidate of candidates) unique.set(pathKey(candidate.path), candidate);

  const items = Array.from(unique.values())
    .sort((a, b) => b.size_bytes - a.size_bytes)
    .slice(0, 24)
    .map(toReadItem);
  const estimate = sumNonOverlapping(items);

  return {
    scanId: context.scan_id,
    rootPath: root.path,
    scannedBytes: root.size,
    scannedFiles: root.file_count,
    displayedDirectorySample: context.top_entries.filter((entry) => entry.kind === 'dir'),
    estimatedReclaimableBytes: estimate.bytes,
    estimatedReclaimableFiles: estimate.files,
    coverage: context.coverage,
    totalBytes: root.size,
    totalFiles: root.file_count,
    items,
  };
}
