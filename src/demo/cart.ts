/* Phase 2 데모: 과일 장바구니. 상태는 루트 App만 가지고 자식은 props만 받는다. */
import { FunctionComponent, h, useEffect, useMemo, useState } from "../engine/component";
import type { Child, ComponentRecord, Hook, UpdateResult } from "../engine/component";
import type { Patch } from "../engine/diff";
import { toDOM } from "../engine/dom";
import { HISTORY_LIMIT } from "../engine/history";
import type { VNode } from "../engine/vnode";
import { highlight } from "./highlight";

const PAGE_TITLE = document.title;
const FRUITS = [
  { id: "grape", name: "포도" },
  { id: "apple", name: "사과" },
  { id: "banana", name: "바나나" },
];

type Cart = { [fruitId: string]: number };

/* ───────── 컴포넌트 ───────── */

function FilterTabs({ onlyInCart, onChange }: { onlyInCart: boolean; onChange: (value: boolean) => void }): VNode {
  return h("div", { class: "tabs" },
    h("button", { type: "button", class: onlyInCart ? "tab" : "tab active", onClick: () => onChange(false) }, "전체"),
    h("button", { type: "button", class: onlyInCart ? "tab active" : "tab", onClick: () => onChange(true) }, "담은 과일만"),
  );
}

function FruitRow({ id, name, count, onAdd }: { id: string; name: string; count: number; onAdd: () => void }): VNode {
  return h("li", { key: id },
    h("span", { class: "name" }, name),
    h("span", { class: "count" }, `${count}개`),
    h("button", { type: "button", onClick: onAdd }, "+1"),
  );
}

function CartSummary({ total, unit = "개" }: { total: number; unit?: string }): VNode {
  return h("p", { class: "summary" }, `총 ${total}${unit}`);
}

function App(): VNode {
  const [cart, setCart] = useState<Cart>({ grape: 0, apple: 1, banana: 0 });
  const [onlyInCart, setOnlyInCart] = useState(false);
  const total = useMemo(() => Object.values(cart).reduce((sum, count) => sum + count, 0), [cart]);
  useEffect(() => {
    document.title = `장바구니 ${total}개`;
    return () => {
      document.title = PAGE_TITLE;
    };
  }, [total]);

  const visible = onlyInCart ? FRUITS.filter((fruit) => cart[fruit.id] > 0) : FRUITS;
  return h("div", { class: "cart" },
    h(FilterTabs, { onlyInCart, onChange: setOnlyInCart }),
    h("ul", null, visible.map((fruit) =>
      h(FruitRow, {
        id: fruit.id,
        name: fruit.name,
        count: cart[fruit.id],
        onAdd: () => setCart((previous) => ({ ...previous, [fruit.id]: previous[fruit.id] + 1 })),
      }),
    )),
    visible.length === 0 && h("p", { class: "empty" }, "담은 과일이 없습니다."),
    h(CartSummary, { total }),
  );
}

