import { fromDOM, toDOM, VNodeType } from "mini-react/vnode.js";
import { diff } from "mini-react/diff.js";
import { patch } from "mini-react/patch.js";

const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stringify(value) {
  return JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)))
    : entry);
}

function equal(actual, expected, message) {
  assert(stringify(actual) === stringify(expected),
    message + ' (기대 ' + stringify(expected) + ', 실제 ' + stringify(actual) + ')');
}

function throws(run, message) {
  let failure;
  try {
    run();
  } catch (error) {
    failure = error;
  }
  assert(failure instanceof Error, message);
}

function element(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild;
}

function observe(node) {
  const observer = new MutationObserver(() => {});
  observer.observe(node, { attributes: true, characterData: true, childList: true, subtree: true });
  return observer;
}

function fixture(oldHTML, nextHTML) {
  const previousDOM = element(oldHTML);
  const previous = fromDOM(previousDOM);
  const next = fromDOM(element(nextHTML));
  const host = document.createElement('div');
  host.append(previousDOM);
  const changes = diff(previous, next);
  return { host, previousDOM, previous, next, changes };
}

async function test(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}

function openApp() {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.title = '독립 Phase 1 데모 테스트';
    frame.style.cssText = 'position:absolute;left:-2000px;width:1200px;height:800px';
    frame.addEventListener('load', () => resolve(frame), { once: true });
    if (appEntry.html !== undefined) frame.srcdoc = appEntry.html;
    else frame.src = appEntry.url;
    document.body.append(frame);
  });
}

async function scenario(name, run) {
  await test(name, async () => {
    const frame = await openApp();
    try {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      const get = id => doc.getElementById(id);
      const actual = get('actual');
      const preview = get('preview');
      const editor = get('editor');
      const error = get('editor-error');
      const apply = get('apply');
      const back = get('back');
      const forward = get('forward');
      assert(actual && preview && editor && apply && !apply.disabled, '데모가 초기화되어야 합니다.');

      function edit(html) {
        editor.value = html;
        editor.dispatchEvent(new win.Event('input'));
      }

      const code = () => get('vdom-code').textContent;
      const displayed = () => Function(code() + '\nreturn vdom;')();
      await run({
        win, actual, preview, editor, error, apply, back, forward, edit, code, displayed,
        applyHTML(html) { edit(html); apply.click(); },
        cursor() { return get('history-position').textContent; },
        count() { return get('history-count').textContent; },
        actualHTML() { return actual.firstElementChild.innerHTML; },
        previewHTML() { return preview.firstElementChild.innerHTML; },
      });
    } finally {
      frame.remove();
    }
  });
}

await test('FR-005 DOM → VNode → DOM에서 속성, data-key, 공백, 텍스트 종류 보존', () => {
  const original = element('<section class="card"><p data-key="intro">  앞<strong>중간</strong>\n뒤 &amp; &lt;</p><input type="checkbox" checked></section>');
  const vnode = fromDOM(original);
  equal(vnode, {
    type: VNodeType.ELEMENT,
    tagName: 'section',
    props: { class: 'card' },
    children: [{
      type: VNodeType.ELEMENT, tagName: 'p', key: 'intro', props: {},
      children: [
        { type: VNodeType.TEXT, value: '  앞' },
        { type: VNodeType.ELEMENT, tagName: 'strong', props: {}, children: [{ type: VNodeType.TEXT, value: '중간' }] },
        { type: VNodeType.TEXT, value: '\n뒤 & <' },
      ],
    }, {
      type: VNodeType.ELEMENT, tagName: 'input', props: { type: 'checkbox', checked: '' }, children: [],
    }],
  }, 'VNode shape');
  const result = toDOM(vnode);
  equal(fromDOM(result), vnode, '왕복 결과');
  assert(result !== original && result.firstChild !== original.firstChild, '새 DOM 객체');
  assert(result.querySelector('input').checked, '체크박스가 체크 상태로 렌더링되어야 합니다.');
  result.firstChild.firstChild.data = '바뀐 DOM';
  equal(vnode.children[0].children[0].value, '  앞', 'VNode는 DOM과 독립적이어야 합니다.');
});

