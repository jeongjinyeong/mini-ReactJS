/* 브라우저에서 실행하는 테스트. 개발 서버의 /tests/index.html 에서 결과를 본다. */
import { HISTORY_LIMIT, createHistory, pushHistory } from "../src/engine/history";
import { validateDraft } from "../src/demo/validate";
import { FunctionComponent, h, useEffect, useMemo, useState } from "../src/engine/component";
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

/* ───────── Phase 2: 컴포넌트와 Hook ───────── */

async function testAsync(name: string, run: () => Promise<void>): Promise<void> {
  let failure: unknown;
  await run().catch((error: unknown) => {
    failure = error ?? new Error("실패");
  });
  test(name, () => {
    if (failure) throw failure;
  });
}

/* 예약된 update()가 끝날 때까지 기다린다. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

/* 함수(핸들러)를 뺀 VDOM. fromDOM 결과와 비교할 때 쓴다. */
function plain(tree: VNode): unknown {
  return JSON.parse(JSON.stringify(tree));
}

function mountApp(App: () => VNode): { app: FunctionComponent; container: HTMLElement; updates: () => number } {
  const container = document.createElement("div");
  const app = new FunctionComponent(App, container);
  let updates = 0;
  app.onUpdate = () => {
    updates += 1;
  };
  app.mount();
  return { app, container, updates: () => updates };
}

test("h: 문자열·숫자는 텍스트로, 배열은 펴고, null·false는 건너뛰며 key를 꺼낸다", () => {
  const tree = h("ul", { class: "list", key: "k" }, "a", 1, null, false, [h("li", null, "x"), [h("li")]]);
  assertEqual(tree, el("ul", { class: "list" }, [text("a"), text("1"), el("li", {}, [text("x")]), el("li")], "k"));
});

test("h: 컴포넌트는 props 객체를 넘겨 호출하고, 이름이 소문자로 시작하면 오류다", () => {
  function Label({ value, unit = "개" }: { value: number; unit?: string }): VNode {
    return h("span", null, `${value}${unit}`);
  }
  const lower = (): VNode => h("p");
  assertEqual(h(Label, { value: 3 }), el("span", {}, [text("3개")]));
  assertThrows(() => h(lower, {}), "소문자 컴포넌트를 거절하지 않았다");
});

test("diff/patch: 핸들러만 달라지면 UPDATE_HANDLERS 하나이고 화면 변경은 없다. 클릭하면 새 핸들러만 한 번 실행된다", () => {
  const calls: string[] = [];
  const before = h("button", { onClick: () => calls.push("이전") }, "+1");
  const after = h("button", { onClick: () => calls.push("새") }, "+1");
  const button = toDOM(before) as HTMLButtonElement;
  const patches = diff(before, after);
  assertEqual(types(patches), ["UPDATE_HANDLERS"]);
  assertEqual(patch(button, patches), []);
  button.click();
  assertEqual(calls, ["새"]);
  patch(button, diff(after, h("button", null, "+1")));
  button.click();
  assertEqual(calls, ["새"], "제거한 핸들러가 실행되었다");
});

test("mount: useState 초기값이 화면에 나오고, 첫 VDOM이 첫 이력이며 실제 DOM과 일치한다", () => {
  function Row({ name, count }: { name: string; count: number }): VNode {
    return h("li", null, `${name} ${count}개`);
  }
  function App(): VNode {
    const [count] = useState(1);
    return h("ul", null, h(Row, { name: "사과", count }));
  }
  const { app, container } = mountApp(App);
  assertEqual(container.innerHTML, "<ul><li>사과 1개</li></ul>");
  assertEqual(app.history!.entries.length, 1);
  assertEqual(fromDOM(container.firstChild!), plain(app.history!.entries[0]));
  assertEqual(app.tree, { name: "App", props: {}, children: [{ name: "Row", props: { name: "사과", count: 1 }, children: [] }] });
  assertEqual(app.hooks.map((hook) => hook.kind), ["state"]);
});

await testAsync("update: 클릭 한 번에 핸들러 한 번, update 한 번. 바뀐 텍스트만 쓰고 나머지 노드는 그대로다", async () => {
  let handled = 0;
  function App(): VNode {
    const [count, setCount] = useState(0);
    const add = (): void => {
      handled += 1;
      setCount(count + 1);
    };
    return h("div", null, h("p", null, `${count}개`), h("button", { onClick: add }, "+1"));
  }
  const { app, container, updates } = mountApp(App);
  const paragraph = container.querySelector("p")!;
  const button = container.querySelector("button")!;

  button.click();
  await flush();
  assertEqual([handled, updates(), paragraph.textContent], [1, 1, "1개"]);
  assert(container.querySelector("p") === paragraph && container.querySelector("button") === button, "노드를 재사용하지 않았다");
  assertEqual(app.history!.entries.length, 2);

  button.click(); // 다시 렌더링한 뒤에도 한 번만 실행되고 최신 상태를 본다.
  await flush();
  assertEqual([handled, updates(), paragraph.textContent], [2, 2, "2개"]);
});

