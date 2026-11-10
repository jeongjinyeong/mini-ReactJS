import { isRenderableNode, toDOM } from './vnode.js';

function renderedChildren(parent) {
  return Array.from(parent.childNodes).filter(isRenderableNode);
}

function resolve(container, path) {
  let current = container;
  for (const index of path) {
    current = renderedChildren(current)[index];
    if (!current) throw new Error('Patch path does not exist: ' + JSON.stringify(path));
  }
  return current;
}

function insertAt(parent, node, index) {
  const children = renderedChildren(parent).filter(child => child !== node);
  parent.insertBefore(node, children[index] ?? null);
}

function highlightTarget(node) {
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
}

export function patch(container, changes) {
  // Paths refer to the old tree. Capture nodes and construct new subtrees before writing.
  const prepared = changes.map(change => ({
    change,
    target: resolve(container, change.path),
    node: change.type === 'INSERT' || change.type === 'REPLACE'
      ? toDOM(change.node, container.ownerDocument)
      : null,
  }));
  const affected = new Set();

  for (const { change, target, node } of prepared) {
    switch (change.type) {
      case 'INSERT':
        insertAt(target, node, change.index);
        affected.add(highlightTarget(node));
        break;
      case 'REMOVE':
        affected.add(target.parentElement);
        target.parentNode.removeChild(target);
        break;
      case 'REPLACE': {
        const parent = target.parentNode;
        if (change.index === undefined) {
          parent.replaceChild(node, target);
        } else {
          parent.removeChild(target);
          insertAt(parent, node, change.index);
        }
        affected.add(highlightTarget(node));
        break;
      }
      case 'MOVE':
        insertAt(target.parentNode, target, change.index);
        affected.add(highlightTarget(target));
        break;
      case 'UPDATE_TEXT':
        target.data = change.value;
        affected.add(target.parentElement);
        break;
      case 'UPDATE_PROPS':
        for (const name of change.remove) target.removeAttribute(name);
        for (const [name, value] of Object.entries(change.set)) target.setAttribute(name, value);
        affected.add(target);
        break;
      default:
        throw new TypeError('Unsupported patch type: ' + change.type);
    }
  }
  return [...affected].filter(node => node && container.contains(node));
}