await test('FR-006 빈 diff는 DOM을 쓰지 않고 변경된 텍스트와 속성만 갱신', () => {
  const { host, previousDOM, previous, next, changes } = fixture(
    '<section><p class="old" title="same" data-test="old">앞<strong>고정</strong></p><span>유지</span></section>',
    '<section><p title="same" data-test="new">뒤<strong>고정</strong></p><span>유지</span></section>',
  );
  const observer = observe(host);
  const paragraph = previousDOM.firstElementChild;
  const strong = paragraph.firstElementChild;
  const text = paragraph.firstChild;
  const span = previousDOM.lastElementChild;
  equal(diff(previous, fromDOM(previousDOM)), [], '같은 트리');
  patch(host, []);
  equal(observer.takeRecords().length, 0, 'no-op 쓰기 수');
  const originalTree = stringify(previous);
  equal(changes.map(change => change.type).sort(), ['UPDATE_PROPS', 'UPDATE_TEXT'], '작업 종류');
  patch(host, changes);
  const records = observer.takeRecords();
  observer.disconnect();
  equal(fromDOM(previousDOM), next, '패치 결과');
  equal(stringify(previous), originalTree, '입력 트리 불변');
  assert(paragraph === previousDOM.firstElementChild && text === paragraph.firstChild &&
    strong === paragraph.firstElementChild && span === previousDOM.lastElementChild, '재사용되는 DOM 객체');
  equal(records.filter(record => record.type === 'attributes').map(record => record.attributeName).sort(),
    ['class', 'data-test'], '달라진 속성만 쓰기');
  equal(records.filter(record => record.type === 'characterData').length, 1, '텍스트 한 번 변경');
});

await test('FR-006 INSERT와 REMOVE가 형제의 정체성과 대상 경로를 유지', () => {
  const { host, previousDOM, next, changes } = fixture(
    '<ul><li data-key="a">유지</li><li data-key="b">삭제</li><li data-key="c">옛값</li></ul>',
    '<ul><li data-key="a">유지</li><li data-key="d">삽입</li><li data-key="c">새값</li></ul>',
  );
  const [first, removed, last] = previousDOM.children;
  assert(changes.some(change => change.type === 'INSERT') && changes.some(change => change.type === 'REMOVE'),
    '삽입과 제거 작업이 있어야 합니다.');
  patch(host, changes);
  equal(fromDOM(previousDOM), next, '패치 결과');
  assert(previousDOM.firstElementChild === first && previousDOM.lastElementChild === last &&
    !removed.isConnected && removed.parentElement === null, '삭제되지 않은 형제는 재사용해야 합니다.');
  patch(host, diff(next, fromDOM(element('<ul></ul>'))));
  equal(previousDOM.childNodes.length, 0, '빈 자식 목록');
});

await test('FR-006 타입 또는 태그 변경은 하위 트리 전체 교체', () => {
  const tag = fixture(
    '<article><span data-key="post"><strong>내용</strong></span><i>유지</i></article>',
    '<article><p data-key="post"><strong>내용</strong></p><i>유지</i></article>',
  );
  const oldTag = tag.previousDOM.firstElementChild;
  const stable = tag.previousDOM.lastElementChild;
  equal(tag.changes.map(change => change.type), ['REPLACE'], '같은 key의 태그 교체 작업');
  patch(tag.host, tag.changes);
  equal(fromDOM(tag.previousDOM), tag.next, '태그 교체 결과');
  assert(tag.previousDOM.firstElementChild.firstElementChild !== oldTag.firstElementChild &&
    tag.previousDOM.lastElementChild === stable, '교체 범위');
  const type = fixture('<div>텍스트</div>', '<div><span>텍스트</span></div>');
  equal(type.changes.map(change => change.type), ['REPLACE'], '텍스트를 요소로 교체');
  patch(type.host, type.changes);
  equal(fromDOM(type.previousDOM), type.next, '타입 교체 결과');
});