await testAsync("useState: 한 핸들러에서 여러 번 바꿔도 update는 한 번이고, 함수를 넘기면 누적된다", async () => {
  function App(): VNode {
    const [count, setCount] = useState(0);
    const twiceByValue = (): void => {
      setCount(count + 1);
      setCount(count + 1);
    };
    const twiceByFunction = (): void => {
      setCount((previous) => previous + 1);
      setCount((previous) => previous + 1);
    };
    return h("div", null, h("p", null, String(count)),
      h("button", { id: "value", onClick: twiceByValue }, "값"),
      h("button", { id: "function", onClick: twiceByFunction }, "함수"));
  }
  const { container, updates } = mountApp(App);
  const click = (id: string): void => container.querySelector<HTMLButtonElement>(`#${id}`)!.click();

  click("value");
  await flush();
  assertEqual([container.querySelector("p")!.textContent, updates()], ["1", 1]);
  click("function");
  await flush();
  assertEqual([container.querySelector("p")!.textContent, updates()], ["3", 2]);
});

await testAsync("useState: 호출 순서로 상태를 구분하고, 같은 값을 넣으면 update하지 않는다", async () => {
  let setters: [(value: number) => void, (value: string) => void] | undefined;
  function App(): VNode {
    const [count, setCount] = useState(0);
    const [name, setName] = useState("익명");
    setters = [setCount, setName];
    return h("p", null, `${name} ${count}`);
  }
  const { app, container, updates } = mountApp(App);
  setters![1]("정글");
  await flush();
  assertEqual(container.textContent, "정글 0");
  assertEqual(app.hooks.map((hook) => hook.kind === "state" && hook.value), [0, "정글"]);
  setters![0](0);
  await flush();
  assertEqual(updates(), 1, "같은 값인데 update했다");
});

await testAsync("update: 상태가 달라도 VDOM이 같으면 DOM 쓰기 0건, 이력 유지. 핸들러는 최신 상태를 본다", async () => {
  const seen: number[] = [];
  let setHidden: ((value: number) => void) | undefined;
  function App(): VNode {
    const [hidden, set] = useState(0);
    setHidden = set;
    return h("button", { onClick: () => seen.push(hidden) }, "기록");
  }
  const { app, container } = mountApp(App);
  const baseline = app.history!.entries[0];
  const observer = new MutationObserver(() => {});
  observer.observe(container, { subtree: true, childList: true, attributes: true, characterData: true });

  setHidden!(7);
  await flush();
  assertEqual(observer.takeRecords().length, 0, "DOM 쓰기가 있었다");
  observer.disconnect();
  assert(app.history!.entries.length === 1 && app.history!.entries[0] === baseline, "이력이 바뀌었다");
  container.querySelector("button")!.click();
  assertEqual(seen, [7]);
});

await testAsync(`update: 이력은 최대 ${HISTORY_LIMIT}개다`, async () => {
  let setCount: ((value: number) => void) | undefined;
  function App(): VNode {
    const [count, set] = useState(0);
    setCount = set;
    return h("p", null, String(count));
  }
  const { app } = mountApp(App);
  for (let i = 1; i <= HISTORY_LIMIT + 2; i += 1) {
    setCount!(i);
    await flush();
  }
  assertEqual(app.history!.entries.length, HISTORY_LIMIT);
  assertEqual(app.history!.entries.at(-1), el("p", {}, [text(String(HISTORY_LIMIT + 2))]));
});

test("Hook 제약: 자식 컴포넌트와 렌더링 밖에서는 호출할 수 없다", () => {
  function Child(): VNode {
    const [value] = useState(0);
    return h("p", null, String(value));
  }
  function App(): VNode {
    return h("div", null, h(Child, {}));
  }
  assertThrows(() => mountApp(App), "자식 컴포넌트의 useState를 막지 않았다");
  assertThrows(() => useState(0), "렌더링 밖의 useState를 막지 않았다");
  assertThrows(() => useEffect(() => {}), "렌더링 밖의 useEffect를 막지 않았다");
  assertThrows(() => useMemo(() => 1, []), "렌더링 밖의 useMemo를 막지 않았다");
});

