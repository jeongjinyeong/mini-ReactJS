import type { VNode } from "./vnode";

export type Path = number[];

export type PatchOp =
  | { kind: "setText"; path: Path; value: string }
  | { kind: "replace"; path: Path; node: VNode }
  | { kind: "remove"; path: Path }
  | { kind: "append"; parentPath: Path; node: VNode }
  | { kind: "setAttr"; path: Path; name: string; value: string }
  | { kind: "removeAttr"; path: Path; name: string }
  | { kind: "setInput"; path: Path; value: string; checked?: boolean };

// 이전 VTree와 다음 VTree를 비교하는 순수 함수의 구현 위치.