await test('FR-006 루트의 삽입과 제거', () => {
  const root = fromDOM(element('<div>루트</div>'));
  const host = document.createElement('main');
  const insertion = diff(undefined, root);
  equal(insertion.map(change => change.type), ['INSERT'], '루트 삽입');
  patch(host, insertion);
  equal(fromDOM(host.firstElementChild), root, '새 루트');
  const removal = diff(root, undefined);
  equal(removal.map(change => change.type), ['REMOVE'], '루트 제거');
  patch(host, removal);
  equal(host.childNodes.length, 0, '컨테이너는 빈 상태');
});

await test('FR-007 key 목록 [A, B, C]를 [B, C, A]로 옮기며 실제 노드를 재사용', () => {
  const { host, previousDOM, next, changes } = fixture(
    '<ul><li data-key="A">포도</li><li data-key="B">사과</li><li data-key="C">바나나</li></ul>',
    '<ul><li data-key="B">사과</li><li data-key="C">바나나</li><li data-key="A">포도</li></ul>',
  );
  const [a, b, c] = previousDOM.children;
  equal(changes.map(change => change.type), ['MOVE', 'MOVE'], '명세 예시의 두 이동');
  patch(host, changes);
  assert(previousDOM.children[0] === b && previousDOM.children[1] === c && previousDOM.children[2] === a,
    '이동 뒤 DOM 정체성');
  equal(fromDOM(previousDOM), next, '최종 VNode');
});

await test('FR-007 들여쓰기 공백과 일반 형제는 key 노드 이동에서 유지', () => {
  const { host, previousDOM, next, changes } = fixture(
    '<div><i>정적</i>\n  <span data-key="A">A</span>\n  <span data-key="B">B</span>\n</div>',
    '<div><i>정적</i>\n  <span data-key="B">B</span>\n  <span data-key="A">A</span>\n</div>',
  );
  const previous = [...previousDOM.childNodes];
  const observer = observe(host);
  patch(host, changes);
  const writes = observer.takeRecords();
  observer.disconnect();
  equal(fromDOM(previousDOM), next, '공백까지 동일');
  assert([0, 1, 3, 5].every(index => previousDOM.childNodes[index] === previous[index]), '공백과 비키 형제 객체 유지');
  assert(previousDOM.childNodes[2] === previous[4] && previousDOM.childNodes[4] === previous[2], '키 객체 이동');
  assert(writes.every(write => [...write.addedNodes, ...write.removedNodes].every(node =>
    node !== previous[0] && node.nodeType !== Node.TEXT_NODE)), '이동 대상 이외 쓰기 방지');
});

await test('FR-006·007 중복 key는 오류이고 부모가 다르면 같은 key 허용', () => {
  const valid = fromDOM(element('<div><p data-key="x">A</p></div>'));
  const duplicate = fromDOM(element('<div><p data-key="x">A</p><p data-key="x">B</p></div>'));
  throws(() => diff(valid, duplicate), '새 형제의 중복 key 오류');
  throws(() => diff(duplicate, valid), '이전 형제의 중복 key 오류');
  const separateParents = fromDOM(element('<div><section><p data-key="x">A</p></section><section><p data-key="x">B</p></section></div>'));
  equal(diff(separateParents, separateParents), [], '부모가 다른 key는 허용');
});

await scenario('FR-001 초기 DOM, 편집기, VNode 객체, 첫 이력 위치가 일치', app => {
  equal(app.cursor(), '1 / 1', '초기 커서');
  equal(app.count(), '1개', '초기 스냅샷 개수');
  assert(app.back.disabled && app.forward.disabled, '양쪽 이력 경계');
  equal(app.editor.value, app.actualHTML(), '초기 편집기');
  equal(app.previewHTML(), app.actualHTML(), '초기 렌더링');
  assert(app.code().startsWith('const vdom = '), 'JS 객체 코드는 기본 화면에 있어야 합니다.');
  equal(app.displayed(), fromDOM(app.actual.firstElementChild), '표시된 JS 객체는 원본과 일치해야 합니다.');
  const details = app.preview.closest('details');
  assert(details && !details.open, '별도 렌더링 미리보기는 펼칠 수 있어야 합니다.');
  details.querySelector('summary').click();
  assert(details.open && app.preview.getBoundingClientRect().height > 0, '렌더링 미리보기 열기');
});

