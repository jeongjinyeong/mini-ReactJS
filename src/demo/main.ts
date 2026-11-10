import { diff } from "../engine/diff";
import { fromDOM, toDOM } from "../engine/dom";
import { patch } from "../engine/patch";
import { createElement, isElement } from "../engine/vnode";
import type { VElement, VNode } from "../engine/vnode";
import { HISTORY_LIMIT, createHistory, pushHistory } from "./history";
import { validateDraft } from "./validate";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} 요소가 없다.`);
  return element as T;
}

const actual = byId("actual");
const editor = byId<HTMLTextAreaElement>("editor");
const preview = byId("preview");
const vdomView = byId("vdom");
const errorView = byId("error");
const statusView = byId("status");
const patchButton = byId<HTMLButtonElement>("patch");
const backButton = byId<HTMLButtonElement>("back");
const forwardButton = byId<HTMLButtonElement>("forward");

/* 페이지 로드: 실제 영역을 VDOM으로 읽어 첫 이력으로 삼고, 그 VDOM으로 테스트 영역을 채운다. */
const initialTree = fromDOM(actual);
if (!isElement(initialTree)) throw new Error("실제 영역은 요소여야 한다.");
const history = createHistory(initialTree);

function currentTree(): VElement {
  return history.entries[history.cursor] as VElement;
}

/* 편집기 HTML → VDOM. 루트는 실제 영역 컨테이너와 같게 두고 자식만 초안에서 가져온다.
   분리된 template에서 파싱하므로 초안의 스크립트나 이미지는 실행·로드되지 않는다. */
function parseDraft(html: string): VNode {
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;

  /* 주석을 지우고 갈라진 텍스트를 합쳐야 "a<!-- -->b"가 이력을 왕복해도 같은 트리가 된다. */
  const comments = document.createNodeIterator(fragment, NodeFilter.SHOW_COMMENT);
  for (let comment = comments.nextNode(); comment; comment = comments.nextNode()) {
    comment.parentNode?.removeChild(comment);
  }
  fragment.normalize();

  validateDraft(fragment);
  const root = currentTree();
  return createElement(root.tagName, root.props, Array.from(fragment.childNodes, fromDOM), root.key);
}

function renderPreview(tree: VNode): void {
  preview.replaceChildren(...Array.from(toDOM(tree).childNodes));
}

function renderStatus(): void {
  const { entries, cursor } = history;
  statusView.textContent =
    `이력 ${entries.length}개 (최대 ${HISTORY_LIMIT}개) · 현재 위치 ${cursor + 1} / ${entries.length}`;
  backButton.disabled = cursor === 0;
  forwardButton.disabled = cursor === entries.length - 1;
  vdomView.textContent = JSON.stringify(currentTree(), null, 2);
}

/* 바뀐 영역을 2초 동안 빨갛게 표시한다. 애니메이션은 DOM 속성을 건드리지 않는다. */
function highlight(nodes: Node[]): void {
  const red = { backgroundColor: "rgba(255, 0, 0, 0.3)", outline: "2px solid red" };
  /* 텍스트는 부모 요소에 표시한다. 줄바꿈·들여쓰기뿐인 텍스트는 눈에 보이는 변화가 아니므로 뺀다. */
  const visible = nodes.filter((node) => node instanceof Element || node.nodeValue?.trim());
  const elements = new Set(visible.map((node) => (node instanceof Element ? node : node.parentElement)));
  for (const element of elements) element?.animate([red, red], 2000);
}

/* 선택한 이력의 VDOM으로 편집기와 미리보기를 되돌린다. */
function restoreTestArea(): void {
  editor.value = (toDOM(currentTree()) as Element).innerHTML;
  renderPreview(currentTree());
  errorView.textContent = "";
}

function showError(error: unknown): void {
  errorView.textContent = error instanceof Error ? error.message : String(error);
}

editor.addEventListener("input", () => {
  try {
    const draft = parseDraft(editor.value);
    diff(currentTree(), draft); // key 중복도 편집 중에 알려 준다.
    renderPreview(draft);
    errorView.textContent = "";
  } catch (error) {
    showError(error); // 미리보기는 마지막으로 유효했던 상태를 유지한다.
  }
});

patchButton.addEventListener("click", () => {
  let nextTree: VNode;
  let changes;
  try {
    nextTree = parseDraft(editor.value);
    changes = diff(currentTree(), nextTree);
  } catch (error) {
    showError(error);
    return;
  }
  errorView.textContent = "";
  if (changes.length === 0) return; // 실제 영역과 이력 유지

  highlight(patch(actual, changes));
  pushHistory(history, nextTree);
  renderStatus();
});

function navigate(offset: number): void {
  const target = history.cursor + offset;
  if (target < 0 || target >= history.entries.length) return;

  const changes = diff(currentTree(), history.entries[target]);
  if (changes.length > 0) highlight(patch(actual, changes));
  history.cursor = target;
  restoreTestArea();
  renderStatus();
}

backButton.addEventListener("click", () => navigate(-1));
forwardButton.addEventListener("click", () => navigate(1));

restoreTestArea();
renderStatus();
