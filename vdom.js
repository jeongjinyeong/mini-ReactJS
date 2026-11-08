const nodeKeys = new WeakMap();
let nextKey = 1;

function getDOMNodeType(node) {
  const { get } = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeType');
  return get.call(node);
}

export function assertElementRoot(root) {
  if (getDOMNodeType(root) !== Node.ELEMENT_NODE) {
    throw new TypeError('root must be a DOM Element.');
  }
}

export function getNodeKey(node) {
  const nodeType = getDOMNodeType(node);
  if (nodeType !== Node.ELEMENT_NODE && nodeType !== Node.TEXT_NODE) {
    throw new TypeError('node must be a DOM Element or Text node.');
  }

  if (!nodeKeys.has(node)) {
    nodeKeys.set(node, nextKey++);
  }
  return nodeKeys.get(node);
}

function copyNode(node) {
  const key = getNodeKey(node);
  if (node.nodeType === Node.TEXT_NODE) {
    return { kind: 'text', key, value: node.data };
  }

  return {
    kind: 'element',
    key,
    tag: node.localName,
    attrs: Object.fromEntries(Array.from(node.attributes, ({ name, value }) => [name, value])),
    children: [],
  };
}

export function createVDOM(root, state, updates = []) {
  assertElementRoot(root);
  if (!Array.isArray(updates)) {
    throw new TypeError('updates must be an array of functions.');
  }

  const updateFunctions = [...updates];
  if (updateFunctions.some(update => typeof update !== 'function')) {
    throw new TypeError('updates must be an array of functions.');
  }

  const tree = copyNode(root);
  const elementCopies = new Map([[root, tree]]);
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const copy = copyNode(node);
    elementCopies.get(node.parentNode).children.push(copy);
    if (copy.kind === 'element') {
      elementCopies.set(node, copy);
    }
  }

  for (const update of updateFunctions) {
    update(tree, state);
  }
  return tree;
}
