import { runBrowserTests } from './run-browser-tests.mjs';

runBrowserTests('phase1', {
  'vnode.js': 'src/phase1/vnode.js',
  'diff.js': 'src/phase1/diff.js',
  'patch.js': 'src/phase1/patch.js',
});
