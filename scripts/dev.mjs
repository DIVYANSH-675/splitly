import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const mobileOnly = process.argv.includes('--mobile');
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
const api = spawn(process.execPath, [resolve(root, 'server/index.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
children.push(api);
api.on('exit', (code) => stop(code || 0));
api.on('error', (error) => {
  console.error(error.message);
  stop(1);
});
let healthy = false;
for (let i = 0; i < 40 && !stopping; i++) {
  try {
    const response = await fetch('http://127.0.0.1:4310/api/health');
    if (response.ok) {
      healthy = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 150));
}
if (!healthy) stop(1);
else if (!stopping) {
  const args = ['start', '--lan', '--port', '8081', ...(!mobileOnly ? ['--web'] : [])];
  const expo = spawn(
    process.execPath,
    [resolve(root, 'mobile/node_modules/expo/bin/cli'), ...args],
    { cwd: resolve(root, 'mobile'), stdio: 'inherit' },
  );
  children.push(expo);
  expo.on('exit', (code) => stop(code || 0));
  expo.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}
