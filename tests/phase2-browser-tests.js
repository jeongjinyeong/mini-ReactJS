import { defineHook, FunctionComponent, h, useEffect, useMemo, useState } from 'mini-react/runtime.js';
import { fromDOM, VNodeType } from 'mini-react/vnode.js';

const results = [];
function assert(value, label) {
  if (!value) throw new Error(label);
}
function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(label + ' · ' + JSON.stringify(actual) + ' !== ' + JSON.stringify(expected));
  }
}
function throws(action, pattern) {
  try {
    action();
  } catch (error) {
    assert(pattern.test(error.message), '예상과 다른 오류: ' + error.message);
    return;
  }
  throw new Error('예상한 오류가 발생하지 않았습니다.');
}
async function test(name, action) {
  try {
    await action();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}
function createInstance(Component, options) {
  const container = document.createElement('div');
  document.body.append(container);
  const instance = new FunctionComponent(Component, container, options);
  return { container, instance };
}
function dispose({ container, instance }) {
  instance.unmount();
  container.remove();
}
function observe(container) {
  const observer = new MutationObserver(() => {});
  observer.observe(container, { subtree: true, childList: true, characterData: true, attributes: true });
  return observer;
}

await test('h는 한 VNode로 요소·텍스트·함수형 자식과 props를 조합', () => {
  function Name({ name = '기본값' }) { return h('b', null, name); }
  const tree = h('dIv', { className: 'panel', tabIndex: 0 }, h(Name, { key: 'first' }), [false, 2, null], '!');
  equal([tree.tagName, tree.props], ['div', { class: 'panel', tabindex: '0' }], 'HTML 태그와 속성');
  equal(tree.children[0].props, { 'data-key': 'first' }, '목록 식별자');
  equal(tree.children.map(node => node.type), [VNodeType.ELEMENT, VNodeType.TEXT, VNodeType.TEXT], 'VNode 종류');
  equal(tree.children[0].children[0].value, '기본값', '자식 props 기본값');
  equal(tree.children.slice(1).map(node => node.value), ['2', '!'], '혼합 자식과 값');
  throws(() => h('div', null, h('p', { key: 'x' }), h('p', { key: 'x' })), /중복 key/);
  throws(() => h(function lower() { return tree; }), /대문자/);
});

await test('mount는 첫 VDOM을 DOM으로 반영하고 첫 스냅샷 저장', () => {
  const view = createInstance(function App() {
    const [value] = useState(3);
    return h('p', { title: '초기값' }, value);
  });
  try {
    view.instance.mount();
    equal(view.container.textContent, '3', '초기 state 반영');
    equal(fromDOM(view.container.firstChild), view.instance.currentTree, '실제 DOM과 VDOM 일치');
    assert(view.instance.history.length === 1 && view.instance.history[0] === view.instance.currentTree, '첫 스냅샷');
  } finally { dispose(view); }
});

await test('useState는 슬롯을 유지하며 함수형 Setter를 이전 값 순서로 적용', () => {
  let setCount;
  let setDelivery;
  const reports = [];
  const view = createInstance(function App() {
    const [count, countSetter] = useState(0);
    const [delivery, deliverySetter] = useState('일반');
    setCount = countSetter;
    setDelivery = deliverySetter;
    return h('p', null, count + '/' + delivery);
  }, { onRender: event => reports.push(event) });
  try {
    view.instance.mount();
    const originalSetter = setCount;
    setDelivery('빠름');
    setCount(previous => previous + 1);
    setCount(previous => previous + 1);
    equal(view.container.textContent, '2/빠름', '다른 상태를 보존한 연속 갱신');
    assert(setCount === originalSetter, 'Setter 위치와 참조');
    const observer = observe(view.container);
    setCount(2);
    assert(observer.takeRecords().length === 0 && reports.length === 4, '동일 값은 렌더링과 DOM 쓰기 없음');
    observer.disconnect();
  } finally { dispose(view); }
});

await test('별도의 FunctionComponent 인스턴스는 서로 다른 Hook 저장소 사용', () => {
  function App({ name }) {
    const [value, setValue] = useState(0);
    return h('button', { onClick: () => setValue(previous => previous + 1) }, name + value);
  }
  const left = createInstance(App, { props: { name: 'L' } });
  const right = createInstance(App, { props: { name: 'R' } });
  try {
    left.instance.mount();
    right.instance.mount();
    left.container.firstChild.click();
    equal([left.container.textContent, right.container.textContent], ['L1', 'R0'], '인스턴스 상태 격리');
  } finally { dispose(left); dispose(right); }
});

await test('Hook은 루트에서만 허용되고 이름 있는 사용자 Hook은 기본 Hook을 조합', () => {
  throws(() => useState(0), /루트/);
  throws(() => defineHook(function counter() {}), /use로/);
  const invalid = createInstance(function App() {
    function Child() { useState(0); return h('p'); }
    return h('div', null, h(Child));
  });
  try {
    throws(() => invalid.instance.mount(), /루트/);
    equal(invalid.container.childNodes.length, 0, '잘못된 렌더가 DOM에 반영되지 않음');
  } finally { dispose(invalid); }

  const useCounter = defineHook(function useCounter() {
    const [count] = useState(2);
    return useMemo(() => count * 2, [count]);
  });
  let log;
  const valid = createInstance(function App() { return h('p', null, useCounter()); },
    { onRender: event => { log = event.log; } });
  try {
    valid.instance.mount();
    equal(valid.container.textContent, '4', '사용자 Hook 결과');
    assert(log.some(entry => entry.hook === 'useCounter') && valid.instance.hooks.length === 2, '사용자 Hook 기록과 슬롯');
  } finally { dispose(valid); }
});

await test('렌더링 중 Hook 순서가 달라지면 반영 전에 거절', () => {
  let setEnabled;
  const view = createInstance(function App() {
    const [enabled, set] = useState(false);
    setEnabled = set;
    if (enabled) useMemo(() => 'conditional', []);
    return h('p', null, String(enabled));
  });
  try {
    view.instance.mount();
    throws(() => setEnabled(true), /같은 순서/);
    equal([view.container.textContent, view.instance.hooks[0].value, view.instance.history.length],
      ['false', false, 1], '실패한 렌더에서 DOM·상태·이력 유지');
  } finally { dispose(view); }
});

await test('Diff가 비어도 최신 이벤트 함수 사용, DOM 쓰기와 이력 추가 없음', () => {
  let setHidden;
  const captured = [];
  const view = createInstance(function App() {
    const [hidden, set] = useState(0);
    setHidden = set;
    return h('button', { onClick: () => captured.push(hidden) }, '확인');
  });
  try {
    view.instance.mount();
    const before = view.instance.currentTree;
    const button = view.container.firstChild;
    const observer = observe(view.container);
    setHidden(5);
    setHidden(8);
    button.click();
    assert(!button.hasAttribute('onclick'), '이벤트 함수를 HTML 속성으로 쓰지 않음');
    equal(captured, [8], '최신 함수만 한 번 실행');
    assert(observer.takeRecords().length === 0 && view.instance.currentTree === before &&
      view.instance.history.length === 1 && view.container.firstChild === button, '무변경 렌더가 실제 화면과 이력 유지');
    observer.disconnect();
  } finally { dispose(view); }
});

await test('useEffect 의존성 생략·빈 배열·값 배열과 정리 순서', () => {
  let setValue;
  const events = [];
  const view = createInstance(function App() {
    const [value, set] = useState(0);
    setValue = set;
    useEffect(() => { events.push('every:' + view.container.textContent); });
    useEffect(() => {
      events.push('mount:' + view.container.textContent);
      return () => { events.push('unmount'); };
    }, []);
    useEffect(() => {
      events.push('start:' + value + '/' + view.container.textContent);
      return () => { events.push('end:' + value + '/' + view.container.textContent); };
    }, [value]);
    return h('p', null, value);
  });
  try {
    view.instance.mount();
    view.instance.update();
    setValue(1);
    view.instance.unmount();
    equal(events, ['every:0', 'mount:0', 'start:0/0', 'every:0', 'every:1', 'end:0/1', 'start:1/1', 'unmount', 'end:1/'],
      'Effect가 반영 뒤 실행되고 이전 값으로 정리');
  } finally { dispose(view); }
});

await test('Effect가 요청한 갱신은 현재 Effect 정리를 등록한 뒤 반영', () => {
  const events = [];
  const view = createInstance(function App() {
    const [value, setValue] = useState(0);
    useEffect(() => {
      events.push('start:' + value);
      if (value === 0) setValue(1);
      return () => { events.push('end:' + value); };
    }, [value]);
    return h('p', null, value);
  });
  try {
    view.instance.mount();
    equal(view.container.textContent, '1', 'Effect Setter 적용');
    view.instance.unmount();
    equal(events, ['start:0', 'end:0', 'start:1', 'end:1'], 'Effect와 정리의 순서');
  } finally { dispose(view); }
});

await test('useMemo는 같은 의존 값을 재사용하고 바뀐 값에서 재계산', () => {
  let setValue;
  let setNote;
  let calculations = 0;
  const view = createInstance(function App() {
    const [value, changeValue] = useState(3);
    const [note, changeNote] = useState('A');
    setValue = changeValue;
    setNote = changeNote;
    const doubled = useMemo(() => { calculations++; return value * 2; }, [value]);
    return h('p', null, doubled + note);
  });
  try {
    view.instance.mount();
    setNote('B');
    equal([view.container.textContent, calculations], ['6B', 1], '다른 상태 변경 시 재사용');
    setValue(5);
    equal([view.container.textContent, calculations], ['10B', 2], '의존 값 변경 시 재계산');
  } finally { dispose(view); }
});

await test('반영 이력은 최대 10개이며 같은 값 설정으로 추가하지 않음', () => {
  let set;
  const view = createInstance(function App() {
    const [count, update] = useState(0);
    set = update;
    return h('p', null, count);
  });
  try {
    view.instance.mount();
    for (let i = 1; i <= 12; i++) set(i);
    set(12);
    equal(view.instance.history.map(node => node.children[0].value),
      ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], '가장 오래된 스냅샷 제거');
  } finally { dispose(view); }
});

