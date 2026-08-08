import type { CleanerScanAdapter } from '../../src/cleanerWorkflow';
import type { Node, Risk, Scaffold } from '../../src/types';

const GB = 1024 ** 3;

function directory(
  name: string,
  path: string,
  size: number,
  fileCount: number,
  scaffoldId: string | null = null,
  children: Node[] = [],
): Node {
  return {
    name,
    path,
    is_dir: true,
    size,
    file_count: fileCount,
    children,
    scaffold_id: scaffoldId,
    top_extensions: [],
  };
}

function scaffold(id: string, name: string, risk: Risk): Scaffold {
  return {
    id,
    name,
    risk,
    disclaimer: 'deterministic cleaner workflow fixture',
    detect: [],
    match: {},
    scopes: [{ id: 'fixture', label: 'Fixture scope', glob: '**/*', mode: 'recycle' }],
  };
}

export const CLEANER_FIXTURE_SCAFFOLDS: Scaffold[] = [
  scaffold('wechat-pc', 'WeChat (PC)', 'low'),
  scaffold('netease-cloud-music', '网易云音乐（PC）', 'low'),
];

export const CLEANER_SCAN_FIXTURE: Node = directory('C:', 'C:\\', 100 * GB, 10_000, null, [
  directory('Windows', 'C:\\Windows', 20 * GB, 2_000, null, [
    directory('System32', 'C:\\Windows\\System32', 19 * GB, 1_900),
  ]),
  directory('alice', 'C:\\Users\\alice', 80 * GB, 7_800, null, [
    directory('Documents', 'C:\\Users\\alice\\Documents', 15 * GB, 1_200, null, [
      directory('VideoProject', 'C:\\Users\\alice\\Documents\\VideoProject', 12 * GB, 900),
    ]),
    directory('WeChat Files', 'C:\\Users\\alice\\Documents\\WeChat Files', 4 * GB, 400, 'wechat-pc'),
    directory('CloudMusic', 'C:\\Users\\alice\\AppData\\Local\\NetEase\\CloudMusic', 6 * GB, 600, 'netease-cloud-music'),
    directory('Temp', 'C:\\Users\\alice\\AppData\\Local\\Temp', 8 * GB, 800),
  ]),
]);

export const EMPTY_SCAN_FIXTURE: Node = directory('Empty', 'C:\\Empty', 0, 0);

export class FixtureCleanerScanAdapter implements CleanerScanAdapter {
  readonly scannedPaths: string[] = [];
  private shouldFail = false;

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  async scan(path: string): Promise<Node> {
    this.scannedPaths.push(path);
    if (this.shouldFail) throw new Error('fixture: access denied');
    return path.toLowerCase() === 'c:\\empty' ? EMPTY_SCAN_FIXTURE : CLEANER_SCAN_FIXTURE;
  }

  async listScaffolds(): Promise<Scaffold[]> {
    return CLEANER_FIXTURE_SCAFFOLDS;
  }
}
