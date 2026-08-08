import {
  CleanerWorkflow,
  isWindowsScanRoot,
  normalizeWindowsScanRoot,
} from '../src/cleanerWorkflow';
import { FixtureCleanerScanAdapter } from './fixtures/cleanerScanFixture';

const GB = 1024 ** 3;

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) throw new Error(message ?? `Expected ${String(actual)} to equal ${String(expected)}`);
}

function assertNotEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual === expected) throw new Error(message ?? `Expected ${String(actual)} not to equal ${String(expected)}`);
}

function assertOk(value: unknown, message?: string): asserts value {
  if (!value) throw new Error(message ?? 'Expected value to be truthy');
}

function assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message ?? 'Expected values to be deeply equal');
}

function assertMatch(value: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(value)) throw new Error(message ?? `Expected ${value} to match ${pattern}`);
}

type CleanerAssertions = {
  equal: typeof assertEqual;
  notEqual: typeof assertNotEqual;
  ok: typeof assertOk;
  deepEqual: typeof assertDeepEqual;
  match: typeof assertMatch;
};

const assert: CleanerAssertions = { equal: assertEqual, notEqual: assertNotEqual, ok: assertOk, deepEqual: assertDeepEqual, match: assertMatch };

async function validWindowsRootsNormalizeAtTheWorkflowSeam(): Promise<void> {
  assert.equal(normalizeWindowsScanRoot(' c:/ '), 'C:\\');
  assert.equal(normalizeWindowsScanRoot('D:/Projects/'), 'D:\\Projects');
  assert.equal(isWindowsScanRoot('C:\\'), true);
  assert.equal(isWindowsScanRoot('D:\\Projects'), true);
  assert.equal(isWindowsScanRoot('relative\\folder'), false);
}

async function readModelSeparatesTotalsFromEstimate(): Promise<void> {
  const workflow = new CleanerWorkflow(new FixtureCleanerScanAdapter(), () => 42);
  const state = await workflow.scan('C:\\');
  const model = state.model;

  assert.equal(state.status, 'ready');
  assert.ok(model);
  assert.equal(model.scanId, 42);
  assert.equal(model.scannedBytes, 100 * GB);
  assert.equal(model.scannedFiles, 10_000);
  assert.equal(model.totalBytes, model.scannedBytes);
  assert.ok(model.displayedDirectorySample.length > 0);
  assert.equal(model.coverage.root_totals_exact, true);
  assert.equal(model.estimatedReclaimableBytes, 4 * GB);
  assert.notEqual(model.estimatedReclaimableBytes, model.scannedBytes);
  assert.deepEqual([...state.selectedIds], ['scan:c:/users/alice/documents/wechat files']);
}

async function riskFirstReadModelPreservesBoundaries(): Promise<void> {
  const workflow = new CleanerWorkflow(new FixtureCleanerScanAdapter(), () => 7);
  const state = await workflow.scan('C:\\');
  const model = state.model;
  assert.ok(model);

  const items = model.items;
  const stable = items.find((item) => item.boundary === 'audited-scope');
  const experimental = items.find((item) => item.boundary === 'experimental-scope');
  const userContent = items.find((item) => item.boundary === 'user-content');
  const protectedPath = items.find((item) => item.boundary === 'system-protected');
  const unknown = items.find((item) => item.boundary === 'unknown');

  assert.ok(stable);
  if (!stable) return;
  assert.equal(stable.risk, 'low');
  assert.equal(stable.defaultSelected, true);
  assert.equal(stable.canSelect, true);
  assert.equal(stable.label, '可直接清理');

  assert.ok(experimental);
  if (!experimental) return;
  assert.equal(experimental.scopeStatus, 'experimental');
  assert.equal(experimental.defaultSelected, false);
  assert.equal(experimental.canSelect, false);
  assert.equal(experimental.selectionLabel, '仅建议查看');

  for (const item of [userContent, protectedPath, unknown]) {
    assert.ok(item);
    if (!item) return;
    assert.equal(item.risk, 'high');
    assert.equal(item.label, '仅建议查看');
    assert.equal(item.state, 'view-only');
    assert.equal(item.canSelect, false);
    assert.equal(item.defaultSelected, false);
  }
}

async function failedEmptyAndInvalidRescansClearState(): Promise<void> {
  const adapter = new FixtureCleanerScanAdapter();
  const transitions: string[] = [];
  const workflow = new CleanerWorkflow(adapter, () => 1);
  const first = await workflow.scan('C:\\', (snapshot) => transitions.push(snapshot.status));
  assert.equal(first.status, 'ready');
  assert.equal(first.selectedIds.size, 1);
  assert.deepEqual(transitions, ['scanning', 'ready']);

  adapter.setFailure(true);
  const failed = await workflow.scan('C:\\');
  assert.equal(failed.status, 'error');
  assert.equal(failed.model, null);
  assert.equal(failed.selectedIds.size, 0);
  assert.match(failed.error ?? '', /access denied/);

  adapter.setFailure(false);
  const empty = await workflow.scan('C:\\Empty');
  assert.equal(empty.status, 'empty');
  assert.ok(empty.model);
  if (!empty.model) return;
  assert.equal(empty.model.items.length, 0);
  assert.equal(empty.selectedIds.size, 0);

  const invalid = await workflow.scan('relative\\folder');
  assert.equal(invalid.status, 'error');
  assert.equal(invalid.model, null);
  assert.equal(invalid.selectedIds.size, 0);
  assert.equal(adapter.scannedPaths.length, 3);
}

export async function runCleanerWorkflowTests(): Promise<void> {
  const cases = [
    ['valid Windows roots normalize at the workflow seam', validWindowsRootsNormalizeAtTheWorkflowSeam],
    ['read model separates exact scan totals from sample and reclaimable estimate', readModelSeparatesTotalsFromEstimate],
    ['risk-first read model preserves stable, experimental, protected, user, and unknown boundaries', riskFirstReadModelPreservesBoundaries],
    ['failure, empty result, and invalid rescan clear prior selection and evidence', failedEmptyAndInvalidRescansClearState],
  ] as const;
  for (const [name, run] of cases) {
    await run();
    console.log(`ok - ${name}`);
  }
}
