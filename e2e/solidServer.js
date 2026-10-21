import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export const SOLID_PORT = Number(process.env.SOLID_PORT || 3456);
export const SOLID_ISSUER = `http://localhost:${SOLID_PORT}`;

/**
 * Community Solid Server for the two-person test.
 * Memory storage, Web Access Control, no first-run prompt.
 * The public URL is localhost so Podsta will accept the addresses.
 */
export function startSolidServer() {
  const serverJs = require.resolve('@solid/community-server/bin/server.js');
  const child = spawn(
    process.execPath,
    [
      serverJs,
      '-c',
      '@css:config/default.json',
      '-b',
      `${SOLID_ISSUER}/`,
      '-p',
      String(SOLID_PORT),
      '-l',
      'warn',
    ],
    { stdio: 'inherit' },
  );
  const stop = () => {
    if (!child.killed) child.kill('SIGTERM');
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  child.on('exit', (code, signal) => {
    if (signal) process.exit(0);
    process.exit(code ?? 0);
  });
  return child;
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) startSolidServer();
