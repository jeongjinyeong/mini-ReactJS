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

/* VNode를 분리된 DOM 노드로 변환합니다. */
export function toDOM(vNode: VNode): Node {
  switch (vNode.type) {
    case "text":
      return document.createTextNode(vNode.value);
    case "element": {
      const node = document.createElement(vNode.tag);

      for (const [name, value] of Object.entries(vNode.attrs)) {
        node.setAttribute(name, value);
      }

      for (const child of vNode.children) {
        node.appendChild(toDOM(child));
      }

      // 속성의 초기값을 적용한 뒤 현재 입력 상태를 복원한다.
      if (node instanceof HTMLInputElement && vNode.input !== undefined) {
        writeInputState(node, vNode.input);
      }

      return node;
    }
    default:
      throw new Error(`Unsupported VNode: ${vNode}`);
  }
}

function writeInputState(
  input: HTMLInputElement,
  state: { value: string; checked?: boolean },
): void {
  if (input.value !== state.value) {
    input.value = state.value;
  }
  if (state.checked !== undefined && input.checked !== state.checked) {
    input.checked = state.checked;
  }
}
