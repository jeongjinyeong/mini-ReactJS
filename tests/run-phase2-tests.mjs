import { runBrowserTests } from './run-browser-tests.mjs';

runBrowserTests('phase2', {
  'vnode.js': 'src/phase1/vnode.js',
  'runtime.js': 'src/phase2/runtime.js',
});