test("Hook 제약: 렌더링마다 호출 개수나 종류가 달라지면 오류다", () => {
  let extra = false;
  let swap = false;
  function Count(): VNode {
    useState(0);
    if (extra) useState(1);
    return h("p");
  }
  function Kind(): VNode {
    if (swap) useMemo(() => 1, []);
    else useState(0);
    return h("p");
  }
  const count = mountApp(Count).app;
  extra = true;
  assertThrows(() => count.update(), "늘어난 Hook 호출을 막지 않았다");
  const kind = mountApp(Kind).app;
  swap = true;
  assertThrows(() => kind.update(), "종류가 바뀐 Hook 호출을 막지 않았다");
});

await testAsync("사용자 정의 Hook: 내장 Hook을 호출해 만들 수 있다", async () => {
  function useCounter(initial: number): [number, () => void] {
    const [count, setCount] = useState(initial);
    const doubled = useMemo(() => count * 2, [count]);
    return [doubled, () => setCount((previous) => previous + 1)];
  }
  function App(): VNode {
    const [doubled, increase] = useCounter(1);
    return h("button", { onClick: increase }, String(doubled));
  }
  const { app, container } = mountApp(App);
  container.querySelector("button")!.click();
  await flush();
  assertEqual(container.textContent, "4");
  assertEqual(app.hooks.map((hook) => hook.kind), ["state", "memo"]);
});

await testAsync("useEffect: 의존성 배열에 따라 실행 시점이 다르다", async () => {
  const runs = { always: 0, once: 0, onCount: 0 };
  let setters: [(value: number) => void, (value: number) => void] | undefined;
  function App(): VNode {
    const [count, setCount] = useState(0);
    const [other, setOther] = useState(0);
    setters = [setCount, setOther];
    useEffect(() => void (runs.always += 1));
    useEffect(() => void (runs.once += 1), []);
    useEffect(() => void (runs.onCount += 1), [count]);
    return h("p", null, `${count} ${other}`);
  }
  mountApp(App);
  assertEqual(runs, { always: 1, once: 1, onCount: 1 }, "mount 직후");
  setters![1](1);
  await flush();
  assertEqual(runs, { always: 2, once: 1, onCount: 1 }, "의존하지 않는 상태 변경 후");
  setters![0](1);
  await flush();
  assertEqual(runs, { always: 3, once: 1, onCount: 2 }, "의존하는 상태 변경 후");
});

await testAsync("useEffect: DOM 반영 뒤에 실행하고, 이전 cleanup → 새 Effect 순서이며 제거할 때 마지막 cleanup을 실행한다", async () => {
  const log: string[] = [];
  let setCount: ((value: number) => void) | undefined;
  let container: HTMLElement | undefined;
  function App(): VNode {
    const [count, set] = useState(0);
    setCount = set;
    useEffect(() => {
      log.push(`Effect: ${count} (화면 ${container?.textContent ?? "0"})`);
      return () => log.push(`Cleanup: ${count}`);
    }, [count]);
    return h("p", null, String(count));
  }
  const mounted = mountApp(App);
  container = mounted.container;
  setCount!(1);
  await flush();
  setCount!(2);
  await flush();
  mounted.app.unmount();
  assertEqual(log, [
    "Effect: 0 (화면 0)", "Cleanup: 0", "Effect: 1 (화면 1)", "Cleanup: 1", "Effect: 2 (화면 2)", "Cleanup: 2",
  ]);
  assertEqual(container.childNodes.length, 0, "제거 뒤에도 DOM이 남았다");
  setCount!(3);
  await flush();
  assertEqual(container.childNodes.length, 0, "제거한 컴포넌트가 다시 그려졌다");
});

await testAsync("useMemo: 의존 값이 같으면 계산을 건너뛰고, 달라지면 다시 계산한다", async () => {
  let calculations = 0;
  let setters: [(value: number) => void, (value: number) => void] | undefined;
  function App(): VNode {
    const [count, setCount] = useState(2);
    const [other, setOther] = useState(0);
    setters = [setCount, setOther];
    const squared = useMemo(() => {
      calculations += 1;
      return count * count;
    }, [count]);
    return h("p", null, `${squared} ${other}`);
  }
  const { container } = mountApp(App);
  assertEqual([container.textContent, calculations], ["4 0", 1]);
  setters![1](1);
  await flush();
  assertEqual([container.textContent, calculations], ["4 1", 1]);
  setters![0](3);
  await flush();
  assertEqual([container.textContent, calculations], ["9 1", 2]);
});

const summary = `전체 ${count}개 · 통과 ${count - failures.length}개 · 실패 ${failures.length}개`;
document.getElementById("summary")!.textContent = summary;
document.title = summary;
