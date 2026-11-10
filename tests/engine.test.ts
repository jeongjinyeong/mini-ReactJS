/* 브라우저에서 실행하는 테스트. 개발 서버의 /tests/index.html 에서 결과를 본다. */
import { HISTORY_LIMIT, createHistory, pushHistory } from "../src/demo/history";
import { validateDraft } from "../src/demo/validate";
import { diff } from "../src/engine/diff";
import type { Patch } from "../src/engine/diff";
import { fromDOM, toDOM } from "../src/engine/dom";
import { patch } from "../src/engine/patch";
import { VNodeType, createElement as el, createText as text } from "../src/engine/vnode";
import type { Props, VNode } from "../src/engine/vnode";

const failures: string[] = [];
let count = 0;

function test(name: string, run: () => void): void {
  count += 1;
  const item = document.createElement("li");
  try {
    run();
    item.textContent = `통과 · ${name}`;
  } catch (error) {
    failures.push(name);
    item.textContent = `실패 · ${name} — ${error instanceof Error ? error.message : error}`;
    item.style.color = "#c00";
  }
  document.getElementById("results")!.appendChild(item);
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message = "값이 다르다"): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(`${message}\n기대: ${JSON.stringify(expected)}\n실제: ${JSON.stringify(actual)}`);
  }
}

function assertThrows(run: () => void, message: string): void {
  try {
    run();
  } catch {
    return;
  }
  throw new Error(message);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  );
}

