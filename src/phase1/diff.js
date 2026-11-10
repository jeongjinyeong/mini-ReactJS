import { validateKeys, VNodeType } from './vnode.js';

function keyOf(node) {
  return node?.type === VNodeType.ELEMENT ? node.key : undefined;
}

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

function moveIndex(order, from, to) {
  const [node] = order.splice(from, 1);
  order.splice(to, 0, node);
}

function diffChildren(previous, next, parentPath, changes) {
  const keyed = new Map();
  previous.forEach((node, index) => {
    const key = keyOf(node);
    if (key !== undefined) keyed.set(key, index);
  });

  const matches = next.map((node, index) => {
    const key = keyOf(node);
    if (key !== undefined) return keyed.get(key);
    return index < previous.length && keyOf(previous[index]) === undefined ? index : undefined;
  });
  const destinations = new Map(matches.map((oldIndex, index) => [oldIndex, index]));
  const order = [];
  previous.forEach((_, index) => {
    if (destinations.has(index)) {
      order.push(index);
    } else {
      changes.push({ type: 'REMOVE', path: [...parentPath, index] });
    }
  });

  next.forEach((node, index) => {
    const oldIndex = matches[index];
    if (oldIndex === undefined) {
      changes.push({ type: 'INSERT', path: parentPath, index, node });
      order.splice(index, 0, undefined);
      return;
    }

    // An unkeyed match stays at its original slot. Move any keyed nodes in its way.
    if (keyOf(node) === undefined) {
      while (order[index] !== oldIndex) {
        const displaced = order[index];
        const destination = Math.min(destinations.get(displaced), order.length - 1);
        moveIndex(order, index, destination);
        changes.push({ type: 'MOVE', path: [...parentPath, displaced], index: destination });
      }
    }

    const path = [...parentPath, oldIndex];
    const position = order[index] === oldIndex ? index : order.indexOf(oldIndex, index);
    if (position !== index) {
      moveIndex(order, position, index);
      if (!canReuse(previous[oldIndex], node)) {
        changes.push({ type: 'REPLACE', path, index, node });
        return;
      }
      changes.push({ type: 'MOVE', path, index });
    }

    compare(previous[oldIndex], node, path, changes);
  });
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
    diffChildren(previous.children, next.children, path, changes);
  }
}

export function diff(previous, next) {
  if (previous != null) validateKeys(previous);
  if (next != null) validateKeys(next);
  if (previous == null) {
    return next == null ? [] : [{ type: 'INSERT', path: [], index: 0, node: next }];
  }
  if (next == null) return [{ type: 'REMOVE', path: [0] }];

  if (keyOf(previous) !== keyOf(next)) {
    return [{ type: 'REPLACE', path: [0], node: next }];
  }

  const changes = [];
  compare(previous, next, [0], changes);
  return changes;
}
