import { fromDOM, toDOM, validateKeys, VNodeType } from '../../src/phase1/vnode.js';
import { diff } from '../../src/phase1/diff.js';
import { patch } from '../../src/phase1/patch.js';

const supportedTags = new Set([
  'article', 'b', 'br', 'button', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'hr',
  'i', 'input', 'label', 'li', 'ol', 'p', 'pre', 'section', 'small', 'span', 'strong', 'ul',
]);
const commonAttributes = new Set(['id', 'class', 'title']);
const inputAttributes = new Set(['type', 'value', 'checked']);
const htmlNamespace = 'http://www.w3.org/1999/xhtml';
const historyLimit = 10;

const actual = document.getElementById('actual');
const preview = document.getElementById('preview');
const vdomCode = document.getElementById('vdom-code');
const editor = document.getElementById('editor');
const error = document.getElementById('editor-error');
const applyButton = document.getElementById('apply');
const backButton = document.getElementById('back');
const forwardButton = document.getElementById('forward');
const historyCount = document.getElementById('history-count');
const historyPosition = document.getElementById('history-position');
const result = document.getElementById('result');
const animations = new WeakMap();

const history = [fromDOM(actual.firstElementChild)];
let cursor = 0;

function validateMarkup(fragment) {
  for (const element of fragment.querySelectorAll('*')) {
    const tag = element.localName;
    if (element.namespaceURI !== htmlNamespace || !supportedTags.has(tag)) {
      throw new TypeError('지원하지 않는 태그 <' + tag + '>입니다.');
    }
    const inputType = (element.getAttribute('type') ?? 'text').toLowerCase();
    if (tag === 'input' && inputType !== 'text' && inputType !== 'checkbox') {
      throw new TypeError('input은 text와 checkbox 타입을 지원합니다.');
    }
    for (const { name } of element.attributes) {
      if (commonAttributes.has(name) || /^(data|aria)-.+$/.test(name)) continue;
      if (tag === 'input' && inputAttributes.has(name) &&
          (name !== 'checked' || inputType === 'checkbox')) continue;
      throw new TypeError('<' + tag + '>의 ' + name + ' 속성은 지원 범위 밖입니다.');
    }
  }
}

function parseDraft(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  validateMarkup(template.content);

  const wrapper = document.createElement('div');
  wrapper.appendChild(template.content);
  const comments = document.createTreeWalker(wrapper, NodeFilter.SHOW_COMMENT);
  const skipped = [];
  for (let comment = comments.nextNode(); comment; comment = comments.nextNode()) {
    skipped.push(comment);
  }
  for (const comment of skipped) comment.remove();
  wrapper.normalize();

  const tree = fromDOM(wrapper);
  validateKeys(tree);
  return tree;
}

function showError(message = '') {
  error.textContent = message;
  error.hidden = message === '';
  if (message) editor.setAttribute('aria-invalid', 'true');
  else editor.removeAttribute('aria-invalid');
}

function updateHistoryDisplay() {
  historyCount.textContent = history.length + '개';
  historyPosition.textContent = (cursor + 1) + ' / ' + history.length;
  backButton.disabled = cursor === 0;
  forwardButton.disabled = cursor === history.length - 1;
}

function formatVNode(node, depth = 0) {
  const indent = '  '.repeat(depth);
  if (node.type === VNodeType.TEXT) {
    return indent + '{ type: ' + node.type + ', value: ' + JSON.stringify(node.value) + ' }';
  }

  const key = node.key === undefined ? '' : ', key: ' + JSON.stringify(node.key);
  const children = node.children.length
    ? '[\n' + node.children.map(child => formatVNode(child, depth + 2)).join(',\n') + '\n' + indent + '  ]'
    : '[]';

  return [
    indent + '{ type: ' + node.type + ', tagName: ' + JSON.stringify(node.tagName) + key + ',',
    indent + '  props: ' + JSON.stringify(node.props) + ',',
    indent + '  children: ' + children,
    indent + '}',
  ].join('\n');
}

function showPreview(tree) {
  const root = toDOM(tree);
  vdomCode.textContent = 'const vdom = ' + formatVNode(tree) + ';';
  preview.replaceChildren(root);
  return root;
}

function serializeDraft(root) {
  const copy = root.cloneNode(true);
  for (const pre of copy.querySelectorAll('pre')) {
    const text = pre.firstChild;
    if (text?.nodeType === Node.TEXT_NODE && text.data.startsWith('\n')) {
      // The HTML parser consumes the first LF immediately inside a pre.
      text.insertData(0, '\n');
    }
  }
  // A character reference keeps CR through the textarea and HTML parser.
  return copy.innerHTML.replaceAll('\r', '&#13;');
}

function showSnapshot(tree) {
  editor.value = serializeDraft(showPreview(tree));
  showError();
}

function highlight(elements) {
  const frame = {
    outline: '2px solid #cb293f',
    outlineOffset: '2px',
    backgroundColor: 'rgba(204, 41, 63, .13)',
  };
  for (const element of elements) {
    animations.get(element)?.cancel();
    animations.set(element, element.animate([frame, frame], { duration: 2000 }));
  }
}

function report(changes, message) {
  if (!changes.length) {
    result.textContent = message;
    return;
  }
  const counts = new Map();
  for (const { type } of changes) counts.set(type, (counts.get(type) ?? 0) + 1);
  result.textContent = message + ' · ' + [...counts].map(([type, count]) => type + ' ' + count + '건').join(' · ');
}

editor.addEventListener('input', () => {
  try {
    const tree = parseDraft(editor.value);
    showPreview(tree);
    showError();
  } catch (cause) {
    showError(cause.message);
  }
});

applyButton.addEventListener('click', () => {
  try {
    const next = parseDraft(editor.value);
    const changes = diff(history[cursor], next);
    showError();
    showPreview(next);

    if (!changes.length) {
      report(changes, '적용할 변경이 없습니다.');
      return;
    }

    const affected = patch(actual, changes);
    history.splice(cursor + 1, history.length - cursor - 1, next);
    if (history.length > historyLimit) history.shift();
    cursor = history.length - 1;
    updateHistoryDisplay();
    highlight(affected);
    report(changes, '실제 영역에 반영했습니다.');
  } catch (cause) {
    showError(cause.message);
  }
});

function moveHistory(offset) {
  const position = cursor + offset;
  if (position < 0 || position >= history.length) return;

  try {
    const next = history[position];
    const changes = diff(history[cursor], next);
    const affected = changes.length ? patch(actual, changes) : [];
    cursor = position;
    showSnapshot(next);
    updateHistoryDisplay();
    highlight(affected);
    report(changes, '이력 ' + (cursor + 1) + ' 위치를 복원했습니다.');
  } catch (cause) {
    showError(cause.message);
  }
}

backButton.addEventListener('click', () => moveHistory(-1));
forwardButton.addEventListener('click', () => moveHistory(1));
showSnapshot(history[0]);
updateHistoryDisplay();
editor.disabled = false;
applyButton.disabled = false;
