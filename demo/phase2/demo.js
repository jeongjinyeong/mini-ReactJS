import { fromDOM, VNodeType } from '../../src/phase1/vnode.js';
import { defineHook, FunctionComponent, h, useEffect, useMemo, useState } from '../../src/phase2/runtime.js';

const app = document.getElementById('app');
const eventStatus = document.getElementById('event-status');
const effectStatus = document.getElementById('effect-status');
const lifecycle = document.getElementById('lifecycle');
const filters = { all: '전체', cart: '담은 과일만' };

const useCart = defineHook(function useCart() {
  const [fruit, setFruit] = useState([
    { id: 'grape', name: '포도', count: 0 },
    { id: 'apple', name: '사과', count: 1 },
    { id: 'banana', name: '바나나', count: 0 },
  ]);
  return [fruit, id => setFruit(previous => previous.map(item =>
    item.id === id ? { ...item, count: item.count + 1 } : item))];
});

function FruitRow({ name, count = 0, onAdd }) {
  return h('div', { className: 'fruit-row', role: 'listitem' },
    h('span', null, name),
    h('span', { className: 'quantity' }, count + '개'),
    h('button', { className: 'add-button', type: 'button', 'aria-label': name + ' 1개 추가', onClick: onAdd }, '+1'));
}

function CartSummary({ total }) {
  return h('p', { className: 'total' }, '총 ' + total + '개');
}

function App() {
  const [fruit, add] = useCart();
  const [filter, setFilter] = useState('all');
  const total = useMemo(() => fruit.reduce((sum, item) => sum + item.count, 0), [fruit]);

  useEffect(() => { document.title = 'mini-react · 장바구니 ' + total + '개'; });
  useEffect(() => {
    lifecycle.dataset.mounted = 'true';
    return () => { delete lifecycle.dataset.mounted; };
  }, []);
  useEffect(() => {
    const label = filters[filter];
    effectStatus.textContent = '활성 Effect · ' + label;
    return () => { effectStatus.textContent = 'Effect 정리 · ' + label; };
  }, [filter]);

  const visible = filter === 'all' ? fruit : fruit.filter(item => item.count > 0);
  return h('div', { className: 'cart' },
    h('div', { className: 'filters', role: 'group', 'aria-label': '과일 필터' },
      Object.entries(filters).map(([value, label]) =>
        h('button', {
          type: 'button',
          'data-filter': value,
          'aria-pressed': filter === value,
          onClick: () => {
            eventStatus.textContent = filter === value
              ? label + ' · 같은 값이므로 렌더링과 DOM 쓰기 0건'
              : label + ' 필터를 선택했습니다.';
            setFilter(value);
          },
        }, label))),
    h('div', { className: 'fruit-list', role: 'list', 'aria-label': '과일' },
      visible.map(({ id, name, count }) => h(FruitRow, {
        key: id,
        id,
        name,
        count,
        onAdd: () => {
          eventStatus.textContent = name + ' 1개 추가 · App에서 새 수량을 계산했습니다.';
          add(id);
        },
      }))),
    h(CartSummary, { total }));
}

const actions = {
  custom: '사용자 Hook 진입', init: '초기값 저장', read: '저장값 읽기',
  calculate: '값 계산', reuse: '저장값 재사용', keep: '기존 Effect 유지',
  run: 'DOM 반영 후 실행', cleanup: '이전 Effect 정리',
};

function create(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function describe(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === 'function' ? '[함수]' : entry);
}

function marker(text) {
  return create('mark', text, 'change-mark');
}

function showDifference(element, text, previous, active) {
  if (!active || text === previous) {
    element.textContent = text;
    return false;
  }

  let start = 0;
  let end = text.length;
  if (previous !== undefined) {
    while (start < end && start < previous.length && text[start] === previous[start]) start++;
    let oldEnd = previous.length;
    while (end > start && oldEnd > start && text[end - 1] === previous[oldEnd - 1]) {
      end--;
      oldEnd--;
    }
  }

  if (start === end) element.replaceChildren(marker(text));
  else element.replaceChildren(text.slice(0, start), marker(text.slice(start, end)), text.slice(end));
  return true;
}

