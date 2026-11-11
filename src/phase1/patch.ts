import { isRenderableNode, toDOM } from './vnode.js';
import type { Change } from './diff.js';

function renderedChildren(parent: Node) {
  return Array.from(parent.childNodes).filter(isRenderableNode);
}

function resolve(container: Element, path: Change['path']): Element | Text {
  let current: Element | Text = container;
  for (const index of path) {
    current = renderedChildren(current)[index];
    if (!current) throw new Error('Patch path does not exist: ' + JSON.stringify(path));
  }
  return current;
}

function insertAt(parent: Node, node: Node, index: number) {
  const children = renderedChildren(parent).filter(child => child !== node);
  parent.insertBefore(node, children[index] ?? null);
}

function highlightTarget(node: Element | Text): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
}

export function patch(container: Element, changes: readonly Change[]): Element[] {
  // Paths refer to the old tree. Capture nodes and construct new subtrees before writing.
  const prepared = changes.map(change => {
    const target = resolve(container, change.path);
    const moveParent = change.type === 'MOVE' && target !== container ? target.parentNode : null;
    if (change.type === 'MOVE' && (!moveParent || !Number.isInteger(change.index) || change.index < 0)) {
      throw new TypeError('Invalid MOVE destination: ' + change.index);
    }
    const node = change.type === 'INSERT' || change.type === 'REPLACE'
      ? toDOM(change.node, container.ownerDocument)
      : null;
    return { change, target, node, moveParent };
  });
  const affected = new Set<Element | null>();

  for (const { change, target, node, moveParent } of prepared) {
    switch (change.type) {
      case 'INSERT':
        insertAt(target, node!, change.index);
        affected.add(highlightTarget(node!));
        break;
      case 'REMOVE':
        affected.add(target.parentElement);
        target.parentNode!.removeChild(target);
        break;
      case 'MOVE':
        insertAt(moveParent!, target, change.index);
        affected.add(highlightTarget(target));
        break;
      case 'REPLACE':
        target.parentNode!.replaceChild(node!, target);
        affected.add(highlightTarget(node!));
        break;
      case 'UPDATE_TEXT':
        (target as Text).data = change.value;
        affected.add(target.parentElement);
        break;
      case 'UPDATE_PROPS': {
        const element = target as Element;
        for (const name of change.remove) element.removeAttribute(name);
        for (const [name, value] of Object.entries(change.set)) element.setAttribute(name, value);
        affected.add(element);
        break;
      }
      default:
        throw new TypeError('Unsupported patch type: ' + (change as { type: string }).type);
    }
  }
  return [...affected].filter((node): node is Element => node !== null && container.contains(node));
}
