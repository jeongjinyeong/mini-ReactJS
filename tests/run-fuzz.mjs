import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(join(testsDirectory, '..'));
const seed = Number(process.argv[2] ?? '1');
const iterations = Number(process.argv[3] ?? process.env.FUZZ_ITERATIONS ?? '300');
if (!Number.isInteger(seed) || seed < 0) {
  throw new Error('Expected non-negative integer seed.');
}
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10000) {
  throw new Error('Expected iterations between 1 and 10000.');
}

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
const work = mkdtempSync(join(temporaryRoot, 'mini-react-fuzz-'));
let report = null;

function cleanup() {
  try {
    const target = realpathSync(work);
    const relativeTarget = relative(temporaryRoot, target);
    if (dirname(target) !== temporaryRoot || isAbsolute(relativeTarget) || !relativeTarget.startsWith('mini-react-fuzz-')) {
      throw new Error('Unexpected fuzz directory: ' + target);
    }
    rmSync(target, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
  } catch (error) {
    console.error('Cleanup warning:', error.message);
  }
}

try {
  const demoPath = join(root, 'demo', 'phase1');
  const enginePath = join(root, 'src', 'phase1');
  const names = ['vnode.js', 'diff.js', 'patch.js'];
  for (const path of [
    join(demoPath, 'index.html'), join(demoPath, 'demo.js'), ...names.map(name => join(enginePath, name)),
  ]) {
    if (!existsSync(path)) {
      throw new Error('Missing fuzz entry dependency: ' + relative(root, path));
    }
  }

  const importMap = JSON.stringify({
    imports: Object.fromEntries(names.map(name => [
      'mini-react/' + name, pathToFileURL(join(enginePath, name)).href,
    ])),
  });

  const harness = join(work, 'fuzz.html');
  writeFileSync(harness, [
    '<!doctype html><html lang="ko"><head><meta charset="utf-8">',
    '<title>mini-react Phase 1 generative fuzz</title>',
    '<script type="importmap">' + importMap + '</script></head><body>',
    '<script type="module">',
    'import { execute } from "' + pathToFileURL(join(testsDirectory, 'fuzz-core.js')).href + '";',
    'const report = execute(' + seed + ', { iterations: ' + iterations + ' });',
    'document.body.setAttribute("data-fuzz-report", btoa(unescape(encodeURIComponent(JSON.stringify(report)))));',
    '</script></body></html>',
  ].join('\n'));

  const options = [
    '--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    '--no-default-browser-check', '--disable-breakpad', '--dump-dom',
    '--virtual-time-budget=60000', '--user-data-dir=' + join(work, 'chrome-fuzz'),
  ];
  if (process.env.CHROME_NO_SANDBOX === '1') options.push('--no-sandbox');
  options.push('--allow-file-access-from-files');

  const run = spawnSync(chrome, [...options, pathToFileURL(harness).href], {
    encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 16 * 1024 * 1024,
  });
  if (run.error) throw run.error;
  if (run.status !== 0) {
    throw new Error('Chrome exited with status ' + run.status + '. stderr:\n' + (run.stderr ?? '').slice(-2000));
  }

  const encoded = /data-fuzz-report="([A-Za-z0-9+/=]+)"/.exec(run.stdout ?? '')?.[1];
  if (!encoded) {
    throw new Error('Chrome did not emit a fuzz report. stdout:\n' + (run.stdout ?? '').slice(-2000));
  }
  report = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));

  function formatReport(report) {
    const lines = [
      `mode: ${report.mode}`,
      `seed: ${report.seed}`,
      `iterations: ${report.iterations}`,
      `passed: ${report.passed}`,
      `failed: ${report.failed}`,
    ];
    for (const failure of report.failures) {
      lines.push(`FAILURE iteration=${failure.iteration} oracle=${failure.oracle}`);
      for (const [key, value] of Object.entries(failure)) {
        if (key === 'iteration' || key === 'oracle') continue;
        lines.push(`  ${key}: ${value}`);
      }
    }
    return lines.join('\n');
  }

  console.log(formatReport(report));
  console.log('\n' + report.iterations + ' iterations, ' + report.passed + ' passed, ' + report.failed + ' failed');

  if (report.failed) {
    console.error('FAILING_SEED=' + seed);
    process.exitCode = 1;
  }
} finally {
  cleanup();
}