await scenario('FR-002 HTML 편집은 미리보기만 바꾸고 Patch가 현재 입력을 적용', app => {
  const initial = app.actualHTML();
  app.edit('<p data-key="msg" title="&quot;인용&quot;">&lt;b&gt;새 초안&lt;/b&gt;</p>');
  equal(app.actualHTML(), initial, '편집만 한 실제 화면');
  const draft = app.displayed().children[0];
  equal(draft.key, 'msg', '표시된 key');
  equal(draft.props.title, '"인용"', '속성 문자열');
  equal(draft.children[0].value, '<b>새 초안</b>', 'HTML처럼 보이는 텍스트를 데이터로 표시');
  equal(app.displayed(), fromDOM(app.preview.firstElementChild), '객체와 렌더링 일치');
  app.editor.value = '<p>이벤트 없이 바뀐 최종 입력</p>';
  app.apply.click();
  equal(app.actual.textContent, '이벤트 없이 바뀐 최종 입력', 'Patch 시점 입력');
  equal(app.previewHTML(), app.actualHTML(), '적용 후 렌더링');
  equal(app.displayed(), fromDOM(app.actual.firstElementChild), '적용 후 객체');
  equal(app.cursor(), '2 / 2', '새 스냅샷');
});

await scenario('FR-002 잘못된 태그·속성·중복 key는 실제 영역과 이력에 쓰지 않음', app => {
  const oldHTML = app.actualHTML();
  const oldPreview = app.previewHTML();
  const oldCode = app.code();
  const observer = observe(app.actual);
  for (const rejected of [
    '<svg><text>금지</text></svg>',
    '<p onclick="throw 1">금지</p>',
    '<input type="file">',
    '<ul><li data-key="x">A</li><li data-key="x">B</li></ul>',
  ]) {
    app.applyHTML(rejected);
    assert(!app.error.hidden && app.error.textContent.length > 0, '지원하지 않는 입력 오류');
    equal(app.actualHTML(), oldHTML, '실제 DOM');
    equal(app.previewHTML(), oldPreview, '마지막으로 유효한 미리보기');
    equal(app.code(), oldCode, '마지막으로 유효한 VNode 객체');
    equal(app.cursor(), '1 / 1', '이력 유지');
  }
  equal(observer.takeRecords().length, 0, '실제 영역 쓰기 없음');
  observer.disconnect();
});

await scenario('FR-002·003·008 B에서 no-op Patch는 redo를 유지하고 새 D는 C를 잘라냄', app => {
  app.applyHTML('<p>B</p>');
  app.applyHTML('<p>C</p>');
  app.back.click();
  equal(app.cursor(), '2 / 3', 'B 커서');
  assert(!app.forward.disabled, 'C로 이동 가능');
  const before = app.actual.querySelector('p');
  const observer = observe(app.actual);
  app.apply.click();
  equal(observer.takeRecords().length, 0, 'no-op DOM 변경 없음');
  observer.disconnect();
  equal(app.cursor(), '2 / 3', 'no-op은 C 이력 보존');
  app.applyHTML('<p>D</p>');
  equal(app.cursor(), '3 / 3', 'D가 새 마지막 이력');
  assert(app.forward.disabled && before === app.actual.querySelector('p'), 'redo 종료와 재사용');
  app.back.click();
  equal(app.actual.textContent, 'B', 'B 복원');
  app.forward.click();
  equal(app.actual.textContent, 'D', 'C 대신 D 복원');
});