/* ───────── 검사 화면 ───────── */

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} 요소가 없다.`);
  return element;
}

const container = byId("app");
const app = new FunctionComponent(App, container);
let traces: string[] = [];
let updates = 0;

function show(value: unknown): string {
  return JSON.stringify(value, (_, item) => (typeof item === "function" ? "ƒ 함수" : item), 2) ?? String(value);
}

/* 한 줄로 짧게 보여 준다. 함수는 내용 대신 표시만 한다. */
function brief(value: unknown): string {
  return typeof value === "function" ? "ƒ()" : JSON.stringify(value) ?? String(value);
}

function fill(id: string, ...children: Child[]): void {
  byId(id).replaceChildren(...Array.from(toDOM(h("div", null, ...children)).childNodes));
}

function empty(message: string): VNode {
  return h("p", { class: "empty" }, message);
}

function componentCard(record: ComponentRecord, isRoot: boolean): VNode {
  const props = Object.entries(record.props);
  return h("li", null,
    h("div", { class: "node" },
      h("strong", null, `<${record.name}>`),
      isRoot && h("span", { class: "badge state" }, "상태 보유"),
      props.map(([name, value]) => h("span", { class: "chip" }, h("b", null, name), " ", brief(value))),
    ),
    record.children.length > 0 && h("ul", null, record.children.map((child) => componentCard(child, false))),
  );
}

function hookRow(hook: Hook, index: number): VNode {
  const name = hook.kind === "state" ? "useState" : hook.kind === "memo" ? "useMemo" : "useEffect";
  const detail =
    hook.kind === "state" ? `값 ${brief(hook.value)}`
    : hook.kind === "memo" ? `결과 ${brief(hook.value)} · 의존 값 ${brief(hook.deps)}`
    : `의존 값 ${hook.deps ? brief(hook.deps) : "없음(매번 실행)"} · cleanup ${hook.cleanup ? "있음" : "없음"}`;
  return h("li", null,
    h("span", { class: "slot" }, `hooks[${index}]`),
    h("span", { class: `badge ${hook.kind}` }, name),
    h("code", null, detail),
  );
}

function patchRow(change: Patch): VNode {
  const detail =
    change.type === "UPDATE_TEXT" ? brief(change.value)
    : change.type === "UPDATE_PROPS" || change.type === "UPDATE_HANDLERS" ? `설정 ${brief(change.set)} · 제거 ${brief(change.remove)}`
    : change.type === "INSERT" || change.type === "MOVE" ? `위치 ${change.index}`
    : "";
  return h("li", null,
    h("span", { class: `badge ${change.type.toLowerCase()}` }, change.type),
    h("span", { class: "slot" }, `경로 [${change.path.join(", ")}]`),
    detail && h("code", null, detail),
  );
}

/* 실제 DOM을 들여쓰기해서 보여 준다. 텍스트만 가진 요소는 한 줄로 둔다. */
function formatDOM(node: Node, depth = 0): string {
  const pad = "  ".repeat(depth);
  if (!(node instanceof Element)) return `${pad}${node.nodeValue}\n`;
  const children = Array.from(node.childNodes);
  if (children.every((child) => !(child instanceof Element))) return `${pad}${node.outerHTML}\n`;
  const open = (node.cloneNode(false) as Element).outerHTML.replace(/<\/[^>]+>$/, "");
  return `${pad}${open}\n${children.map((child) => formatDOM(child, depth + 1)).join("")}${pad}</${node.localName}>\n`;
}

function renderInspector(result?: UpdateResult): void {
  const { tree, hooks, history } = app;
  fill("components", tree ? h("ul", { class: "tree" }, componentCard(tree, true)) : empty("컴포넌트가 제거되었다."));
  fill("hooks", hooks.length > 0 ? h("ul", { class: "rows" }, hooks.map(hookRow)) : empty("저장된 Hook이 없다."));
  fill("trace", traces.length > 0 ? h("ol", { class: "log" }, traces.map((message) => h("li", null, message))) : empty("기록 없음"));
  /* 핸들러 교체는 렌더링마다 생기고 화면을 바꾸지 않으므로 건수만 보여 준다. */
  const visible = result?.patches.filter((change) => change.type !== "UPDATE_HANDLERS") ?? [];
  fill("patches",
    !result ? empty("아직 update가 없다. 버튼을 눌러 보자.")
    : visible.length === 0 ? empty("화면 변경 없음: DOM 쓰기 0건")
    : h("ul", { class: "rows" }, visible.map(patchRow)),
    result && h("p", { class: "hint" }, `이벤트 핸들러 교체 ${result.patches.length - visible.length}건 (화면 변경 아님)`),
  );
  byId("previous").textContent = result ? show(result.previous) : "아직 update가 없다.";
  byId("next").textContent = history ? show(history.entries[history.cursor]) : "";
  byId("dom").textContent = Array.from(container.childNodes, (node) => formatDOM(node)).join("");
  byId("status").textContent = history
    ? `이력 ${history.entries.length} / ${HISTORY_LIMIT}개 · update ${updates}회`
    : "mount되지 않음";
  byId("toggle").textContent = app.mounted ? "컴포넌트 제거" : "다시 mount";
  traces = [];
}

app.onTrace = (message) => traces.push(message);
app.onUpdate = (result) => {
  updates += 1;
  highlight(result.changed);
  renderInspector(result);
};

byId("toggle").addEventListener("click", () => {
  if (app.mounted) app.unmount();
  else app.mount();
  updates = 0;
  renderInspector();
});

app.mount();
renderInspector();
