import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(),
  configFile: './vite.config.ts',
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const tests = await server.ssrLoadModule('/tests/cleanerWorkflow.test.ts');
  await tests.runCleanerWorkflowTests();
} finally {
  await server.close();
}
