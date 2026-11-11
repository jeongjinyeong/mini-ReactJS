import { createElement, createText, isElement, isText } from "./vnode";
import type { PropValue, Props, VNode } from "./vnode";

/* HTML에서 key를 읽고 쓰는 속성. VElement.key로 옮기고 props에는 넣지 않는다. */
export const KEY_ATTRIBUTE = "data-key";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const COMMENT_NODE = 8;

/* VDOM이 다루는 자식 목록. 주석은 VDOM에 없으므로 경로를 셀 때도 뺀다. */
export function managedChildren(parent: Node): Node[] {
  return Array.from(parent.childNodes).filter((child) => child.nodeType !== COMMENT_NODE);
}

/* 실제 DOM → VDOM. 원본 DOM은 수정하지 않는다. */
export function fromDOM(node: Node): VNode {
  if (node.nodeType === 3) return createText(node.nodeValue ?? "");
  if (node.nodeType !== 1) throw new Error(`지원하지 않는 노드 종류: ${node.nodeName}`);

  const element = node as Element;
  if (element.namespaceURI !== HTML_NAMESPACE) {
    throw new Error(`HTML 요소만 지원한다: <${element.localName}>`);
  }

  const props: Props = {};
  let key: string | undefined;
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === KEY_ATTRIBUTE) key = attribute.value;
    else props[attribute.name] = attribute.value;
  }

  /* input은 HTML 속성이 아니라 지금 화면에 보이는 프로퍼티 값을 담는다. */
  if (element.localName === "input") {
    const input = element as HTMLInputElement;
    if (input.type === "checkbox" || input.type === "radio") {
      delete props.checked;
      if (input.checked) props.checked = true;
    } else if (input.value !== "" || "value" in props) {
      props.value = input.value;
    }
  }

  return createElement(element.localName, props, managedChildren(element).map(fromDOM), key);
}

/* VDOM → 문서에 붙지 않은 새 DOM. */
export function toDOM(vnode: VNode, doc: Document = document): Node {
  if (isText(vnode)) return doc.createTextNode(vnode.value);
  if (!isElement(vnode)) throw new Error(`알 수 없는 VNode 종류: ${vnode.type}`);
  const { tagName, key, props, children } = vnode;

  const element = doc.createElement(tagName);
  if (key !== undefined) element.setAttribute(KEY_ATTRIBUTE, key);
  for (const name of Object.keys(props)) setProp(element, name, props[name]);
  for (const child of children) element.appendChild(toDOM(child, doc));
  return element;
}

/* 함수는 이벤트 핸들러 프로퍼티로, boolean은 DOM 프로퍼티로, string은 HTML 속성으로 쓴다.
   핸들러는 프로퍼티 하나에 대입하므로 다시 렌더링해도 요소당 하나만 남는다.
   input의 value는 사용자가 입력한 뒤에는 속성만 바꿔서는 화면이 바뀌지 않으므로 프로퍼티도 쓴다. */
export function setProp(element: Element, name: string, value: PropValue): void {
  if (typeof value === "function") {
    Reflect.set(element, name.toLowerCase(), value);
    return;
  }
  if (typeof value === "boolean") {
    element.toggleAttribute(name, value);
    Reflect.set(element, name, value);
    return;
  }
  element.setAttribute(name, value);
  if (name === "value" && element.localName === "input") {
    (element as HTMLInputElement).value = value;
  }
}

export function removeHandler(element: Element, name: string): void {
  Reflect.set(element, name.toLowerCase(), null);
}

export function removeProp(element: Element, name: string): void {
  element.removeAttribute(name);
  if (element.localName !== "input") return;
  if (name === "checked") (element as HTMLInputElement).checked = false;
  if (name === "value") (element as HTMLInputElement).value = "";
}