await test('제거·재마운트에서 이전 Setter와 이벤트는 새 상태에 간섭하지 않음', () => {
  let setter;
  let clicks = 0;
  const view = createInstance(function App() {
    const [count, set] = useState(0);
    setter = set;
    return h('button', { onClick: () => { clicks++; set(previous => previous + 1); } }, count);
  });
  try {
    view.instance.mount();
    const stale = setter;
    const oldButton = view.container.firstChild;
    view.instance.unmount();
    view.instance.mount();
    stale(100);
    oldButton.click();
    view.container.firstChild.click();
    equal([view.container.textContent, clicks, view.instance.history.length], ['1', 1, 2], '이전 이벤트와 Setter 제거');
  } finally { dispose(view); }
});

async function demoFrame() {
  const frame = document.createElement('iframe');
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  if (appEntry.url) frame.src = appEntry.url;
  else frame.srcdoc = appEntry.html;
  document.body.append(frame);
  await loaded;
  return frame;
}

await test('장바구니 화면에서 클릭·props·VDOM·Diff와 Hook 기록이 연결', async () => {
  const frame = await demoFrame();
  try {
    const doc = frame.contentDocument;
    const app = doc.getElementById('app');
    const grapes = () => app.querySelector('[data-key="grape"]');
    assert(app.textContent.includes('사과0개') && app.querySelector('.total').textContent === '총 0개', '초기 과일과 총계');
    equal(doc.getElementById('history').textContent, '이력 1 / 10', '초기 스냅샷 표시');
    const grape = grapes();
    const button = grape.querySelector('button');
    button.click();
    button.click();
    equal([grapes().querySelector('.quantity').textContent, app.querySelector('.total').textContent],
      ['2개', '총 2개'], '클릭마다 정확히 1개 증가');
    assert(grapes() === grape && grape.querySelector('button') === button, '텍스트 패치에서 DOM 요소 재사용');
    assert(doc.getElementById('components').textContent.includes('FruitRow') &&
      doc.getElementById('components').textContent.includes('"count":2'), '자식 props 표시');
    assert(doc.getElementById('previous').textContent.includes('const previousVDOM = {') &&
      doc.getElementById('next').textContent.includes('const nextVDOM = {') &&
      doc.getElementById('dom').textContent.includes('총 2개'), '이전·새 객체 코드와 실제 DOM');
    app.querySelector('[data-key="apple"] button').click();
    app.querySelector('[data-filter="cart"]').click();
    assert(app.querySelectorAll('.fruit-row').length === 2, '담은 과일 필터');
    const log = doc.getElementById('hook-log').textContent;
    assert(log.includes('저장값 재사용') && log.includes('이전 Effect 정리') && log.includes('DOM 반영 후 실행'), '필터 변경 Hook 로그');
    const observer = observe(app);
    app.querySelector('[data-filter="cart"]').click();
    assert(observer.takeRecords().length === 0 && doc.getElementById('event-status').textContent.includes('DOM 쓰기 0건'), '같은 필터의 무변경 표시');
    observer.disconnect();

    doc.getElementById('lifecycle').click();
    assert(!app.firstChild && doc.getElementById('hook-log').textContent.includes('Effect 정리'), '제거와 Effect 정리');
    doc.getElementById('lifecycle').click();
    equal(app.querySelector('.total').textContent, '총 0개', '다시 마운트한 초기값');
  } finally { frame.remove(); }
});

