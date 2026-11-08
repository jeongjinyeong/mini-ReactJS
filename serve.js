const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

const pages = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/demo.js', 'demo.js'],
  ['/vdom.js', 'vdom.js'],
  ['/diff.js', 'diff.js'],
  ['/patch.js', 'patch.js'],
]);

const server = createServer(async (request, response) => {
  const file = pages.get(request.url.split('?')[0]);
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }

  try {
    const contents = await readFile(join(__dirname, file));
    const type = file.endsWith('.html') ? 'text/html' : 'text/javascript';
    response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }).end(contents);
  } catch {
    response.writeHead(500).end('Could not read the demo file');
  }
});

server.listen(8000, '127.0.0.1', () => {
  console.log('http://127.0.0.1:8000');
});
