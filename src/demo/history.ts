import type { VNode } from "../engine/vnode";

export const HISTORY_LIMIT = 10;

/* entries[cursor]가 실제 영역에 마지막으로 반영된 VDOM이다. */
export interface History {
  entries: VNode[];
  cursor: number;
}

export function createHistory(initial: VNode): History {
  return { entries: [initial], cursor: 0 };
}

/* 현재 위치 뒤의 이력을 버리고 새 VDOM을 저장한다. 한도를 넘으면 가장 오래된 것을 버린다. */
export function pushHistory(history: History, tree: VNode): void {
  history.entries.length = history.cursor + 1;
  history.entries.push(tree);
  if (history.entries.length > HISTORY_LIMIT) history.entries.shift();
  history.cursor = history.entries.length - 1;
}
