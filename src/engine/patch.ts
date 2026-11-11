import { managedChildren, removeHandler, removeProp, setProp, toDOM } from "./dom";
import type { Patch, Path } from "./diff";

/* 변경 목록을 실제 DOM에 적용하고, 화면이 바뀐 DOM 노드들을 반환한다.
   경로는 이전 트리 기준이므로 첫 DOM 쓰기 전에 모두 노드로 해석해 둔다.
   그래야 삭제·이동으로 인덱스가 바뀌어도 엉뚱한 노드를 건드리지 않는다. */
export function patch(root: Node, patches: Patch[]): Node[] {
  const doc = root.ownerDocument ?? document;
  const targets = patches.map((change) => resolve(root, change.path));
  const changed: Node[] = [];

  patches.forEach((change, i) => {
    const target = targets[i];
    switch (change.type) {
      case "INSERT": {
        const node = toDOM(change.node, doc);
        target.insertBefore(node, managedChildren(target)[change.index] ?? null);
        changed.push(node);
        break;
      }
      case "MOVE": {
        const parent = parentOf(target);
        parent.insertBefore(target, managedChildren(parent)[change.index] ?? null);
        changed.push(target);
        break;
      }
      case "REMOVE": {
        const parent = parentOf(target);
        parent.removeChild(target);
        changed.push(parent);
        break;
      }
      case "REPLACE": {
        const node = toDOM(change.node, doc);
        parentOf(target).replaceChild(node, target);
        changed.push(node);
        break;
      }
      case "UPDATE_TEXT":
        target.nodeValue = change.value;
        changed.push(target);
        break;
      case "UPDATE_PROPS": {
        const element = target as Element;
        for (const name of change.remove) removeProp(element, name);
        for (const name of Object.keys(change.set)) setProp(element, name, change.set[name]);
        changed.push(element);
        break;
      }
      case "UPDATE_HANDLERS": {
        const element = target as Element;
        for (const name of change.remove) removeHandler(element, name);
        for (const name of Object.keys(change.set)) setProp(element, name, change.set[name]);
        break; // 화면은 바뀌지 않으므로 changed에 넣지 않는다.
      }
    }
  });

  return changed;
}

function resolve(root: Node, path: Path): Node {
  let node = root;
  for (const index of path) {
    const child = managedChildren(node)[index];
    if (!child) throw new Error(`경로 [${path.join(", ")}]에 해당하는 DOM 노드가 없다.`);
    node = child;
  }
  return node;
}

function parentOf(node: Node): Node {
  if (!node.parentNode) throw new Error("부모가 없는 노드는 옮기거나 제거하거나 교체할 수 없다.");
  return node.parentNode;
}