function componentKey(record) {
  return record.name + ':' + (record.props.id ?? '');
}

function componentRow(record, previous, active, removed = false) {
  const li = create('li');
  const item = create('div', undefined, 'record');
  const name = create('code', record.name);
  const props = create('p', undefined, 'props');
  if (active && (!previous || removed)) {
    name.replaceChildren(marker(record.name + (removed ? ' · 제거' : ' · 추가')));
  }
  showDifference(props, describe(record.props), previous && describe(previous.props), active);
  item.append(name, props);
  li.append(item);

  const oldChildren = new Map((previous?.children ?? []).map(child => [componentKey(child), child]));
  const children = record.children.map(child => {
    const key = componentKey(child);
    const row = componentRow(child, oldChildren.get(key), active);
    oldChildren.delete(key);
    return row;
  });
  if (active) {
    for (const child of oldChildren.values()) children.push(componentRow(child, undefined, true, true));
  }
  if (children.length) {
    const list = create('ol');
    list.append(...children);
    li.append(list);
  }
  return li;
}

function snapshotMarks(changes) {
  const before = new Map();
  const after = new Map();
  function at(map, path) {
    const key = path.join('.');
    if (!map.has(key)) map.set(key, {});
    return map.get(key);
  }

  for (const change of changes) {
    const { path } = change;
    switch (change.type) {
      case 'UPDATE_TEXT':
        at(before, path).text = true;
        at(after, path).text = true;
        break;
      case 'UPDATE_PROPS': {
        const keys = new Set([...change.remove, ...Object.keys(change.set)]);
        at(before, path).props = keys;
        at(after, path).props = keys;
        break;
      }
      case 'REPLACE':
        at(before, path).branch = true;
        at(after, path).branch = true;
        break;
      case 'INSERT':
        at(before, path).children = true;
        at(after, [...path, change.index]).branch = true;
        break;
      case 'REMOVE':
        at(before, path).branch = true;
        at(after, path.slice(0, -1)).children = true;
        break;
    }
  }
  return { before, after };
}

