export const VNodeType = Object.freeze({ ELEMENT: 1, TEXT: 3 });

/** @typedef {{ type: 1, tagName: string, props: Record<string, string>, children: VNode[] }} VElement */
/** @typedef {{ type: 3, value: string }} VText */
/** @typedef {VElement | VText} VNode */

const htmlNamespace = 'http://www.w3.org/1999/xhtml';

/** @param {Node} node */
export function isRenderableNode(node) {
  return node.nodeType === VNodeType.ELEMENT || node.nodeType === VNodeType.TEXT;
}

/** @param {Node} node @returns {VNode | undefined} */
export function fromDOM(node) {
  if (node.nodeType === VNodeType.TEXT) {
    return { type: VNodeType.TEXT, value: node.nodeValue ?? '' };
  }
  if (node.nodeType === Node.COMMENT_NODE) return undefined;
  if (node.nodeType !== VNodeType.ELEMENT) {
    throw new TypeError('Unsupported DOM node type: ' + node.nodeType);
  }

  const element = /** @type {Element} */ (node);
  if (element.namespaceURI !== htmlNamespace) {
    throw new TypeError('Expected an HTML element: ' + element.localName);
  }
  const props = Object.fromEntries(Array.from(element.attributes, attr => [attr.name, attr.value]));
  const children = [];
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

/** @param {VNode} vnode @param {Document} [ownerDocument] @returns {Node} */
export function toDOM(vnode, ownerDocument = document) {
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

