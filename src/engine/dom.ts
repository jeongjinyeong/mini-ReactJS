import type { VNode } from "./vnode";

/* DOM을 VNode로 변환합니다. */
export function fromDOM(node: Node): VNode | undefined {
  switch (node.nodeType) {
    case Node.COMMENT_NODE:
      return undefined;
    case Node.TEXT_NODE:
      return textToVNode(node);
    case Node.ELEMENT_NODE:
      return elementToVNode(node as Element);
    default:
      throw new Error(`Unsupported DOM node type: ${node.nodeType}`);
  }
}

function textToVNode(node: Node): VNode {
  return { type: "text", value: node.nodeValue ?? "" };
}

function elementToVNode(element: Element): VNode {
  const attrs = Object.fromEntries(
    Array.from(element.attributes).map((attr) => [attr.name, attr.value]),
  );

  const children = Array.from(element.childNodes)
    .map(fromDOM)
    .filter((child): child is VNode => child !== undefined);

  const node: VNode = {
    type: "element",
    tag: element.localName,
    attrs,
    children,
  };

  if (element.localName === "input") {
    const inputState = readInputState(element as HTMLInputElement, attrs);
    if (inputState !== undefined) {
      node.input = inputState;
    }
  }

  return node;
}

function readInputState(
  input: HTMLInputElement,
  attrs: Record<string, string>,
): { value: string; checked?: boolean } | undefined {
  const inputType = (attrs.type ?? "").toLowerCase();

  if (inputType === "" || inputType === "text") {
    return { value: input.value };
  } else if (inputType === "checkbox") {
    return { value: input.value, checked: input.checked };
  }

  return undefined;
}

/* TODO: toDOM 함수 구현 */
