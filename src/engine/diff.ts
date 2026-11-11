import { isElement, isText } from "./vnode";
import type { Props, VNode } from "./vnode";

/* 이전 트리 기준의 자식 인덱스 배열. []는 루트, [0]은 루트의 첫 자식. */
export type Path = number[];

export type Patch =
  | { type: "INSERT"; path: Path; index: number; node: VNode } // path는 부모, index는 새 위치
  | { type: "REMOVE"; path: Path }
  | { type: "REPLACE"; path: Path; node: VNode }
  | { type: "UPDATE_TEXT"; path: Path; value: string }
  | { type: "UPDATE_PROPS"; path: Path; set: Props; remove: string[] }
  | { type: "UPDATE_HANDLERS"; path: Path; set: Props; remove: string[] } // 화면은 그대로, 핸들러만 교체
  | { type: "MOVE"; path: Path; index: number }; // 같은 부모 안에서 index 위치로 이동

/* 이전 트리와 새 트리를 깊이 우선으로 비교해 적용 순서대로 변경 목록을 만든다.
   두 트리는 수정하지 않는다. 형제 사이에 key가 중복되면 오류를 던진다. */
export function diff(oldNode: VNode, newNode: VNode): Patch[] {
  assertUniqueKeys(newNode);
  const patches: Patch[] = [];
  diffNode(oldNode, newNode, [], patches);
  return patches;
}

function diffNode(oldNode: VNode, newNode: VNode, path: Path, patches: Patch[]): void {
  if (isText(oldNode) && isText(newNode)) {
    if (oldNode.value !== newNode.value) {
      patches.push({ type: "UPDATE_TEXT", path, value: newNode.value });
    }
    return;
  }
  if (!isElement(oldNode) || !isElement(newNode) || oldNode.tagName !== newNode.tagName) {
    patches.push({ type: "REPLACE", path, node: newNode });
    return;
  }

  /* 이벤트 핸들러는 렌더링마다 새 함수가 되므로 화면 변경(UPDATE_PROPS)과 따로 모은다. */
  const props = { set: {} as Props, remove: [] as string[] };
  const handlers = { set: {} as Props, remove: [] as string[] };
  for (const name of Object.keys(newNode.props)) {
    const value = newNode.props[name];
    if (oldNode.props[name] !== value) (typeof value === "function" ? handlers : props).set[name] = value;
  }
  for (const name of Object.keys(oldNode.props)) {
    if (name in newNode.props) continue;
    (typeof oldNode.props[name] === "function" ? handlers : props).remove.push(name);
  }
  if (Object.keys(props.set).length > 0 || props.remove.length > 0) {
    patches.push({ type: "UPDATE_PROPS", path, ...props });
  }
  if (Object.keys(handlers.set).length > 0 || handlers.remove.length > 0) {
    patches.push({ type: "UPDATE_HANDLERS", path, ...handlers });
  }

  diffChildren(oldNode.children, newNode.children, path, patches);
}

function diffChildren(
  oldChildren: VNode[],
  newChildren: VNode[],
  parentPath: Path,
  patches: Patch[],
): void {
  /* 1. 기존 자식 대응표. key가 있으면 key로, 없으면 key 없는 자식끼리의 순서로 찾는다. */
  const keyed = new Map<string, number>();
  const unkeyed: number[] = [];
  oldChildren.forEach((child, index) => {
    const key = keyOf(child);
    if (key === undefined) unkeyed.push(index);
    else if (keyed.has(key)) throw duplicateKey(key);
    else keyed.set(key, index);
  });

  /* 2. 새 자식마다 재사용할 기존 자식의 인덱스를 정한다. 없으면 undefined. */
  let nextUnkeyed = 0;
  const matches = newChildren.map((child) => {
    const key = keyOf(child);
    return key === undefined ? unkeyed[nextUnkeyed++] : keyed.get(key);
  });

  /* 3. 새 목록에서 사라진 기존 자식을 제거한다. */
  const kept = new Set(matches);
  const order: number[] = []; // 변경을 적용해 가는 동안의 자식 순서(기존 인덱스, 새 노드는 -1)
  oldChildren.forEach((_, index) => {
    if (kept.has(index)) order.push(index);
    else patches.push({ type: "REMOVE", path: [...parentPath, index] });
  });

  /* 4. 새 목록을 왼쪽부터 보며 그 자리에 있어야 할 노드를 삽입하거나 옮긴다. */
  matches.forEach((oldIndex, index) => {
    if (oldIndex === undefined) {
      patches.push({ type: "INSERT", path: parentPath, index, node: newChildren[index] });
      order.splice(index, 0, -1);
    } else if (order[index] !== oldIndex) {
      patches.push({ type: "MOVE", path: [...parentPath, oldIndex], index });
      order.splice(order.indexOf(oldIndex), 1);
      order.splice(index, 0, oldIndex);
    }
  });

  /* 5. 재사용하는 자식의 내부를 비교한다. key는 같고 태그가 다르면 여기서 REPLACE가 된다. */
  matches.forEach((oldIndex, index) => {
    if (oldIndex !== undefined) {
      diffNode(oldChildren[oldIndex], newChildren[index], [...parentPath, oldIndex], patches);
    }
  });
}

function keyOf(node: VNode): string | undefined {
  return isElement(node) ? node.key : undefined;
}

function duplicateKey(key: string): Error {
  return new Error(`형제 노드 사이에 key가 중복되었다: "${key}"`);
}

function assertUniqueKeys(node: VNode): void {
  if (!isElement(node)) return;
  const seen = new Set<string>();
  for (const child of node.children) {
    const key = keyOf(child);
    if (key !== undefined) {
      if (seen.has(key)) throw duplicateKey(key);
      seen.add(key);
    }
    assertUniqueKeys(child);
  }
}