await test('Phase 2는 진단 패널에만 최근 변경을 지속적으로 표시', async () => {
  const frame = await demoFrame();
  try {
    const doc = frame.contentDocument;
    const w = frame.contentWindow;
    const app = doc.getElementById('app');
    const marks = id => [...doc.querySelectorAll('#' + id + ' .change-mark')].map(node => node.textContent);
    const grape = app.querySelector('[data-key="grape"] button');
    const observer = observe(app);

    grape.click();
    assert(marks('components').includes('1') && marks('hooks').length >= 2, '변경한 자식 props와 Hook 값 강조');
    assert(marks('hook-log').some(text => text.includes('값 계산')), '실행한 Hook 강조');
    assert(marks('patch-status').every(text => text.includes('UPDATE_TEXT')) && marks('patch-status').length === 2, '변경 작업 두 건 강조');
    assert(marks('previous').includes('"0개"') && marks('previous').includes('"총 0개"'), '이전 VDOM의 값 강조');
    assert(marks('next').includes('"1개"') && marks('next').includes('"총 1개"'), '새 VDOM의 값 강조');
    assert(marks('dom').includes('1개') && marks('dom').includes('총 1개'), '실제 DOM 코드의 값 강조');
    assert(doc.getElementById('history').classList.contains('change-mark'), '저장된 이력 강조');
    const color = w.getComputedStyle(doc.querySelector('#next .change-mark')).backgroundColor.match(/\d+/g).map(Number);
    assert(color[0] > color[1] + 20, '실제 빨간색 표시');
    assert(!app.closest('.panel').querySelector('.change-mark'), '실제 화면에는 강조 없음');
    assert(observer.takeRecords().every(entry => entry.type === 'characterData'), '실제 영역에는 값만 반영');
    observer.disconnect();

    const afterClick = marks('next');
    app.querySelector('[data-filter="all"]').click();
    await new Promise(resolve => w.setTimeout(resolve, 2200));
    equal(marks('next'), afterClick, '2초가 지나거나 같은 값 클릭 뒤에도 강조 유지');

    app.querySelector('[data-filter="cart"]').click();
    assert(marks('components').includes('FruitRow · 제거') && marks('components').some(text => text.includes('바나나')), '제거된 컴포넌트 강조');
    assert(marks('previous').some(text => text.includes('바나나')), '이전 VDOM에서 제거 대상 강조');
    assert(marks('dom').some(text => text === '<div') && marks('patch-status').some(text => text.includes('REMOVE')), '새 DOM 코드에서 삭제 위치 강조');
    assert(marks('effect-status').length === 1 && marks('hook-log').some(text => text.includes('이전 Effect 정리')), '바뀐 Effect 강조');
    assert(!marks('next').includes('"총 1개"') && !app.querySelector('.change-mark'), '최근 작업으로 표시 갱신');
  } finally { frame.remove(); }
});

const report = new TextEncoder().encode(JSON.stringify(results));
document.body.dataset.testReport = btoa(String.fromCharCode(...report));
