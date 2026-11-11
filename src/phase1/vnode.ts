export const VNodeType = Object.freeze({ ELEMENT: 1, TEXT: 3 });

export type VElement = {
  type: typeof VNodeType.ELEMENT;
  tagName: string;
  props: Record<string, string>;
  children: VNode[];
};
export type VText = { type: typeof VNodeType.TEXT; value: string };
export type VNode = VElement | VText;

const htmlNamespace = 'http://www.w3.org/1999/xhtml';

export function isRenderableNode(node: Node): node is Element | Text {
  return node.nodeType === VNodeType.ELEMENT || node.nodeType === VNodeType.TEXT;
}

export function fromDOM(node: Node): VNode | undefined {
  if (node.nodeType === VNodeType.TEXT) {
    return { type: VNodeType.TEXT, value: node.nodeValue ?? '' };
  }
  if (node.nodeType === Node.COMMENT_NODE) return undefined;
  if (node.nodeType !== VNodeType.ELEMENT) {
    throw new TypeError('Unsupported DOM node type: ' + node.nodeType);
  }

  const element = node as Element;
  if (element.namespaceURI !== htmlNamespace) {
    throw new TypeError('Expected an HTML element: ' + element.localName);
  }
  const props = Object.fromEntries(Array.from(element.attributes, attr => [attr.name, attr.value]));
  const children: VNode[] = [];
  for (const child of element.childNodes) {
    const copy = fromDOM(child);
    if (copy !== undefined) children.push(copy);
  }

  return {
    type: VNodeType.ELEMENT,
    tagName: element.localName,
    props,
    children,
  };
}

export function toDOM(vnode: VNode, ownerDocument: Document = document): Element | Text {
  if (vnode.type === VNodeType.TEXT) return ownerDocument.createTextNode(vnode.value);
  if (vnode.type !== VNodeType.ELEMENT) throw new TypeError('Unsupported VNode type.');

  const element = ownerDocument.createElement(vnode.tagName);
  for (const [name, value] of Object.entries(vnode.props)) {
    element.setAttribute(name, value);
  }
  for (const child of vnode.children) {
    element.appendChild(toDOM(child, ownerDocument));
  }
  return element;
}