await scenario('FR-003 유효한 이력 이동이 오류를 지우고 실제·편집기·미리보기·객체를 복원', app => {
  app.applyHTML('<p>B &amp; B</p>');
  app.applyHTML('<p>C</p>');
  app.edit('<svg></svg>');
  assert(!app.error.hidden, '잘못된 초안 표시');
  app.back.click();
  assert(app.error.hidden, '이력 이동 후 오류 해제');
  equal(app.editor.value, '<p>B &amp; B</p>', '이전 편집기 복원');
  equal(app.actualHTML(), app.previewHTML(), '이전 미리보기 복원');
  equal(app.displayed(), fromDOM(app.actual.firstElementChild), '이전 VNode 복원');
  app.forward.click();
  equal(app.editor.value, '<p>C</p>', '다음 편집기 복원');
  equal(app.actualHTML(), app.previewHTML(), '다음 미리보기 복원');
  equal(app.displayed(), fromDOM(app.actual.firstElementChild), '다음 VNode 복원');
  equal(app.count(), '3개', '이력 수 유지');
  app.forward.click();
  equal(app.cursor(), '3 / 3', '범위 밖 이동 없음');
});

await scenario('FR-003·008 pre 첫 줄바꿈 스냅샷 복원 후 같은 HTML Patch는 no-op', app => {
  app.applyHTML('<pre>\n\nleading line</pre>');
  equal(app.actual.querySelector('pre').textContent, '\nleading line', 'HTML 파싱 후 남은 선행 LF');
  app.applyHTML('<p>이후 이력</p>');
  app.back.click();
  equal(app.actual.querySelector('pre').textContent, '\nleading line', '실제 DOM의 선행 LF 복원');
  equal(app.preview.querySelector('pre').textContent, '\nleading line', '미리보기의 선행 LF 복원');
  const before = app.cursor();
  const original = app.actual.querySelector('pre').firstChild;
  const observer = observe(app.actual);
  app.apply.click();
  const writes = observer.takeRecords();
  observer.disconnect();
  equal(original.data, '\nleading line', '복원된 편집기의 재적용에서 선행 LF 유지');
  equal(writes.length, 0, '복원된 편집기 no-op');
  equal(app.cursor(), before, '이력 위치 유지');
  assert(!app.forward.disabled, '앞으로 갈 이력을 보존해야 합니다.');
});

await scenario('FR-003·008 문자 참조의 CR이 텍스트와 속성에서 이력 복원 후 유지', app => {
  app.applyHTML('<p title="a&#13;b">a&#13;b</p>');
  equal(app.actual.querySelector('p').getAttribute('title'), 'a\rb', '문자 참조 속성 값');
  equal(app.actual.textContent, 'a\rb', '문자 참조 텍스트 값');
  app.applyHTML('<p>이후 이력</p>');
  app.back.click();
  const oldPosition = app.cursor();
  const restored = app.actual.querySelector('p');
  const observer = observe(app.actual);
  app.apply.click();
  const writes = observer.takeRecords();
  observer.disconnect();
  equal(restored.getAttribute('title'), 'a\rb', '편집기 복원 후 다시 적용한 속성 값');
  equal(restored.textContent, 'a\rb', '편집기 복원 후 다시 적용한 텍스트 값');
  equal(writes.length, 0, '복원된 편집기 no-op');
  equal(app.cursor(), oldPosition, '이력 위치 유지');
  assert(!app.forward.disabled, '앞으로 갈 이력을 보존해야 합니다.');
});

await scenario('FR-004 Patch와 이력 복원 시 바뀐 실제 DOM만 2초간 빨간색 강조', app => {
  app.applyHTML('<section><p>이전</p><strong>고정</strong></section>');
  const changed = app.actual.querySelector('p');
  const stable = app.actual.querySelector('strong');
  for (const animation of [...app.actual.querySelectorAll('*')].flatMap(node => node.getAnimations())) animation.cancel();

  function assertHighlight() {
    const animation = changed.getAnimations().find(item => item.effect?.getTiming().duration === 2000);
    assert(animation, '변경 대상에는 2000ms 강조가 있어야 합니다.');
    animation.pause();
    animation.currentTime = 1000;
    const rgb = app.win.getComputedStyle(changed).outlineColor.match(/\d+/g)?.map(Number);
    assert(rgb && rgb[0] > rgb[1] && rgb[0] > rgb[2], '실제 변경 요소의 강조색은 빨간색이어야 합니다.');
    equal(stable.getAnimations().length, 0, '변경되지 않은 요소는 강조하지 않습니다.');
    animation.currentTime = 2000;
    assert(app.win.getComputedStyle(changed).outlineStyle === 'none', '2초 후 강조 종료');
  }

  app.applyHTML('<section><p>이후</p><strong>고정</strong></section>');
  assertHighlight();
  app.back.click();
  assertHighlight();
});

