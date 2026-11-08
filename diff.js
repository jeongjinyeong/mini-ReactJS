function visitTree(tree, visit) {
  const remaining = [tree];
  while (remaining.length > 0) {
    const node = remaining.pop();
    const key = node?.key;
    if (!Number.isInteger(key)) {
      const value = typeof key === 'number' || typeof key === 'string' ? ` (${key})` : '';
      throw new TypeError(`VDOM node key must be an integer${value}.`);
    }

    visit(node);
    if (node.kind === 'element') {
      for (let index = node.children.length - 1; index >= 0; index--) {
        remaining.push(node.children[index]);
      }
    }
  }
}

export function diff(baseTree, targetTree) {
  const baseNodes = new Map();
  visitTree(baseTree, node => baseNodes.set(node.key, node));

  const changes = [];
  visitTree(targetTree, target => {
    const base = baseNodes.get(target.key);
    if (!base) {
      throw new TypeError(`No base node for key ${target.key}.`);
    }
    if (base.kind !== target.kind) {
      throw new TypeError(`Node kind mismatch for key ${target.key}.`);
    }
    if (target.kind === 'text' && base.value !== target.value) {
      changes.push({ key: target.key, oldValue: base.value, newValue: target.value });
    }
  });

  return changes;
}
