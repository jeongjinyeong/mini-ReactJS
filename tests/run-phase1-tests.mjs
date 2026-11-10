import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] ?? join(testsDirectory, '..'));
const requestedMode = process.argv[3] ?? 'all';
if (!['all', 'standalone', 'modules'].includes(requestedMode)) {
  throw new Error('Expected test mode all, standalone, or modules.');
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
const work = mkdtempSync(join(temporaryRoot, 'mini-react-phase1-'));
const demoPath = join(root, 'demo', 'phase1');
const enginePath = join(root, 'src', 'phase1');
const browserTests = readFileSync(join(testsDirectory, 'phase1-browser-tests.js'), 'utf8');
const modes = requestedMode === 'all' ? ['standalone', 'modules'] : [requestedMode];

function describeEntry(mode) {
  if (mode === 'standalone') {
    const html = readFileSync(join(demoPath, 'demo.html'), 'utf8');
    const importMap = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (!importMap) throw new Error('The offline demo does not contain an import map.');
    return { importMap, app: { html } };
  }

  const names = ['vnode.js', 'diff.js', 'patch.js'];
  for (const path of [
    join(demoPath, 'index.html'), join(demoPath, 'demo.js'), ...names.map(name => join(enginePath, name)),
  ]) {
    if (!existsSync(path)) throw new Error('Missing module entry dependency: ' + relative(root, path));
  }

  return {
    importMap: JSON.stringify({ imports: Object.fromEntries(names.map(name => [
      'mini-react/' + name, pathToFileURL(join(enginePath, name)).href,
    ])) }),
    app: { url: pathToFileURL(join(demoPath, 'index.html')).href },
  };
}

function test(mode) {
  const { importMap, app } = describeEntry(mode);
  const harness = join(work, mode + '.html');
  const entry = JSON.stringify(app).replaceAll('<', '\\u003c');
  writeFileSync(harness, [
    '<!doctype html><html lang="ko"><head><meta charset="utf-8">',
    '<title>mini-react Phase 1 browser tests</title>',
    '<script type="importmap">' + importMap + '</script></head><body>',
    '<script type="module">',
    'const appEntry = ' + entry + ';',
    browserTests,
    '</script></body></html>',
  ].join('\n'));

  const options = [
    '--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
    '--no-default-browser-check', '--disable-breakpad', '--dump-dom',
    '--virtual-time-budget=20000', '--user-data-dir=' + join(work, 'chrome-' + mode),
  ];
  if (process.env.CHROME_NO_SANDBOX === '1') options.push('--no-sandbox');
  if (mode === 'modules') options.push('--allow-file-access-from-files');
  const run = spawnSync(chrome, [...options, pathToFileURL(harness).href], {
    encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 8 * 1024 * 1024,
  });
  if (run.error) throw run.error;
  const report = /data-test-report="([A-Za-z0-9+/=]+)"/.exec(run.stdout ?? '')?.[1];
  if (run.status !== 0 || !report) {
    throw new Error('Chrome did not complete the suite. ' + (run.stderr ?? '').trim().slice(-1000));
  }
  const results = JSON.parse(Buffer.from(report, 'base64').toString('utf8'));
  for (const result of results) {
    console.log((result.passed ? 'PASS ' : 'FAIL ') + result.name + (result.error ? ' — ' + result.error : ''));
  }
  const failed = results.filter(result => !result.passed).length;
  console.log(results.length + ' tests, ' + (results.length - failed) + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
}

try {
  for (const mode of modes) {
    console.log('\n[' + mode + ']');
    try {
      test(mode);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
} finally {
  const target = realpathSync(work);
  const relativeTarget = relative(temporaryRoot, target);
  if (dirname(target) !== temporaryRoot || isAbsolute(relativeTarget) || !relativeTarget.startsWith('mini-react-phase1-')) {
    throw new Error('Unexpected test directory: ' + target);
  }
  rmSync(target, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
}