await scenario('FR-008 이력 10개 상한과 삭제 후 처음·마지막 이동 경계', app => {
  for (let index = 1; index <= 12; index++) app.applyHTML('<p>버전 ' + index + '</p>');
  equal(app.cursor(), '10 / 10', '한도에서 마지막 위치');
  equal(app.count(), '10개', '최대 이력 개수');
  assert(app.forward.disabled, '마지막 경계');
  for (let index = 0; index < 9; index++) app.back.click();
  equal(app.cursor(), '1 / 10', '한도에서 첫 위치');
  equal(app.actual.textContent, '버전 3', '가장 오래된 이력이 먼저 제거되어야 합니다.');
  equal(app.editor.value, '<p>버전 3</p>', '첫 이력의 HTML');
  assert(app.back.disabled, '첫 위치 경계');
});

await test('Unit: fromDOM은 주석을 제외하고 나뉜 텍스트 노드를 보존한다', () => {
  const vnode = fromDOM(element('<p>앞<!-- 중간 -->뒤</p>'));
  equal(vnode, {
    type: VNodeType.ELEMENT,
    tagName: 'p',
    props: {},
    children: [{ type: VNodeType.TEXT, value: '앞' }, { type: VNodeType.TEXT, value: '뒤' }],
  }, '주석 제외 후 텍스트 노드 경계 보존');
});

await test('Unit: toDOM은 data-key와 checkbox checked 상태를 렌더링한다', () => {
  const vnode = {
    type: VNodeType.ELEMENT,
    tagName: 'input',
    key: 'agree',
    props: { type: 'checkbox', checked: '' },
    children: [],
  };
  const dom = toDOM(vnode);
  assert(dom.tagName === 'INPUT' && dom.getAttribute('data-key') === 'agree', 'data-key 속성');
  assert(dom.checked, 'checkbox checked 상태');
  const unchecked = toDOM({ type: VNodeType.ELEMENT, tagName: 'input', props: { type: 'checkbox' }, children: [] });
  assert(!unchecked.checked, 'checked 미지정 시 해제');
});

await test('Unit: diff는 새 자식 목록이 비면 기존 자식을 모두 REMOVE한다', () => {
  const previous = fromDOM(element('<ul><li data-key="a">A</li><li>B</li></ul>'));
  const next = fromDOM(element('<ul></ul>'));
  const changes = diff(previous, next);
  equal(changes.map(change => change.type), ['REMOVE', 'REMOVE'], '모든 자식 제거');
});

await test('Unit: diff는 속성 추가·변경·삭제를 정확히 분류한다', () => {
  const previous = fromDOM(element('<p id="x" class="old" title="keep">text</p>'));
  const next = fromDOM(element('<p id="y" title="keep" data-a="new">text</p>'));
  const changes = diff(previous, next);
  equal(changes.length, 1, '속성 변경 하나');
  const props = changes[0];
  equal(props.type, 'UPDATE_PROPS');
  equal(props.set, { id: 'y', 'data-a': 'new' }, '추가·변경');
  equal(props.remove, ['class'], '삭제');
});

await test('Unit: patch는 존재하지 않는 경로에서 오류를 던진다', () => {
  const host = document.createElement('div');
  host.appendChild(element('<p></p>'));
  throws(() => patch(host, [{ type: 'UPDATE_TEXT', path: [0, 5], value: 'x' }]), '없는 자식 경로');
  throws(() => patch(host, [{ type: 'REMOVE', path: [2] }]), '없는 루트 경로');
});