/* HTML 문자열로 <div> 컨테이너를 만든다. */
function dom(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

function types(patches: Patch[]): string[] {
  return patches.map((change) => change.type);
}

/* 이전 HTML의 DOM에 diff → patch를 적용하고, 결과 DOM이 다음 트리와 같은지 확인한다. */
function applyAndCheck(container: HTMLElement, nextHtml: string): Patch[] {
  const next = fromDOM(dom(nextHtml));
  const patches = diff(fromDOM(container), next);
  patch(container, patches);
  assertEqual(fromDOM(container), next, "Patch 결과가 목표 트리와 다르다");
  return patches;
}

/* ---------- fromDOM / toDOM ---------- */

test("fromDOM: 요소·속성·텍스트를 순서대로 읽는다", () => {
  const container = dom('<button class="likes">좋아요 10</button>');
  assertEqual(fromDOM(container.firstChild!), {
    type: VNodeType.ELEMENT,
    tagName: "button",
    props: { class: "likes" },
    children: [{ type: VNodeType.TEXT, value: "좋아요 10" }],
  });
});

test("fromDOM: 공백 텍스트는 보존하고 주석은 뺀다. 원본은 그대로다", () => {
  const html = "<p>Hello <strong>Jungle</strong>!</p>\n<!-- 주석 --><br>";
  const container = dom(html);
  assertEqual(
    fromDOM(container),
    el("div", {}, [
      el("p", {}, [text("Hello "), el("strong", {}, [text("Jungle")]), text("!")]),
      text("\n"),
      el("br"),
    ]),
  );
  assertEqual(container.innerHTML, html, "원본 DOM이 바뀌었다");
});

test("fromDOM: data-key는 key로 읽고 props에는 넣지 않는다", () => {
  assertEqual(fromDOM(dom('<li data-key="post-42" id="a"></li>').firstChild!), el("li", { id: "a" }, [], "post-42"));
});

test("fromDOM: input의 현재 value와 checked를 읽는다", () => {
  const container = dom('<input value="안녕"><input type="checkbox" checked><input type="checkbox">');
  const [textInput, checkedBox] = Array.from(container.querySelectorAll("input"));
  assertEqual(fromDOM(container), el("div", {}, [
    el("input", { value: "안녕" }),
    el("input", { type: "checkbox", checked: true }),
    el("input", { type: "checkbox" }),
  ]));

  textInput.value = "정글";
  checkedBox.checked = false;
  assertEqual(fromDOM(container), el("div", {}, [
    el("input", { value: "정글" }),
    el("input", { type: "checkbox" }),
    el("input", { type: "checkbox" }),
  ]));
});

test("fromDOM: HTML이 아닌 요소는 오류다", () => {
  assertThrows(() => fromDOM(dom("<svg></svg>")), "svg를 거절하지 않았다");
});

test("toDOM: 만든 DOM을 다시 읽으면 같은 트리가 나온다", () => {
  const tree = el("div", { class: "post" }, [
    text("앞 "),
    el("ul", {}, [el("li", {}, [text("사과")], "a"), text("\n  "), el("li", {}, [], "b")]),
    el("br"),
    el("input", { value: "안녕" }),
    el("input", { type: "checkbox", checked: true }),
    text(" 뒤"),
  ]);
  const node = toDOM(tree) as HTMLElement;
  assertEqual(fromDOM(node), tree);
  assert(node.parentNode === null, "문서에 붙지 않은 노드여야 한다");
  assert(node.querySelector<HTMLInputElement>("[type=checkbox]")!.checked, "checked 프로퍼티가 설정되지 않았다");
});

/* ---------- diff ---------- */

test("diff: 같은 트리는 변경 목록이 비어 있고 입력을 수정하지 않는다", () => {
  const html = '<h2>게시글</h2><ul><li data-key="a">사과</li><li data-key="b">바나나</li></ul>';
  const previous = fromDOM(dom(html));
  const snapshot = JSON.stringify(previous);
  assertEqual(diff(previous, fromDOM(dom(html))), []);
  diff(previous, fromDOM(dom("<p>다른 내용</p>")));
  assertEqual(JSON.stringify(previous), snapshot, "이전 트리가 수정되었다");
});

test("diff: 텍스트 변경은 UPDATE_TEXT 하나다", () => {
  const patches = diff(fromDOM(dom("<h1>Hello</h1><p>World</p>")), fromDOM(dom("<h1>Hi</h1><p>World</p>")));
  assertEqual(patches, [{ type: "UPDATE_TEXT", path: [0, 0], value: "Hi" }]);
});

test("diff: 태그가 달라지면 하위 트리 전체를 REPLACE한다", () => {
  const previous = fromDOM(dom("<h2>게시글</h2><span><strong>좋아요 10</strong></span><button>좋아요</button>"));
  const next = fromDOM(dom("<h2>게시글</h2><p><strong>좋아요 10</strong></p><button>좋아요</button>"));
  assertEqual(diff(previous, next), [
    { type: "REPLACE", path: [1], node: el("p", {}, [el("strong", {}, [text("좋아요 10")])]) },
  ]);
});

test("diff: 노드 종류가 달라지면 REPLACE한다", () => {
  assertEqual(types(diff(fromDOM(dom("글자")), fromDOM(dom("<p>글자</p>")))), ["REPLACE"]);
});

test("diff: 속성 설정과 제거는 UPDATE_PROPS 하나에 담긴다", () => {
  const previous = fromDOM(dom('<p class="a" title="x" id="p">글</p>'));
  const next = fromDOM(dom('<p id="p" class="b" data-x="1">글</p>'));
  assertEqual(diff(previous, next), [
    { type: "UPDATE_PROPS", path: [0], set: { class: "b", "data-x": "1" }, remove: ["title"] },
  ]);
});

test("diff: 속성 선언 순서와 엔티티 표기만 다르면 변경이 없다", () => {
  const previous = fromDOM(dom('<p class="note" title="x">&amp;</p>'));
  const next = fromDOM(dom('<p title="x" class="note">&#38;</p>'));
  assertEqual(diff(previous, next), []);
});

test("diff: 자식 추가는 INSERT, 삭제는 REMOVE다", () => {
  const two = fromDOM(dom("<ul><li>사과</li><li>바나나</li></ul>"));
  const three = fromDOM(dom("<ul><li>사과</li><li>바나나</li><li>포도</li></ul>"));
  assertEqual(diff(two, three), [
    { type: "INSERT", path: [0], index: 2, node: el("li", {}, [text("포도")]) },
  ]);
  assertEqual(diff(three, two), [{ type: "REMOVE", path: [0, 2] }]);
});

test("diff: 자식이 0개가 되면 기존 자식을 모두 REMOVE한다", () => {
  const patches = diff(fromDOM(dom("<ul><li>1</li><li>2</li></ul>")), fromDOM(dom("<ul></ul>")));
  assertEqual(patches, [
    { type: "REMOVE", path: [0, 0] },
    { type: "REMOVE", path: [0, 1] },
  ]);
});

test("diff: key가 같은 노드의 순서 변경은 MOVE다 (A,B,C → B,C,A)", () => {
  const previous = el("ul", {}, [el("li", {}, [], "A"), el("li", {}, [], "B"), el("li", {}, [], "C")]);
  const next = el("ul", {}, [el("li", {}, [], "B"), el("li", {}, [], "C"), el("li", {}, [], "A")]);
  assertEqual(diff(previous, next), [
    { type: "MOVE", path: [1], index: 0 },
    { type: "MOVE", path: [2], index: 1 },
  ]);
});

test("diff: 새 key는 INSERT, 사라진 key는 REMOVE, 남은 key는 내부를 비교한다", () => {
  const previous = el("ul", {}, [el("li", {}, [text("a")], "A"), el("li", {}, [text("b")], "B")]);
  const next = el("ul", {}, [el("li", {}, [text("c")], "C"), el("li", {}, [text("b!")], "B")]);
  assertEqual(diff(previous, next), [
    { type: "REMOVE", path: [0] },
    { type: "INSERT", path: [], index: 0, node: el("li", {}, [text("c")], "C") },
    { type: "UPDATE_TEXT", path: [1, 0], value: "b!" },
  ]);
});

test("diff: key는 같고 태그가 다르면 REPLACE한다", () => {
  const previous = el("div", {}, [el("span", {}, [], "k")]);
  const next = el("div", {}, [el("p", {}, [], "k")]);
  assertEqual(diff(previous, next), [{ type: "REPLACE", path: [0], node: el("p", {}, [], "k") }]);
});

test("diff: 형제 사이의 key 중복은 오류다", () => {
  const unique = el("ul", {}, [el("li", {}, [], "A")]);
  const duplicated = el("ul", {}, [el("li", {}, [], "A"), el("li", {}, [], "A")]);
  assertThrows(() => diff(unique, duplicated), "새 트리의 중복 key를 거절하지 않았다");
  assertThrows(() => diff(duplicated, unique), "이전 트리의 중복 key를 거절하지 않았다");
  assertThrows(
    () => diff(el("div"), el("div", {}, [el("section", {}, [duplicated])])),
    "새로 삽입되는 하위 트리의 중복 key를 거절하지 않았다",
  );
});

test("diff: 부모가 다르면 같은 key를 써도 된다", () => {
  const tree = el("div", {}, [el("ul", {}, [el("li", {}, [], "A")]), el("ul", {}, [el("li", {}, [], "A")])]);
  assertEqual(diff(tree, tree), []);
});

/* ---------- patch ---------- */

test("patch: 텍스트 하나만 바꾸고 나머지 노드 객체는 그대로 둔다", () => {
  const container = dom("<h1>Hello</h1><p>World</p>");
  const [h1, p] = Array.from(container.children);
  const observer = new MutationObserver(() => {});
  observer.observe(container, { subtree: true, childList: true, attributes: true, characterData: true });

  applyAndCheck(container, "<h1>Hi</h1><p>World</p>");
  const records = observer.takeRecords();
  assertEqual(records.map((record) => record.type), ["characterData"]);
  assert(records[0].target === h1.firstChild, "다른 노드에 썼다");
  assert(container.children[0] === h1 && container.children[1] === p, "기존 노드가 교체되었다");

  applyAndCheck(container, "<h1>Hi</h1><p>World</p>");
  assertEqual(observer.takeRecords().length, 0, "같은 상태를 적용했는데 DOM 쓰기가 있었다");
  observer.disconnect();
});

test("patch: key로 순서를 바꾸면 기존 노드를 옮겨 재사용한다", () => {
  const container = dom('<li data-key="A">포도</li><li data-key="B">사과</li><li data-key="C">바나나</li>');
  const [a, b, c] = Array.from(container.children);
  const patches = applyAndCheck(container, '<li data-key="B">사과</li><li data-key="C">바나나</li><li data-key="A">포도</li>');
  assertEqual(types(patches), ["MOVE", "MOVE"]);
  assert(container.children[0] === b && container.children[1] === c && container.children[2] === a, "노드를 재사용하지 않았다");
});

test("patch: key 추가·삭제·이동·내용 변경을 한 번에 적용한다", () => {
  const container = dom('<li data-key="A">a</li><li data-key="B">b</li><li data-key="C">c</li><li data-key="D">d</li>');
  const [, b, , d] = Array.from(container.children);
  applyAndCheck(container, '<li data-key="D">d!</li><li data-key="X">x</li><li data-key="B">b</li>');
  assert(container.children[0] === d && container.children[2] === b, "남은 노드를 재사용하지 않았다");
});

test("patch: key가 같고 태그가 다른 노드는 옮기면서 교체한다", () => {
  const container = dom('<span data-key="A">a</span><span data-key="B">b</span>');
  const b = container.children[1];
  applyAndCheck(container, '<span data-key="B">b</span><p data-key="A">a</p>');
  assert(container.children[0] === b, "B 노드를 재사용하지 않았다");
});

test("patch: key 없는 목록의 앞에 삽입하면 기존 위치의 노드를 재사용한다", () => {
  const container = dom("<li>A</li><li>B</li>");
  const first = container.children[0];
  applyAndCheck(container, "<li>X</li><li>A</li><li>B</li>");
  assert(container.children[0] === first, "첫 번째 노드를 재사용하지 않았다");
});

test("patch: 뒤쪽 자식을 지우면서 앞쪽 자식의 깊은 텍스트를 바꾼다. 반대 방향도 된다", () => {
  const before = "<ul><li><em>하나</em></li><li>둘</li><li>셋</li></ul>";
  const after = "<ul><li><em>일</em></li></ul>";
  const container = dom(before);
  const em = container.querySelector("em");
  applyAndCheck(container, after);
  assert(container.querySelector("em") === em, "em 노드가 교체되었다");
  assertEqual(types(applyAndCheck(container, before)), ["INSERT", "INSERT", "UPDATE_TEXT"]);
});

test("patch: 실제 DOM에 주석이 섞여 있어도 대상 노드만 바꾼다", () => {
  const container = dom("<div><!-- keep --><p>Hello <strong>Jungle</strong>!</p></div>");
  const strong = container.querySelector("strong")!;
  const previous = fromDOM(container);
  const next = fromDOM(dom("<div><p>Hello <strong>Jungle</strong>?</p></div>"));
  patch(container, diff(previous, next));
  assertEqual(container.innerHTML, "<div><!-- keep --><p>Hello <strong>Jungle</strong>?</p></div>");
  assert(container.querySelector("strong") === strong, "strong 노드가 교체되었다");
});

test("patch: 사용자가 건드린 input도 value와 checked 프로퍼티가 목표 값이 된다", () => {
  const container = dom('<input value="안녕"><input type="checkbox" checked>');
  const [textInput, checkbox] = Array.from(container.querySelectorAll("input"));
  const previous = fromDOM(container);
  textInput.value = "사용자 입력";
  checkbox.checked = true;

  patch(container, diff(previous, fromDOM(dom('<input value="정글"><input type="checkbox">'))));
  assert(container.children[0] === textInput && container.children[1] === checkbox, "input이 교체되었다");
  assertEqual(textInput.value, "정글");
  assertEqual(checkbox.checked, false);

  patch(container, diff(fromDOM(container), previous));
  assertEqual(textInput.value, "안녕");
  assertEqual(checkbox.checked, true);
});

test("patch: 바뀐 DOM 노드를 반환한다", () => {
  const container = dom("<p>a</p><p>b</p>");
  const changed = patch(container, diff(fromDOM(container), fromDOM(dom('<p class="x">a</p>'))));
  assertEqual(changed.length, 2);
  assert(changed.includes(container) && changed.includes(container.children[0]), "부모와 바뀐 요소를 반환해야 한다");
});

test("patch: 임의의 트리 300쌍에서 결과가 목표 트리와 같다", () => {
  let seed = 20261109;
  const random = (limit: number): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % limit;
  };
  const randomTree = (depth: number): VNode => {
    const keys = ["a", "b", "c", "d", "e"].filter(() => random(2) === 0).sort(() => random(3) - 1);
    const children: VNode[] = [];
    const size = depth === 0 ? 0 : random(5);
    for (let i = 0; i < size; i += 1) {
      const kind = random(4);
      if (kind === 0) children.push(text(`t${random(3)}`));
      else if (kind === 1 && keys.length > 0) children.push(withKey(randomTree(depth - 1), keys.pop()!));
      else children.push(randomTree(depth - 1));
    }
    const props: Props = random(2) === 0 ? {} : { class: `c${random(2)}` };
    return el(["div", "p", "span"][random(3)], props, children);
  };
  const withKey = (node: VNode, key: string): VNode => ({ ...node, key }) as VNode;

  for (let i = 0; i < 300; i += 1) {
    const previous = el("div", {}, [randomTree(3)]);
    const next = el("div", {}, [randomTree(3)]);
    const container = toDOM(previous);
    patch(container, diff(previous, next));
    assertEqual(fromDOM(container), next, `${i}번째 쌍`);
  }
});

