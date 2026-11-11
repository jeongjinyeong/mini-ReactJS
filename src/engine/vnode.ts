/* DOM의 nodeType 숫자를 그대로 쓴다. */
export enum VNodeType {
  ELEMENT = 1,
  TEXT = 3,
}

/* string은 HTML 속성, boolean은 checked 같은 DOM 프로퍼티, 함수는 이벤트 핸들러다.
   핸들러의 이름은 onClick처럼 on으로 시작하고, DOM에는 소문자 프로퍼티(onclick)로 붙인다. */
export type EventHandler = (event: Event) => void;
export type PropValue = string | boolean | EventHandler;
export type Props = { [name: string]: PropValue };

export interface VNode {
  type: VNodeType;
}

/* 제약: type은 반드시 VNodeType.ELEMENT. createElement()로 만든다. */
export interface VElement extends VNode {
  type: VNodeType.ELEMENT;
  tagName: string;
  key?: string; // 같은 부모 아래 형제 사이에서만 유일하면 된다.
  props: Props;
  children: VNode[];
}

/* 제약: type은 반드시 VNodeType.TEXT. createText()로 만든다. */
export interface VText extends VNode {
  type: VNodeType.TEXT;
  value: string;
}

export function createElement(
  tagName: string,
  props: Props = {},
  children: VNode[] = [],
  key?: string,
): VElement {
  const element: VElement = { type: VNodeType.ELEMENT, tagName, props, children };
  if (key !== undefined) element.key = key;
  return element;
}

export function createText(value: string): VText {
  return { type: VNodeType.TEXT, value };
}

export function isElement(node: VNode): node is VElement {
  return node.type === VNodeType.ELEMENT;
}

export function isText(node: VNode): node is VText {
  return node.type === VNodeType.TEXT;
}