await test('Integration: keyed 이동과 텍스트 갱신을 diff·patch로 한 번에 반영', () => {
  const { host, previousDOM, next, changes } = fixture(
    '<ul><li data-key="a">A</li><li data-key="b">B</li></ul>',
    '<ul><li data-key="b">B2</li><li data-key="a">A</li></ul>',
  );
  const b = previousDOM.children[1];
  equal(changes.map(change => change.type), ['MOVE', 'UPDATE_TEXT'], '이동과 텍스트 갱신');
  patch(host, changes);
  equal(fromDOM(previousDOM), next, '최종 VNode 일치');
  assert(previousDOM.children[0] === b, 'b 노드 재사용');
});

await test('Integration: 속성 추가·삭제·교체를 diff·patch로 반영하고 DOM 객체를 재사용한다', () => {
  const { host, previousDOM, next, changes } = fixture(
    '<section><p class="old" id="x">text</p></section>',
    '<section><p id="y" data-a="1">text</p></section>',
  );
  const paragraph = previousDOM.firstElementChild;
  equal(changes.map(change => change.type), ['UPDATE_PROPS'], '속성 변경 작업');
  patch(host, changes);
  equal(fromDOM(previousDOM), next, '패치 결과');
  assert(previousDOM.firstElementChild === paragraph, '요소 객체 재사용');
  assert(paragraph.getAttribute('class') === null, '삭제된 속성');
  assert(paragraph.getAttribute('id') === 'y' && paragraph.getAttribute('data-a') === '1', '변경·추가된 속성');
});

await scenario('FR-002 checkbox input의 checked 상태가 Patch 후에도 반영된다', app => {
  app.applyHTML('<label><input type="checkbox" checked> 동의</label>');
  const input = app.actual.querySelector('input');
  assert(input.checked, '초기 checked 상태');
  app.applyHTML('<label><input type="checkbox"> 동의</label>');
  const after = app.actual.querySelector('input');
  assert(!after.checked, 'checked 제거 반영');
});

await scenario('FR-002 빈 입력과 여러 최상위 노드도 파싱되어 Patch된다', app => {
  app.applyHTML('');
  equal(app.actual.firstElementChild.innerHTML, '', '빈 입력은 루트 div를 비움');
  equal(app.cursor(), '2 / 2', '빈 입력도 이력에 저장');
  app.applyHTML('<p>A</p><span>B</span>');
  equal(app.actual.firstElementChild.children.length, 2, '두 최상위 노드');
  equal(app.actual.firstElementChild.children[0].tagName, 'P');
  equal(app.actual.firstElementChild.children[1].tagName, 'SPAN');
});

await scenario('FR-002 aria-invalid와 오류 표시가 유효성 상태를 반영한다', app => {
  app.edit('<p>valid</p>');
  assert(!app.editor.hasAttribute('aria-invalid'), '유효 입력 시 aria-invalid 제거');
  assert(app.error.hidden, '유효 입력 시 오류 숨김');
  app.apply.click();
  equal(app.actual.textContent, 'valid', '유효 입력 적용');
  const validPreview = app.previewHTML();
  app.edit('<svg></svg>');
  assert(app.editor.getAttribute('aria-invalid') === 'true', '오류 시 aria-invalid');
  assert(!app.error.hidden, '무효 입력 시 오류 표시');
  equal(app.previewHTML(), validPreview, '무효 입력은 마지막 유효 미리보기 유지');
  app.edit('<p>valid again</p>');
  assert(!app.editor.hasAttribute('aria-invalid'), '다시 유효해지면 aria-invalid 제거');
  assert(app.error.hidden, '복구 후 오류 숨김');
  equal(app.preview.textContent, 'valid again', '복구 후 미리보기 갱신');
});

const encoded = new TextEncoder().encode(JSON.stringify(results));
document.body.dataset.testReport = btoa(String.fromCharCode(...encoded));