/* ---------- 이력 · 입력 검증 ---------- */

test("history: 명세의 A → B, C → 뒤로 → D 순서를 따른다", () => {
  const [a, b, c, d] = ["A", "B", "C", "D"].map((value) => text(value));
  const history = createHistory(a);
  assertEqual([history.entries, history.cursor], [[a], 0]);
  pushHistory(history, b);
  pushHistory(history, c);
  assertEqual([history.entries, history.cursor], [[a, b, c], 2]);
  history.cursor = 1;
  pushHistory(history, d);
  assertEqual([history.entries, history.cursor], [[a, b, d], 2]);
});

test(`history: 최대 ${HISTORY_LIMIT}개만 저장하고 오래된 것부터 버린다`, () => {
  const history = createHistory(text("0"));
  for (let i = 1; i <= HISTORY_LIMIT + 2; i += 1) pushHistory(history, text(String(i)));
  assertEqual(history.entries.length, HISTORY_LIMIT);
  assertEqual(history.cursor, HISTORY_LIMIT - 1);
  assertEqual(history.entries[0], text("3"));
});

test("validateDraft: 허용 범위 밖의 태그·속성·input 타입을 거절한다", () => {
  const check = (html: string): void => {
    const template = document.createElement("template");
    template.innerHTML = html;
    validateDraft(template.content);
  };
  check('<div id="a" class="b" data-key="k" aria-label="x"><input type="checkbox" checked><input value="v"><button>b</button></div>');
  assertThrows(() => check("<div><p><span onclick=\"x()\">a</span></p></div>"), "onclick을 거절하지 않았다");
  assertThrows(() => check("<script>1</scr" + "ipt>"), "script를 거절하지 않았다");
  assertThrows(() => check('<p style="color:red">a</p>'), "style을 거절하지 않았다");
  assertThrows(() => check('<input type="file">'), "file input을 거절하지 않았다");
  assertThrows(() => check("<input checked>"), "텍스트 input의 checked를 거절하지 않았다");
  assertThrows(() => check("<svg></svg>"), "svg를 거절하지 않았다");
});

const summary = `전체 ${count}개 · 통과 ${count - failures.length}개 · 실패 ${failures.length}개`;
document.getElementById("summary")!.textContent = summary;
document.title = summary;