function escapeHTML(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function renderSnapshot(id, tree, marks, declaration) {
  const target = document.getElementById(id);
  const fragment = document.createDocumentFragment();
  const html = declaration === undefined;
  const write = (text, changed = false) => fragment.append(changed ? marker(text) : text);

  function visit(node, path, depth, inherited = false) {
    const mark = marks.get(path.join('.'));
    const branch = inherited || mark?.branch;
    const indent = '  '.repeat(depth);
    write(indent);
    if (node.type === VNodeType.TEXT) {
      if (html) write(escapeHTML(node.value), branch || mark?.text);
      else {
        write('{ type: 3, value: ', branch);
        write(JSON.stringify(node.value), branch || mark?.text);
        write(' }', branch);
      }
      return;
    }

    const props = Object.entries(node.props);
    const parentChanged = mark?.children || (mark?.props && !props.some(([name]) => mark.props.has(name)));
    const header = html ? '<' + node.tagName : '{ type: 1, tagName: ' + JSON.stringify(node.tagName) + ', props: {';
    write(header, branch || parentChanged);
    props.forEach(([name, value], index) => {
      const field = html
        ? name + '="' + escapeHTML(value).replaceAll('"', '&quot;') + '"'
        : JSON.stringify(name) + ': ' + JSON.stringify(value);
      write(html ? ' ' : index ? ', ' : '');
      write(field, branch || mark?.props?.has(name));
    });
    write(html ? '>' : '}, children: [', branch || (!html && mark?.children));

    if (node.children.length) {
      write('\n');
      node.children.forEach((child, index) => {
        visit(child, [...path, index], depth + 1, branch);
        write(!html && index < node.children.length - 1 ? ',\n' : '\n');
      });
      write(indent);
    }
    write(html ? '</' + node.tagName + '>' : '] }', branch);
  }

  if (declaration) write('const ' + declaration + ' = ');
  if (tree) visit(tree, [0], 0);
  else write(html ? '빈 DOM' : 'null', marks.has(''));
  if (declaration) write(';');
  target.replaceChildren(fragment);

  const viewport = target.parentElement;
  viewport.scrollTop = 0;
  const firstChange = target.querySelector('.change-mark');
  if (firstChange) {
    viewport.scrollTop = firstChange.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 35;
  }
}

let lastDisplay;

function showRender({ phase, previous, next, changes, componentTree, log }) {
  const active = lastDisplay !== undefined;
  const components = document.getElementById('components');
  if (componentTree) {
    const list = create('ol', undefined, 'tree');
    list.append(componentRow(componentTree, lastDisplay?.componentTree, active));
    components.replaceChildren(list);
  } else {
    components.replaceChildren(create('p', '마운트된 컴포넌트 없음', 'empty change-mark'));
  }

  const changedSlots = new Set();
  const slots = instance.hooks.map(slot => {
    if (slot.hook === 'useState') return [['', describe(slot.value) ?? 'undefined']];
    const deps = describe(slot.deps) ?? '생략';
    return slot.hook === 'useMemo'
      ? [['값 ', describe(slot.value) ?? 'undefined'], [' · 의존 값 ', deps]]
      : [['의존 값 ', deps], [' · cleanup ', slot.cleanup ? '등록' : '없음']];
  });
  const hookRows = instance.hooks.map((slot, index) => {
    const row = create('li', undefined, 'record');
    const value = create('p', undefined, 'slot-data');
    slots[index].forEach(([label, text], field) => {
      const span = create('span');
      if (showDifference(span, text, lastDisplay?.slots[index]?.[field]?.[1], active)) changedSlots.add(index);
      value.append(label, span);
    });
    row.append(create('code', '#' + index + ' ' + slot.hook), value);
    return row;
  });
  if (phase === 'unmount') hookRows.push(create('li', 'Hook 저장소를 비웠습니다.', 'record change-mark'));
  document.getElementById('hooks').replaceChildren(...hookRows);

  document.getElementById('hook-log').replaceChildren(...log.map(({ hook, index, action, deps }) => {
    const text = (index === undefined ? '' : '#' + index + ' ') + hook + ' · ' + actions[action] +
      (deps?.length ? ' ' + describe(deps) : '');
    const changed = active && (changedSlots.has(index) || ['calculate', 'run', 'cleanup'].includes(action));
    const item = create('li');
    item.append(changed ? marker(text) : text);
    return item;
  }));

  const history = document.getElementById('history');
  history.textContent = '이력 ' + instance.history.length + ' / 10';
  history.classList.toggle('change-mark', active && changes.length > 0);
  const { before, after } = snapshotMarks(active ? changes : []);
  renderSnapshot('previous', previous, before, 'previousVDOM');
  renderSnapshot('next', next, after, 'nextVDOM');
  renderSnapshot('dom', app.firstChild && fromDOM(app.firstChild), after);

  const patchStatus = document.getElementById('patch-status');
  if (phase === 'mount' && !active) patchStatus.textContent = 'mount() · 초기 화면을 반영하고 첫 VDOM을 저장했습니다.';
  else if (changes.length) {
    patchStatus.replaceChildren(phase + '() · ' + changes.length + '개 작업',
      ...changes.flatMap(change => [' · ', marker(change.type + ' [' + change.path.join(', ') + ']' +
        (change.type === 'INSERT' ? ' → 자식 ' + change.index : ''))]));
  } else patchStatus.textContent = 'update() · Diff 결과 없음 · DOM 쓰기 0건';

  const effect = effectStatus.textContent;
  showDifference(effectStatus, effect, lastDisplay?.effect, active);
  lastDisplay = { componentTree, slots, effect };
  lifecycle.textContent = instance.currentTree ? '컴포넌트 제거' : '다시 마운트';
}

const instance = new FunctionComponent(App, app, { onRender: showRender });
lifecycle.addEventListener('click', () => {
  eventStatus.textContent = '';
  if (instance.currentTree) instance.unmount();
  else instance.mount();
});
instance.mount();
lifecycle.disabled = false;
