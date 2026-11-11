import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(join(testsDirectory, '..'));

const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const chrome = chromeCandidates.find(existsSync);
if (!chrome) throw new Error('Set CHROME_PATH to the installed Chrome executable.');

const temporaryRoot = realpathSync(tmpdir());
const work = mkdtempSync(join(temporaryRoot, 'mini-react-mutation-'));

function cleanup() {
  try {
    const target = realpathSync(work);
    const relativeTarget = relative(temporaryRoot, target);
    if (dirname(target) !== temporaryRoot || isAbsolute(relativeTarget) || !relativeTarget.startsWith('mini-react-mutation-')) {
      throw new Error('Unexpected mutation directory: ' + target);
    }
    rmSync(target, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
  } catch (error) {
    console.error('Cleanup warning:', error.message);
  }
}

let exitCode = 0;
try {
  const enginePath = join(root, 'src', 'phase1');
  const names = ['vnode.js', 'diff.js', 'patch.js'];
  for (const name of names) {
    if (!existsSync(join(enginePath, name))) {
      throw new Error('Missing mutation test dependency: ' + name);
    }
  }

  const importMap = JSON.stringify({
    imports: Object.fromEntries(names.map(name => [
      'mini-react/' + name, pathToFileURL(join(enginePath, name)).href,
    ])),
  });

  const activeMutant = process.env.__STRYKER_ACTIVE_MUTANT__;
  const strykerBootstrap = activeMutant !== undefined
    ? '<script>window.__stryker__ = { activeMutant: ' + JSON.stringify(activeMutant) + ' };</script>'
    : '';

  const harness = join(work, 'mutation.html');
  writeFileSync(harness, [
    '<!doctype html><html lang="ko"><head><meta charset="utf-8">',
    '<title>mini-react mutation unit tests</title>',
    '<script type="importmap">' + importMap + '</script></head><body>',
    strykerBootstrap,
    '<script type="module">',
    'import "' + pathToFileURL(join(testsDirectory, 'mutation-unit-tests.js')).href + '";',
    '</script></body></html>',
  ].join('\n'));

  const options = [
    '--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    '--no-default-browser-check', '--disable-breakpad', '--dump-dom',
    '--virtual-time-budget=10000', '--user-data-dir=' + join(work, 'chrome-mutation'),
  ];
  if (process.env.CHROME_NO_SANDBOX === '1') options.push('--no-sandbox');
  options.push('--allow-file-access-from-files');

  const run = spawnSync(chrome, [...options, pathToFileURL(harness).href], {
    encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  if (run.error) throw run.error;
  if (run.status !== 0) {
    throw new Error('Chrome exited with status ' + run.status + '. stderr:\n' + (run.stderr ?? '').slice(-2000));
  }

  const encoded = /data-mutation-report="([A-Za-z0-9+/=]+)"/.exec(run.stdout ?? '')?.[1];
  if (!encoded) {
    throw new Error('Chrome did not emit a mutation report. stdout:\n' + (run.stdout ?? '').slice(-2000));
  }
  const report = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

  console.log(report.summary);
  console.log(report.total + ' tests, ' + (report.total - report.failed) + ' passed, ' + report.failed + ' failed');
  if (report.failed) {
    exitCode = 1;
  }
} finally {
  cleanup();
}

process.exit(exitCode);
