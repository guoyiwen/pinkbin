import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  AppWindow,
  Bot,
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  FileSearch,
  Film,
  FolderOpen,
  Gamepad2,
  Globe,
  HardDrive,
  History,
  LayoutDashboard,
  LockKeyhole,
  MessageCircle,
  PackageOpen,
  PanelLeft,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  CleanerWorkflow,
  displayWindowsScanRoot as displayScanRoot,
  isWindowsScanRoot,
  normalizeWindowsScanRoot as normalizeScanRoot,
  type CleanerWorkflowSnapshot,
} from '../cleanerWorkflow';
import { type CleanerEvidenceSource, type CleanerIconKey, type CleanerReadItem } from '../cleanerReadModel';
import type { Plan, UndoEntry } from '../types';
import './CleanerDashboardPrototype.css';

// PROTOTYPE: A composed cleaner workspace. A is the home surface, B is space
// analysis, and C is the advanced cleanup/review workbench.

type Surface = 'home' | 'space' | 'packs' | 'history' | 'settings';
type Risk = 'low' | 'medium' | 'high';
type CleanupStatus = '等待中' | '执行中' | '已完成' | '已跳过' | '失败';
type ExecutionRunStatus = 'running' | 'success' | 'partial-failure' | 'failure';

type ExecutionRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: ExecutionRunStatus;
  plan: Plan;
  itemTitles: string[];
  entries: UndoEntry[];
  failedPaths: string[];
  error?: string;
};

type CleanupItem = {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  groupLabel: string;
  risk: Risk;
  label: string;
  size: number;
  files: string;
  icon: LucideIcon;
  tone: string;
  description: string;
  consequence: string;
  paths: string[];
  evidence: string[];
  audited: boolean;
  planEligible: boolean;
  selection: CleanerReadItem['selection'];
  selectionLabel: string;
  selectionReason: string;
  canSelect: boolean;
  boundary: CleanerReadItem['boundary'];
  boundaryLabel: string;
  scopeStatus: CleanerReadItem['scopeStatus'];
  source: CleanerEvidenceSource;
  defaultSelected: boolean;
  status: CleanupStatus;
};

const GB = 1024 ** 3;
const DEFAULT_SCAN_ROOT = 'C:\\';
const CLEANER_SCAN_ROOT_STORAGE_KEY = 'pinkbin.cleaner.scan-root';

function loadCleanerScanRoot(): string {
  if (typeof window === 'undefined') return DEFAULT_SCAN_ROOT;
  try {
    return normalizeScanRoot(window.localStorage.getItem(CLEANER_SCAN_ROOT_STORAGE_KEY) ?? DEFAULT_SCAN_ROOT);
  } catch {
    return DEFAULT_SCAN_ROOT;
  }
}

function persistCleanerScanRoot(path: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLEANER_SCAN_ROOT_STORAGE_KEY, path);
  } catch {
    // Local persistence is optional in the prototype shell.
  }
}

const NAV_ITEMS: { id: Surface; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: '首页', icon: LayoutDashboard },
  { id: 'space', label: '空间分析', icon: HardDrive },
  { id: 'packs', label: '深度清理', icon: PackageOpen },
  { id: 'history', label: '历史记录', icon: History },
  { id: 'settings', label: '设置', icon: Settings2 },
];

const GROUPS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'system', label: '系统与应用', icon: AppWindow },
  { id: 'dev', label: '开发环境', icon: Cpu },
  { id: 'app', label: '应用数据', icon: MessageCircle },
  { id: 'game', label: '游戏', icon: Gamepad2 },
  { id: 'media', label: '用户内容', icon: Film },
];

const ICON_BY_KEY: Record<CleanerIconKey, LucideIcon> = {
  browser: Globe,
  dev: Cpu,
  chat: MessageCircle,
  game: Gamepad2,
  container: Boxes,
  media: Film,
  system: HardDrive,
  unknown: FolderOpen,
};

function cleanupItemsFromReadModel(readItems: CleanerReadItem[]): CleanupItem[] {
  return readItems.map(({ iconKey, state, ...item }) => ({
    ...item,
    icon: ICON_BY_KEY[iconKey],
    status: state === 'view-only' ? '已跳过' : '等待中',
  }));
}

function formatSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function executionStatusClass(status: CleanupStatus): string {
  if (status === '执行中') return 'running';
  if (status === '已完成') return 'completed';
  if (status === '已跳过') return 'skipped';
  if (status === '失败') return 'failed';
  return 'waiting';
}

function executionRunLabel(status: ExecutionRunStatus): string {
  if (status === 'running') return '执行中';
  if (status === 'success') return '已完成';
  if (status === 'partial-failure') return '部分失败';
  return '失败';
}

function executionRunClass(status: ExecutionRunStatus): string {
  if (status === 'running') return 'running';
  if (status === 'success') return 'completed';
  return 'failed';
}

function formatRunTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function riskClass(risk: Risk): string {
  return `cleaner-risk cleaner-risk-${risk}`;
}

function RiskLabel({ risk, text }: { risk: Risk; text?: string }) {
  const label = text ?? (risk === 'low' ? '可直接清理' : risk === 'medium' ? '需要确认' : '仅建议查看');
  return <span className={riskClass(risk)}>{label}</span>;
}

function visibleRiskLabel(item: Pick<CleanupItem, 'label'>): string {
  return item.label;
}

function planAccessLabel(item: Pick<CleanupItem, 'selectionReason'>): string {
  return item.selectionReason;
}

