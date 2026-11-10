import { VNodeType } from './vnode.js';

function canReuse(previous, next) {
  return previous.type === next.type &&
    (next.type === VNodeType.TEXT || previous.tagName === next.tagName);
}

function diffProps(previous, next, path, changes) {
  const set = Object.fromEntries(Object.entries(next)
    .filter(([name, value]) => !Object.hasOwn(previous, name) || previous[name] !== value));
  const remove = Object.keys(previous).filter(name => !Object.hasOwn(next, name));
  if (Object.keys(set).length || remove.length) {
    changes.push({ type: 'UPDATE_PROPS', path, set, remove });
  }
}

function diffChildren(previous, next, parentPath, changes) {
  const shared = Math.min(previous.length, next.length);
  for (let index = 0; index < shared; index++) {
    compare(previous[index], next[index], [...parentPath, index], changes);
  }
  for (let index = previous.length - 1; index >= shared; index--) {
    changes.push({ type: 'REMOVE', path: [...parentPath, index] });
  }
  for (let index = shared; index < next.length; index++) {
    changes.push({ type: 'INSERT', path: parentPath, index, node: next[index] });
  }
}

function compare(previous, next, path, changes) {
  if (!canReuse(previous, next)) {
    changes.push({ type: 'REPLACE', path, node: next });
  } else if (next.type === VNodeType.TEXT) {
    if (previous.value !== next.value) {
      changes.push({ type: 'UPDATE_TEXT', path, value: next.value });
    }
  } else {
    diffProps(previous.props, next.props, path, changes);
    if (next.tagName === 'ul' || next.tagName === 'ol') {
      const childChanges = [];
      diffChildren(previous.children, next.children, path, childChanges);
      if (childChanges.length) {
        diffChildren(previous.children, [], path, changes);
        diffChildren([], next.children, path, changes);
      }
    } else {
      diffChildren(previous.children, next.children, path, changes);
    }
  }
}

export function diff(previous, next) {
  if (previous == null) {
    return next == null ? [] : [{ type: 'INSERT', path: [], index: 0, node: next }];
  }
  if (next == null) return [{ type: 'REMOVE', path: [0] }];

  const changes = [];
  compare(previous, next, [0], changes);
  return changes;
}
