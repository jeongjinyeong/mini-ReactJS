import { assertElementRoot, getNodeKey } from './vdom.js';

export function patch(root, changes) {
  assertElementRoot(root);
  if (!Array.isArray(changes)) {
    throw new TypeError('changes must be an array.');
  }

  const changesByKey = new Map();
  for (const change of changes) {
    if (change === null || typeof change !== 'object') {
      throw new TypeError('Each change must be an object.');
    }

    const { key, oldValue, newValue } = change;
    if (!Number.isInteger(key) || typeof oldValue !== 'string' || typeof newValue !== 'string' || oldValue === newValue) {
      throw new TypeError('Each change must have an integer key and two distinct string values.');
    }
    if (changesByKey.has(key)) {
      throw new TypeError(`Duplicate change for key ${key}.`);
    }
    changesByKey.set(key, { oldValue, newValue, node: null });
  }

  if (changesByKey.size === 0) {
    return 0;
  }

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const change = changesByKey.get(getNodeKey(node));
    if (change) {
      change.node = node;
    }
  }

  for (const [key, { node, oldValue }] of changesByKey) {
    if (node === null) {
      throw new Error(`No text node under root for key ${key}.`);
    }
    if (node.data !== oldValue) {
      throw new Error(`Old value mismatch for key ${key}.`);
    }
  }

  for (const { node, newValue } of changesByKey.values()) {
    node.data = newValue;
  }
  return changesByKey.size;
}