function IconTile({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) {
  return <span className={`cleaner-icon-tile cleaner-tone-${tone}`}><Icon size={18} strokeWidth={2.2} /></span>;
}

function SizeValue({ bytes }: { bytes: number }) {
  return <span className="cleaner-size mono-num">{formatSize(bytes)}</span>;
}

function PrototypeNav({ active, onNavigate }: { active: Surface; onNavigate: (surface: Surface) => void }) {
  return (
    <nav className="cleaner-nav" aria-label="主导航">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          type="button"
          key={id}
          className={active === id ? 'is-active' : ''}
          onClick={() => onNavigate(id)}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function CleanerSidebar({ activeSurface, onNavigate, scanRoot, totalBytes }: { activeSurface: Surface; onNavigate: (surface: Surface) => void; scanRoot: string; totalBytes: number }) {
  return (
    <aside className="cleaner-sidebar">
      <div className="cleaner-brand"><span className="cleaner-brand-mark"><Zap size={17} fill="currentColor" /></span><strong>pinkbin</strong><small>DISK CARE</small></div>
      <div className="cleaner-sidebar-caption">你的电脑</div>
      <div className="cleaner-drive-chip"><HardDrive size={16} /><span><strong>{scanRoot}</strong><small>{formatSize(totalBytes)} 已用</small></span><span className="cleaner-drive-dot" /></div>
      <PrototypeNav active={activeSurface} onNavigate={onNavigate} />
      <div className="cleaner-sidebar-foot"><ShieldCheck size={14} /><span>本地优先<br /><small>不读取文件内容</small></span></div>
    </aside>
  );
}

function ScanStatus({ status, onScan, summary, error }: { status: CleanerWorkflowSnapshot['status']; onScan: () => void; summary: string; error: string | null }) {
  const scanning = status === 'scanning';
  const statusLabel = status === 'error'
    ? `扫描失败 · ${error ?? '本地扫描未完成'}`
    : status === 'empty'
      ? '扫描完成 · 没有可展示的清理范围'
      : scanning
        ? '正在读取本地目录元数据…'
        : summary;
  return (
    <div className="cleaner-scan-status">
      <span className={`${status === 'error' ? 'cleaner-live-dot is-error' : 'cleaner-live-dot'} ${scanning ? 'is-scanning' : ''}`} />
      <span>{statusLabel}</span>
      <button type="button" onClick={() => onScan()} disabled={scanning}><RefreshCw size={13} /> 重新扫描</button>
    </div>
  );
}

function ScanStatePanel({ status, error, onScan }: { status: CleanerWorkflowSnapshot['status']; error: string | null; onScan: () => void }) {
  if (status === 'ready') return null;
  const data = status === 'idle'
    ? { icon: HardDrive, eyebrow: '本地扫描 · 尚未开始', title: '从一个 Windows 范围开始', copy: '在设置中输入盘符根目录或文件夹，然后启动本地扫描。' }
    : status === 'scanning'
    ? { icon: RefreshCw, eyebrow: '本地扫描 · 进行中', title: '正在读取扫描证据', copy: '扫描只读取路径、大小、文件数和扩展名摘要；当前结果会在扫描完成前清空。' }
    : status === 'error'
      ? { icon: TriangleAlert, eyebrow: '本地扫描 · 失败', title: '这次扫描没有完成', copy: error ?? '请检查路径是否存在、磁盘是否可访问，修正后重新扫描。' }
      : { icon: FileSearch, eyebrow: '本地扫描 · 无结果', title: '没有发现可展示的清理范围', copy: '这次扫描没有返回可用于清理工作台的目录证据；可以换一个 Windows 目录重新扫描。' };
  const Icon = data.icon;
  return (
    <div className="cleaner-surface-note" role={status === 'error' ? 'alert' : 'status'}>
      <Icon size={22} className={status === 'scanning' ? 'cleaner-spin' : undefined} />
      <span className="cleaner-kicker">{data.eyebrow}</span>
      <h2>{data.title}</h2>
      <p>{data.copy}</p>
      {status !== 'scanning' && <button type="button" className="cleaner-button cleaner-button-primary" onClick={onScan}><RefreshCw size={14} /> {status === 'idle' ? '开始扫描' : '重新扫描'}</button>}
    </div>
  );
}

function getInitialSurface(): Surface {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('surface');
  if (requested === 'home' || requested === 'space' || requested === 'packs' || requested === 'history' || requested === 'settings') {
    return requested;
  }

  // Keep the comparison URLs useful while the prototype is being reviewed.
  const legacyVariant = params.get('variant');
  if (legacyVariant === 'B') return 'space';
  if (legacyVariant === 'C') return 'packs';
  return 'home';
}

function SelectionButton({ item, selected, onToggle, disabled = false }: { item: CleanupItem; selected: boolean; onToggle: () => void; disabled?: boolean }) {
  const isDisabled = disabled || !item.canSelect;
  const ariaLabel = !item.canSelect ? `${item.selectionLabel} ${item.title}` : `${selected ? '取消选择' : '选择'} ${item.title}`;
  return (
    <button
      type="button"
      className={`cleaner-select-button ${selected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''}`}
      onClick={isDisabled ? undefined : onToggle}
      disabled={isDisabled}
      aria-pressed={selected}
      aria-label={ariaLabel}
    >
      {selected ? <Check size={13} strokeWidth={3} /> : <span />}
    </button>
  );
}

function CompactItemRow({ item, selected, onToggle, onInspect }: { item: CleanupItem; selected: boolean; onToggle: () => void; onInspect: () => void }) {
  return (
    <div className={`cleaner-item-row ${selected ? 'is-selected' : ''}`}>
      <SelectionButton item={item} selected={selected} onToggle={onToggle} />
      <IconTile icon={item.icon} tone={item.tone} />
      <button type="button" className="cleaner-item-copy" onClick={onInspect}>
        <strong>{item.title}</strong>
        <span>{item.subtitle} · {item.boundaryLabel}</span>
      </button>
      <RiskLabel risk={item.risk} text={visibleRiskLabel(item)} />
      <SizeValue bytes={item.size} />
      <button type="button" className="cleaner-icon-button" onClick={onInspect} aria-label={`查看 ${item.title}`}><ChevronRight size={16} /></button>
    </div>
  );
}

function ReviewSheet({
  items,
  selectedIds,
  onToggle,
  onClose,
}: {
  items: CleanupItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const selected = items.filter((item) => selectedIds.has(item.id));
  const total = selected.reduce((sum, item) => sum + item.size, 0);
  const planPathCount = new Set(selected.flatMap((item) => item.paths)).size;
  const toggleReviewItem = (id: string) => {
    onToggle(id);
  };
  return (
    <div className="cleaner-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="cleaner-review-sheet" role="dialog" aria-modal="true" aria-label="复核清理计划" onMouseDown={(event) => event.stopPropagation()}>
        <div className="cleaner-sheet-head">
          <div><span className="cleaner-kicker">人工审核 · 只读预览</span><h2>查看这次清理</h2></div>
          <button type="button" className="cleaner-icon-button" onClick={onClose} aria-label="关闭复核"><X size={18} /></button>
        </div>
        <div className="cleaner-review-total"><span>预计可释放</span><strong>{formatSize(total)}</strong><small>{selected.length} 个范围 · {planPathCount} 个路径 · 仅展示计划，不执行清理</small></div>
        <div className="cleaner-review-list">
          {selected.length === 0 ? <div className="cleaner-empty-review">没有选择任何项目。回到结果页勾选低风险内容，或只把这次当作查看报告。</div> : selected.map((item) => (
            <div className="cleaner-review-row" key={item.id}>
              <SelectionButton item={item} selected onToggle={() => toggleReviewItem(item.id)} />
              <div className="cleaner-review-row-copy"><strong>{item.title}</strong><span>{item.paths[0]}</span><small>{item.consequence}</small></div>
              <SizeValue bytes={item.size} />
            </div>
          ))}
        </div>
        <div className="cleaner-sheet-foot">
          <span className="cleaner-safe-note"><ShieldCheck size={15} /><span><strong>本轮只读</strong><small>不读取文件内容 · 不移动文件 · 回收站和永久删除未启用</small></span></span>
          <div className="cleaner-sheet-actions">
            <button type="button" className="cleaner-button cleaner-button-quiet" onClick={onClose}>返回工作台</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SurfaceNote({ surface }: { surface: Surface }) {
  const data: Record<Surface, { eyebrow: string; title: string; copy: string; icon: LucideIcon }> = {
    home: { eyebrow: '快速清理', title: '先从能安全释放的空间开始', copy: '选择首页查看本次扫描摘要。', icon: LayoutDashboard },
    space: { eyebrow: '空间分析', title: '看懂这些空间从哪里来', copy: '完整扫描后的语义空间图和目录下钻会放在这里。', icon: HardDrive },
    packs: { eyebrow: '深度清理', title: '把复杂应用拆成可审查的范围', copy: '稳定范围默认可用，实验范围需要主动开启。', icon: PackageOpen },
    history: { eyebrow: '历史记录', title: '先记录每次清理结果', copy: '本轮先保留执行记录与隔离状态，恢复入口后续接入。', icon: History },
    settings: { eyebrow: '设置', title: '把控制权留在你手里', copy: '管理扫描根目录、排除项、AI 和深度清理规则更新。', icon: Settings2 },
  };
  const value = data[surface];
  const Icon = value.icon;
  return <div className="cleaner-surface-note"><Icon size={22} /><span className="cleaner-kicker">{value.eyebrow}</span><h2>{value.title}</h2><p>{value.copy}</p></div>;
}

type CleanerSettingsProps = {
  scanRootPath: string;
  scanSummary: string;
  scanning: boolean;
  onScan: (rootPath?: string) => void;
  onSaveScanRoot: (path: string) => void;
};

function CleanerSettings({ scanRootPath, scanSummary, scanning, onScan, onSaveScanRoot }: CleanerSettingsProps) {
  const [draftRoot, setDraftRoot] = useState(scanRootPath);
  const normalizedRoot = normalizeScanRoot(draftRoot);
  const validRoot = isWindowsScanRoot(normalizedRoot);
  const hasChanges = normalizedRoot !== scanRootPath;

  useEffect(() => {
    setDraftRoot(scanRootPath);
  }, [scanRootPath]);

  const saveAndScan = () => {
    if (!validRoot) return;
    onSaveScanRoot(normalizedRoot);
    onScan(normalizedRoot);
  };

  return (
    <section className="cleaner-settings-page">
      <div className="cleaner-settings-heading">
        <div>
          <span className="cleaner-kicker">设置 · 扫描范围</span>
          <h1>决定 Pinkbin 看哪里</h1>
          <p>只扫描目录元数据，不读取文件内容；清理前仍会经过审核和隔离确认。</p>
        </div>
        <Settings2 size={23} />
      </div>

      <section className="cleaner-settings-section">
        <div className="cleaner-settings-section-head"><div><span className="cleaner-kicker">扫描根目录</span><h2>从哪个 Windows 位置开始</h2></div><HardDrive size={17} /></div>
        <label className="cleaner-settings-field">
          <span>路径</span>
          <input value={draftRoot} onChange={(event) => setDraftRoot(event.target.value)} placeholder="C:\\ 或 D:\\Projects" spellCheck={false} />
        </label>
        <p className="cleaner-settings-help">支持盘符根目录或其下的文件夹，例如 <code>C:\\</code>、<code>D:\\Projects</code>。</p>
        {!validRoot && draftRoot.trim() && <p className="cleaner-settings-error">请输入 Windows 路径，例如 C:\\ 或 D:\\Projects。</p>}
        <div className="cleaner-settings-actions">
          <button type="button" className="cleaner-button cleaner-button-quiet" onClick={() => onSaveScanRoot(normalizedRoot)} disabled={!validRoot || !hasChanges}>保存范围</button>
          <button type="button" className="cleaner-button cleaner-button-primary" onClick={saveAndScan} disabled={!validRoot || scanning}><RefreshCw size={14} />{scanning ? '扫描中…' : '保存并重新扫描'}</button>
        </div>
        <div className="cleaner-settings-last-scan"><Clock3 size={14} /><span><strong>最近一次扫描</strong><small>{scanSummary}</small></span></div>
      </section>

      <section className="cleaner-settings-section">
        <div className="cleaner-settings-section-head"><div><span className="cleaner-kicker">安全边界</span><h2>当前原型的执行规则</h2></div><ShieldCheck size={17} /></div>
        <div className="cleaner-settings-rule"><ShieldCheck size={15} /><span><strong>执行方式</strong><small>只生成隔离计划，不永久删除文件。</small></span><b>隔离区</b></div>
        <div className="cleaner-settings-rule"><FileSearch size={15} /><span><strong>扫描内容</strong><small>使用路径、大小、文件数和扩展名分布判断范围。</small></span><b>仅元数据</b></div>
        <div className="cleaner-settings-rule is-muted"><LockKeyhole size={15} /><span><strong>恢复与永久删除</strong><small>恢复、回滚和永久删除入口暂未启用。</small></span><b>未启用</b></div>
      </section>
    </section>
  );
}

function HistoryLog({ runs }: { runs: ExecutionRun[] }) {
  return (
    <section className="cleaner-history-log">
      <span className="cleaner-kicker">历史记录 · 只读</span>
      <h1>最近的清理计划</h1>
      <p>这里只记录计划和执行结果；恢复入口后续接入。</p>
      <div className="cleaner-history-list">
        {!runs.length ? <div className="cleaner-history-empty"><History size={19} /><strong>还没有执行记录</strong><span>完成一次隔离后，计划会出现在这里。</span></div> : runs.map((run) => (
          <article className={`cleaner-history-item cleaner-history-item-${executionRunClass(run.status)}`} key={run.id}>
            <div className="cleaner-history-item-head"><span className={`cleaner-history-status cleaner-history-status-${executionRunClass(run.status)}`}>{executionRunLabel(run.status)}</span><strong>隔离区</strong><small>{formatRunTime(run.startedAt)} · {run.itemTitles.length} 个范围 · {run.plan.paths.length} 个路径</small></div>
            <div className="cleaner-history-item-names">{run.itemTitles.join('、')}</div>
            <div className="cleaner-history-item-meta"><span>{run.entries.length} 个路径已返回结果</span>{run.failedPaths.length > 0 && <span className="cleaner-history-failed">{run.failedPaths.length} 个路径失败</span>}{run.error && <span className="cleaner-history-failed">{run.error}</span>}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function VariantA({ activeSurface, onNavigate, items, selectedIds, onToggle, onInspect, onReview, scanning, onScan, scanRoot, totalBytes, scanSummary, executionLog, scanRootPath, onSaveScanRoot, workflowStatus, scanError }: VariantProps) {
  const low = items.filter((item) => item.risk === 'low');
  const medium = items.filter((item) => item.risk === 'medium');
  const high = items.filter((item) => item.risk === 'high');
  const selectedBytes = items.filter((item) => selectedIds.has(item.id)).reduce((sum, item) => sum + item.size, 0);
  return (
    <div className="cleaner-variant cleaner-variant-a">
      <CleanerSidebar activeSurface={activeSurface} onNavigate={onNavigate} scanRoot={scanRoot} totalBytes={totalBytes} />
      <main className="cleaner-a-main">
        {activeSurface === 'home' && <ScanStatus status={workflowStatus} onScan={onScan} summary={scanSummary} error={scanError} />}
        {activeSurface !== 'home' ? activeSurface === 'history' ? <HistoryLog runs={executionLog ?? []} /> : activeSurface === 'settings' ? <CleanerSettings scanRootPath={scanRootPath} scanSummary={scanSummary} scanning={scanning} onScan={onScan} onSaveScanRoot={onSaveScanRoot} /> : <SurfaceNote surface={activeSurface} /> : (
          workflowStatus !== 'ready' ? <ScanStatePanel status={workflowStatus} error={scanError} onScan={onScan} /> : <>
            <div className="cleaner-a-heading"><div><span className="cleaner-kicker">今天 · 快速清理</span><h1>你的空间，<em>看懂了。</em></h1><p>发现 {items.length} 个范围，其中 {low.length} 个可以马上释放。</p></div><button type="button" className="cleaner-icon-button cleaner-heading-settings" title="调整扫描范围" onClick={() => onNavigate('settings')}><SlidersHorizontal size={17} /></button></div>
            <section className="cleaner-a-hero">
              <div><span className="cleaner-hero-label"><ShieldCheck size={15} /> 预计可释放</span><strong className="cleaner-hero-number">{formatSize(selectedBytes)}</strong><p>来自 {selectedIds.size} 个低风险可重建范围<br /><span>扫描总量与预计可释放空间分别计算</span></p><div className="cleaner-hero-actions"><button type="button" className="cleaner-button cleaner-button-primary" onClick={onReview} disabled={!selectedIds.size}><Archive size={15} /> 查看复核计划</button><button type="button" className="cleaner-button cleaner-button-quiet" onClick={() => onScan()}><RefreshCw size={14} /> 完整扫描</button></div></div>
              <div className="cleaner-hero-orbit"><div className="cleaner-hero-orbit-ring"><span>{new Set(low.map((item) => item.group)).size}</span><small>可清理<br />类别</small></div><div className="cleaner-orbit-label cleaner-orbit-top">缓存</div><div className="cleaner-orbit-label cleaner-orbit-right">开发</div><div className="cleaner-orbit-label cleaner-orbit-bottom">残留</div></div>
            </section>
            <div className="cleaner-section-heading"><div><h2>建议先处理</h2><span>这些内容可重建，不会碰你的个人文件</span></div><button type="button" className="cleaner-text-button" onClick={onReview}>查看清单 <ArrowRight size={13} /></button></div>
            <div className="cleaner-a-list">{low.map((item) => <CompactItemRow key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => onToggle(item.id)} onInspect={() => onInspect(item)} />)}</div>
            <div className="cleaner-section-heading cleaner-section-heading-spaced"><div><h2>需要你判断</h2><span>可能影响应用状态，默认不选择</span></div><span className="cleaner-count-note">{medium.length} 个范围</span></div>
            <div className="cleaner-a-list cleaner-a-list-muted">{medium.map((item) => <CompactItemRow key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => onToggle(item.id)} onInspect={() => onInspect(item)} />)}</div>
            {high.length > 0 && <div className="cleaner-a-view-only"><LockKeyhole size={15} /><span><strong>{high.length} 个内容仅建议查看</strong><small>包括系统、用户内容和高风险应用数据 · 不会进入清理计划</small></span><button type="button" className="cleaner-link-button" onClick={() => onInspect(high[0])}>查看原因 <ChevronRight size={13} /></button></div>}
          </>
        )}
      </main>
    </div>
  );
}

function VariantB({ activeSurface, onNavigate, items, selectedIds, onToggle, onInspect, onReview, scanning, onScan, scanRoot, totalBytes, scanSummary, workflowStatus, scanError }: VariantProps) {
  const [focusId, setFocusId] = useState(items[0]?.id ?? '');
  const focused = items.find((item) => item.id === focusId) ?? items[0];
  const selectedBytes = items.filter((item) => selectedIds.has(item.id)).reduce((sum, item) => sum + item.size, 0);
  const mapLayout: { size: 'large' | 'medium' | 'small' | 'tiny'; col: string; row: string }[] = [
    { size: 'large', col: '1 / 5', row: '1 / 4' },
    { size: 'medium', col: '5 / 8', row: '1 / 3' },
    { size: 'medium', col: '8 / 11', row: '1 / 3' },
    { size: 'small', col: '5 / 8', row: '3 / 5' },
    { size: 'small', col: '8 / 11', row: '3 / 5' },
    { size: 'tiny', col: '1 / 4', row: '4 / 5' },
  ];
  const blocks = items.slice(0, mapLayout.length).map((item, index) => ({
    ...mapLayout[index],
    id: item.id,
    label: item.title,
    sub: formatSize(item.size),
  }));
  return (
    <div className="cleaner-variant cleaner-variant-b">
      <CleanerSidebar activeSurface={activeSurface} onNavigate={onNavigate} scanRoot={scanRoot} totalBytes={totalBytes} />
      <div className="cleaner-b-workspace">
        <header className="cleaner-b-topbar"><div className="cleaner-topbar-actions"><button type="button" className="cleaner-plain-button"><CircleHelp size={16} /></button><button type="button" className="cleaner-plain-button"><Settings2 size={16} /></button><button type="button" className="cleaner-button cleaner-button-primary" onClick={onReview} disabled={!selectedIds.size}><Archive size={14} /> 清理 {formatSize(selectedBytes)}</button></div></header>
        <main className="cleaner-b-main">
        <div className="cleaner-b-heading"><div><span className="cleaner-kicker">空间分析 · {scanRoot}</span><h1>{formatSize(totalBytes)} <span>已用</span></h1><p>拖动和点击空间块，查看它们的来源与清理建议。</p></div><div className="cleaner-b-scan"><div className="cleaner-b-gauge"><span>{items.length ? Math.round((items.reduce((sum, item) => sum + item.size, 0) / Math.max(totalBytes, 1)) * 100) : 0}%</span></div><span><strong>已扫描</strong><small>{items.length} 个位置 · {scanning ? '扫描中…' : scanSummary}</small></span><button type="button" className="cleaner-plain-button" onClick={() => onScan()}><RefreshCw size={15} /></button></div></div>
        {workflowStatus !== 'ready' ? <ScanStatePanel status={workflowStatus} error={scanError} onScan={onScan} /> : activeSurface !== 'space' && activeSurface !== 'home' ? <SurfaceNote surface={activeSurface} /> : (
          <>
            <div className="cleaner-b-map-row">{focused ? <><section className="cleaner-space-map"><div className="cleaner-map-label"><span>按占用空间</span><span>点击查看详情</span></div><div className="cleaner-map-grid">{blocks.map((block) => { const item = items.find((entry) => entry.id === block.id)!; return <button type="button" key={block.id} className={`cleaner-map-block cleaner-map-${block.size} cleaner-tone-bg-${item.tone} ${focusId === block.id ? 'is-focus' : ''}`} style={{ gridColumn: block.col, gridRow: block.row }} onClick={() => { setFocusId(block.id); onInspect(item); }}><strong>{block.label}</strong><span>{block.sub}</span><small>{item.canSelect ? selectedIds.has(item.id) ? '已选择' : item.selectionLabel : item.selectionLabel}</small></button>; })}</div><div className="cleaner-map-legend"><span><i className="legend-dot legend-safe" />可重建</span><span><i className="legend-dot legend-review" />需要确认</span><span><i className="legend-dot legend-view" />用户内容 / 高风险</span></div></section><aside className="cleaner-b-inspector"><span className="cleaner-kicker">当前选择</span><div className="cleaner-inspector-title"><IconTile icon={focused.icon} tone={focused.tone} /><div><h2>{focused.title}</h2><span>{focused.subtitle}</span></div></div><div className="cleaner-inspector-size"><strong>{formatSize(focused.size)}</strong><span>{focused.files}</span></div><RiskLabel risk={focused.risk} text={visibleRiskLabel(focused)} /><p>{focused.description}</p><div className="cleaner-inspector-impact"><TriangleAlert size={14} /><span>{focused.consequence}</span></div><div className="cleaner-inspector-path"><FolderOpen size={14} /><span>{focused.paths[0]}</span></div><div className="cleaner-inspector-actions">{focused.canSelect ? <button type="button" className={`cleaner-button ${selectedIds.has(focused.id) ? 'cleaner-button-quiet' : 'cleaner-button-primary'}`} onClick={() => onToggle(focused.id)}>{selectedIds.has(focused.id) ? '取消选择' : '加入清理计划'} <ArrowRight size={14} /></button> : <span className="cleaner-inspector-locked"><LockKeyhole size={14} /><span><strong>{focused.selectionLabel}</strong><small>{planAccessLabel(focused)}</small></span></span>}<button type="button" className="cleaner-text-button" onClick={() => onInspect(focused)}>查看所有路径</button></div></aside></> : <div className="cleaner-surface-note"><HardDrive size={22} /><span className="cleaner-kicker">空间分析</span><h2>还没有可展示的扫描位置</h2><p>重新扫描后，这里会按占用空间显示目录来源。</p></div>}</div>
            <div className="cleaner-b-bottom"><div><span className="cleaner-kicker">当前清理计划</span><strong>{formatSize(selectedBytes)}</strong><span>{selectedIds.size} 个可重建范围已选择</span></div><button type="button" className="cleaner-button cleaner-button-primary" onClick={onReview} disabled={!selectedIds.size}>进入复核 <ArrowRight size={14} /></button></div>
          </>
        )}
        </main>
      </div>
    </div>
  );
}

function VariantC({ activeSurface, onNavigate, items, selectedIds, onToggle, onInspect, onReview, scanning, onScan, scanRoot, totalBytes, workflowStatus, scanError }: VariantProps) {
  const [filter, setFilter] = useState<'all' | Risk>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    const matchesRisk = filter === 'all' || item.risk === filter;
    const matchesCategory = !category || item.group === category;
    const searchable = [item.title, item.subtitle, item.groupLabel, ...item.paths].join(' ').toLowerCase();
    return matchesRisk && matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
  const activeFilterLabels = [
    filter === 'all' ? null : filter === 'low' ? '低风险' : filter === 'medium' ? '需确认' : '仅查看',
    category ? GROUPS.find((group) => group.id === category)?.label : null,
    normalizedQuery ? `搜索“${query.trim()}”` : null,
  ].filter(Boolean).join(' · ') || '全部';
  const clearFilters = () => {
    setFilter('all');
    setCategory(null);
    setQuery('');
  };
  const hasActiveFilters = filter !== 'all' || category !== null || Boolean(normalizedQuery);
  const selectedBytes = items.filter((item) => selectedIds.has(item.id)).reduce((sum, item) => sum + item.size, 0);
  return (
    <div className="cleaner-variant cleaner-variant-c">
      <CleanerSidebar activeSurface={activeSurface} onNavigate={onNavigate} scanRoot={scanRoot} totalBytes={totalBytes} />
      <div className="cleaner-c-workspace">
        <header className="cleaner-c-header"><div className="cleaner-c-title"><PanelLeft size={17} /><div><span className="cleaner-kicker">深度清理 · 审核工作台</span><h1>清理计划</h1></div></div><div className="cleaner-c-header-meta"><span><Clock3 size={14} />扫描于刚刚</span><button type="button" className="cleaner-button cleaner-button-quiet" onClick={() => onScan()}><RefreshCw size={14} /> {scanning ? '扫描中…' : '重新扫描'}</button></div></header>
        {workflowStatus !== 'ready' ? <ScanStatePanel status={workflowStatus} error={scanError} onScan={onScan} /> : activeSurface !== 'packs' && activeSurface !== 'home' ? <SurfaceNote surface={activeSurface} /> : (
          <main className="cleaner-c-main">
           <aside className="cleaner-c-filter"><div className="cleaner-c-filter-top"><span className="cleaner-kicker">筛选</span><SlidersHorizontal size={15} /></div><div className="cleaner-filter-search"><Search size={14} /><input aria-label="搜索应用或路径" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索应用或路径" /></div>{hasActiveFilters && <div className="cleaner-filter-clear-row"><button type="button" className="cleaner-filter-clear" onClick={clearFilters}>清除筛选</button></div>}<div className="cleaner-c-filter-label">风险</div>{(['all', 'low', 'medium', 'high'] as const).map((value) => <button type="button" key={value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)} aria-pressed={filter === value}><span className={`filter-marker filter-marker-${value}`} />{value === 'all' ? '全部范围' : value === 'low' ? '可直接清理' : value === 'medium' ? '需要确认' : '仅建议查看'}<small>{value === 'all' ? items.length : items.filter((item) => item.risk === value).length}</small></button>)}<div className="cleaner-c-filter-label">类别</div>{GROUPS.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={`cleaner-filter-category ${category === id ? 'is-active' : ''}`} onClick={() => setCategory((current) => current === id ? null : id)} aria-pressed={category === id}><Icon size={14} />{label}<small>{items.filter((item) => item.group === id).length}</small></button>)}<div className="cleaner-c-filter-foot"><LockKeyhole size={13} />系统保护路径已排除</div></aside>
           <section className="cleaner-c-table-section"><div className="cleaner-c-table-head"><div><span className="cleaner-kicker">{visible.length} 个范围 · {activeFilterLabels}</span><h2>逐项审核选择</h2></div><span className="cleaner-report-state"><FileSearch size={14} />扫描证据已载入</span></div><div className="cleaner-c-table"><div className="cleaner-table-header"><span>选择</span><span>范围</span><span>风险</span><span>大小</span><span>状态</span><span /></div>{visible.map((item) => <div className={`cleaner-table-row ${selectedIds.has(item.id) ? 'is-selected' : ''}`} key={item.id}><SelectionButton item={item} selected={selectedIds.has(item.id)} onToggle={() => onToggle(item.id)} /><button type="button" className="cleaner-table-item" onClick={() => onInspect(item)}><IconTile icon={item.icon} tone={item.tone} /><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></button><RiskLabel risk={item.risk} text={visibleRiskLabel(item)} /><SizeValue bytes={item.size} /><span className={`cleaner-task-state cleaner-task-${executionStatusClass(item.status)}`}>{item.status}</span><button type="button" className="cleaner-icon-button" onClick={() => onInspect(item)}><ChevronRight size={15} /></button></div>)}{!visible.length && <div className="cleaner-filter-empty"><Search size={18} /><strong>没有匹配的范围</strong><span>换个关键词或清除当前筛选，查看全部扫描结果。</span><button type="button" className="cleaner-text-button" onClick={clearFilters}>清除筛选</button></div>}</div></section>
          <aside className="cleaner-c-plan"><div className="cleaner-c-plan-head"><div><span className="cleaner-kicker">待执行</span><h2>清理计划</h2></div><Archive size={19} /></div><div className="cleaner-c-plan-number">{formatSize(selectedBytes)}<small>预计可释放</small></div><div className="cleaner-c-plan-bar"><span style={{ width: `${Math.min(100, (selectedBytes / (40 * GB)) * 100)}%` }} /></div><div className="cleaner-c-plan-list">{items.filter((item) => selectedIds.has(item.id)).map((item) => <div key={item.id}><span className={`plan-status-dot cleaner-plan-dot-${executionStatusClass(item.status)}`} /><span>{item.title}</span><SizeValue bytes={item.size} /></div>)}{!selectedIds.size && <div className="cleaner-plan-empty">从左侧选择低风险范围，计划会显示在这里。</div>}</div><div className="cleaner-c-plan-note"><ShieldCheck size={14} /><span>执行方式：隔离区<br /><small>不读取文件内容 · 永久删除未启用</small></span></div><button type="button" className="cleaner-button cleaner-button-primary cleaner-button-wide" onClick={onReview} disabled={!selectedIds.size}><Archive size={15} /> 复核并隔离</button></aside>
          </main>
        )}
      </div>
    </div>
  );
}

type VariantProps = {
  activeSurface: Surface;
  onNavigate: (surface: Surface) => void;
  items: CleanupItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onInspect: (item: CleanupItem) => void;
  onReview: () => void;
  scanning: boolean;
  onScan: (rootPath?: string) => void;
  onSaveScanRoot: (path: string) => void;
  scanRootPath: string;
  scanRoot: string;
  totalBytes: number;
  scanSummary: string;
  workflowStatus: CleanerWorkflowSnapshot['status'];
  scanError: string | null;
  executionLog?: ExecutionRun[];
};

function DetailPopover({ item, onClose, onAsk }: { item: CleanupItem; onClose: () => void; onAsk: () => void }) {
  return (
    <div className="cleaner-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="cleaner-detail-popover" role="dialog" aria-modal="true" aria-label={`${item.title}详情`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="cleaner-detail-head"><div><IconTile icon={item.icon} tone={item.tone} /><span><span className="cleaner-kicker">{item.groupLabel}</span><h2>{item.title}</h2></span></div><button type="button" className="cleaner-icon-button" onClick={onClose}><X size={17} /></button></div>
        <div className="cleaner-detail-meta"><RiskLabel risk={item.risk} text={visibleRiskLabel(item)} /><SizeValue bytes={item.size} /><span>{item.files}</span></div>
        <p className="cleaner-detail-description">{item.description}</p>
        <div className="cleaner-detail-impact"><TriangleAlert size={15} /><span><strong>清理后</strong>{item.consequence}</span></div>
        <div className="cleaner-detail-paths"><div className="cleaner-detail-path-label"><FolderOpen size={13} />命中的位置</div>{item.paths.map((path) => <code key={path}>{path}</code>)}</div>
        <div className={`cleaner-detail-evidence ${item.planEligible ? 'is-eligible' : 'is-blocked'}`}><div className="cleaner-detail-path-label"><FileSearch size={13} />审核证据</div><span>{item.boundaryLabel} · {item.selectionLabel}</span>{item.evidence.map((entry) => <span key={entry}>{entry}</span>)}<strong>{planAccessLabel(item)}</strong></div>
        <div className="cleaner-detail-actions"><button type="button" className="cleaner-button cleaner-button-quiet" onClick={onAsk}><Bot size={15} />询问 AI 为什么</button><button type="button" className="cleaner-button cleaner-button-quiet" onClick={() => { navigator.clipboard?.writeText(item.paths[0]).catch(() => {}); }}>复制路径</button></div>
      </section>
    </div>
  );
}

export function CleanerDashboardPrototype() {
  const [activeSurface, setActiveSurface] = useState<Surface>(getInitialSurface);
  const workflowRef = useRef<CleanerWorkflow | null>(null);
  if (workflowRef.current === null) workflowRef.current = new CleanerWorkflow();
  const [workflowState, setWorkflowState] = useState<CleanerWorkflowSnapshot>(() => workflowRef.current!.snapshot);
  const [items, setItems] = useState<CleanupItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [inspected, setInspected] = useState<CleanupItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [executionLog] = useState<ExecutionRun[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [scanRootPath, setScanRootPath] = useState(loadCleanerScanRoot);
  const [scanRoot, setScanRoot] = useState(() => displayScanRoot(loadCleanerScanRoot()));
  const [totalBytes, setTotalBytes] = useState(0);
  const [scanSummary, setScanSummary] = useState('尚未扫描 · 选择 Windows 盘符或目录后开始');
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);

  const applyWorkflowState = (next: CleanerWorkflowSnapshot) => {
    setWorkflowState(next);
    setScanning(next.status === 'scanning');
    const nextItems = next.model ? cleanupItemsFromReadModel(next.model.items) : [];
    setItems(nextItems);
    setSelectedIds(new Set(next.selectedIds));
    setTotalBytes(next.model?.scannedBytes ?? 0);
    if (next.scanPath) {
      setScanRootPath(next.scanPath);
      setScanRoot(displayScanRoot(next.scanPath));
    }
    if (next.status === 'scanning') {
      setScanSummary('扫描中 · 正在读取本地目录元数据');
    } else if (next.status === 'ready' && next.model) {
      setScanSummary(`上次扫描：刚刚 · ${nextItems.length} 个范围 · 总量 ${formatSize(next.model.scannedBytes)} · 预计可释放 ${formatSize(next.model.estimatedReclaimableBytes)}`);
    } else if (next.status === 'empty') {
      setScanSummary(`扫描完成：没有发现可展示的清理范围 · 总量 ${formatSize(next.model?.scannedBytes ?? 0)}`);
    } else if (next.status === 'error') {
      setScanSummary(`扫描失败：${next.error ?? '本地扫描未完成'}`);
    }
  };

  const toggle = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target || !target.canSelect) return;
    applyWorkflowState(workflowRef.current!.toggleSelection(id));
  };

  const inspect = (item: CleanupItem) => setInspected(item);
  const askAi = () => {
    setInspected(null);
    setToast('AI 解释会基于脱敏元数据，不会读取文件内容。');
    window.setTimeout(() => setToast(null), 3200);
  };
  const saveScanRoot = (path: string) => {
    const normalizedRoot = normalizeScanRoot(path);
    if (!isWindowsScanRoot(normalizedRoot)) {
      setToast('扫描范围必须是 Windows 路径，例如 C:\\ 或 D:\\Projects。');
      window.setTimeout(() => setToast(null), 2800);
      return;
    }
    setScanRootPath(normalizedRoot);
    setScanRoot(displayScanRoot(normalizedRoot));
    persistCleanerScanRoot(normalizedRoot);
    setToast(`扫描范围已保存：${displayScanRoot(normalizedRoot)}`);
    window.setTimeout(() => setToast(null), 2400);
  };

  const startScan = async (requestedRoot?: string) => {
    if (scanning) return;
    const scanPath = normalizeScanRoot(requestedRoot ?? scanRootPath);
    setScanning(true);
    setReviewOpen(false);
    setInspected(null);
    setToast('正在检查已知安全目录…');
    const result = await workflowRef.current!.scan(scanPath, applyWorkflowState);
    if (result.status === 'ready' && result.model) {
      persistCleanerScanRoot(scanPath);
      setToast(`扫描完成：发现 ${result.model.items.length} 个范围，预计可释放 ${formatSize(result.model.estimatedReclaimableBytes)}。`);
      window.setTimeout(() => setToast(null), 3200);
    } else if (result.status === 'empty') {
      persistCleanerScanRoot(scanPath);
      setToast('扫描完成：没有发现可展示的清理范围。');
      window.setTimeout(() => setToast(null), 3200);
    } else if (result.status === 'error') {
      setToast(`扫描失败：${result.error ?? '本地扫描未完成'}`);
      window.setTimeout(() => setToast(null), 4200);
    }
  };
  const navigate = (surface: Surface) => {
    setActiveSurface(surface);
    const url = new URL(window.location.href);
    url.searchParams.set('prototype', 'cleaner');
    url.searchParams.set('surface', surface);
    url.searchParams.delete('variant');
    window.history.replaceState({}, '', url);
  };

  return (
    <div className="cleaner-prototype-shell">
      {activeSurface === 'space' && <VariantB activeSurface={activeSurface} onNavigate={navigate} items={items} selectedIds={selectedIds} onToggle={toggle} onInspect={inspect} onReview={() => setReviewOpen(true)} scanning={scanning} onScan={startScan} onSaveScanRoot={saveScanRoot} scanRootPath={scanRootPath} scanRoot={scanRoot} totalBytes={totalBytes} scanSummary={scanSummary} workflowStatus={workflowState.status} scanError={workflowState.error} />}
      {activeSurface === 'packs' && <VariantC activeSurface={activeSurface} onNavigate={navigate} items={items} selectedIds={selectedIds} onToggle={toggle} onInspect={inspect} onReview={() => setReviewOpen(true)} scanning={scanning} onScan={startScan} onSaveScanRoot={saveScanRoot} scanRootPath={scanRootPath} scanRoot={scanRoot} totalBytes={totalBytes} scanSummary={scanSummary} workflowStatus={workflowState.status} scanError={workflowState.error} />}
      {activeSurface !== 'space' && activeSurface !== 'packs' && <VariantA activeSurface={activeSurface} onNavigate={navigate} items={items} selectedIds={selectedIds} onToggle={toggle} onInspect={inspect} onReview={() => setReviewOpen(true)} scanning={scanning} onScan={startScan} onSaveScanRoot={saveScanRoot} scanRootPath={scanRootPath} scanRoot={scanRoot} totalBytes={totalBytes} scanSummary={scanSummary} workflowStatus={workflowState.status} scanError={workflowState.error} executionLog={executionLog} />}
      {inspected && <DetailPopover item={inspected} onClose={() => setInspected(null)} onAsk={askAi} />}
      {reviewOpen && <ReviewSheet items={items} selectedIds={selectedIds} onToggle={toggle} onClose={() => setReviewOpen(false)} />}
      {toast && <div className="cleaner-prototype-toast"><Sparkles size={14} />{toast}</div>}
    </div>
  );
}
