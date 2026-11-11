import { diff } from "./diff";
import type { Patch } from "./diff";
import { toDOM } from "./dom";
import { createHistory, pushHistory } from "./history";
import type { History } from "./history";
import { patch } from "./patch";
import { createElement, createText } from "./vnode";
import type { Props, VElement, VNode } from "./vnode";

/* 함수형 컴포넌트: props 객체 하나를 받아 VNode 하나를 반환한다. 이름은 대문자로 시작한다. */
export type Component<P extends object = any> = (props: P) => VNode;

/* h()의 자식으로 쓸 수 있는 값. 문자열·숫자는 텍스트가 되고 null·undefined·boolean은 건너뛴다. */
export type Child = VNode | string | number | boolean | null | undefined | Child[];

export type Effect = () => void | (() => void);
export type SetState<T> = (value: T | ((previous: T) => T)) => void;

/* hooks 배열의 한 칸. 호출 순서가 곧 칸 번호다. */
export type Hook =
  | { kind: "state"; value: unknown; set: (value: unknown) => void }
  | { kind: "effect"; deps?: unknown[]; cleanup?: () => void; pending?: Effect } // pending: 이번 렌더링 뒤 실행할 Effect
  | { kind: "memo"; value: unknown; deps: unknown[] };

/* 한 번의 렌더링에서 호출된 컴포넌트와 그때 받은 props. */
export interface ComponentRecord {
  name: string;
  props: object;
  children: ComponentRecord[];
}

export interface UpdateResult {
  previous: VNode;
  next: VNode;
  patches: Patch[];
  changed: Node[]; // 화면이 바뀐 DOM 노드. 비어 있으면 DOM 쓰기가 없었다.
}

/* 지금 루트 컴포넌트를 렌더링 중인 인스턴스와, 호출 중인 컴포넌트 목록(첫 칸이 루트). */
let rendering: FunctionComponent | null = null;
let callStack: ComponentRecord[] = [];

/* VNode를 만든다. type이 문자열이면 요소를, 컴포넌트면 그 컴포넌트가 반환한 VNode를 돌려준다.
   자식 컴포넌트는 반드시 h(Child, props)로 호출해야 Hook 사용 제한과 컴포넌트 기록이 적용된다. */
export function h<P extends object>(type: Component<P>, props: P): VNode;
export function h(type: string, props?: Props | null, ...children: Child[]): VElement;
export function h(type: string | Component, props?: object | null, ...children: Child[]): VNode {
  if (typeof type === "string") {
    const { key, ...rest } = (props ?? {}) as Props;
    return createElement(type, rest, toVNodes(children), typeof key === "string" ? key : undefined);
  }
  if (!/^[A-Z]/.test(type.name)) {
    throw new Error(`컴포넌트 이름은 대문자로 시작해야 한다: "${type.name}"`);
  }
  const record: ComponentRecord = { name: type.name, props: props ?? {}, children: [] };
  callStack.at(-1)?.children.push(record);
  callStack.push(record);
  try {
    return type(props ?? {});
  } finally {
    callStack.pop();
  }
}

function toVNodes(children: Child[], nodes: VNode[] = []): VNode[] {
  for (const child of children) {
    if (Array.isArray(child)) toVNodes(child, nodes);
    else if (typeof child === "string" || typeof child === "number") nodes.push(createText(String(child)));
    else if (child !== null && child !== undefined && typeof child !== "boolean") nodes.push(child);
  }
  return nodes;
}

/* 루트 컴포넌트 함수를 감싸 상태(hooks)와 화면(DOM), 이력을 들고 있는 객체. */
export class FunctionComponent {
  hooks: Hook[] = [];
  history: History | null = null; // 화면에 반영한 VDOM들. mount() 뒤에 생긴다.
  tree: ComponentRecord | null = null; // 마지막 렌더링에서 호출된 컴포넌트들
  onUpdate?: (result: UpdateResult) => void;
  onTrace?: (message: string) => void; // Hook 실행 기록

  mounted = false;
  hookIndex = 0;
  private dom: Node | null = null;
  private scheduled = false;

  constructor(
    private readonly component: Component<{}>,
    private readonly container: Element,
  ) {}

  /* 처음 렌더링: 첫 VDOM을 DOM으로 만들어 붙이고, 비교 기준이자 첫 이력으로 저장한다. */
  mount(): void {
    if (this.mounted) throw new Error("이미 mount된 컴포넌트다.");
    const vdom = this.render();
    this.dom = toDOM(vdom, this.container.ownerDocument);
    this.container.appendChild(this.dom);
    this.history = createHistory(vdom);
    this.mounted = true;
    this.runEffects();
  }

  /* 다시 렌더링: 새 VDOM을 직전에 반영한 VDOM과 비교해 바뀐 부분만 DOM에 쓴다.
     화면 변경이 없으면 새 VDOM을 버리고 비교 기준과 이력을 그대로 둔다. */
  update(): UpdateResult {
    if (!this.mounted || !this.history || !this.dom) throw new Error("mount하지 않은 컴포넌트다.");
    const previous = this.history.entries[this.history.cursor];
    const next = this.render();
    const patches = diff(previous, next);
    const changed = patch(this.dom, patches); // 핸들러 교체는 화면 변경이 아니므로 changed에 없다.

    if (patches.some((change) => change.type !== "UPDATE_HANDLERS")) {
      if (patches[0].type === "REPLACE" && patches[0].path.length === 0) this.dom = changed[0];
      pushHistory(this.history, next);
    }
    this.runEffects();

    const result = { previous, next, patches, changed };
    this.onUpdate?.(result);
    return result;
  }

  /* 컴포넌트 제거: 남은 cleanup을 실행하고 DOM과 상태를 버린다. */
  unmount(): void {
    if (!this.mounted) return;
    this.hooks.forEach((hook, index) => {
      if (hook.kind === "effect" && hook.cleanup) {
        this.trace(`useEffect[${index}] cleanup 실행 (컴포넌트 제거)`);
        hook.cleanup();
      }
    });
    this.dom?.parentNode?.removeChild(this.dom);
    this.dom = null;
    this.hooks = [];
    this.history = null;
    this.tree = null;
    this.mounted = false;
  }

  /* 한 이벤트 핸들러 안에서 상태를 여러 번 바꿔도 update()는 한 번만 실행한다. */
  scheduleUpdate(): void {
    if (this.scheduled || !this.mounted) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.mounted) this.update();
    });
  }

  trace(message: string): void {
    this.onTrace?.(message);
  }

  private render(): VNode {
    if (rendering) throw new Error("렌더링 도중에 다른 렌더링을 시작할 수 없다.");
    const record: ComponentRecord = { name: this.component.name, props: {}, children: [] };
    rendering = this;
    callStack = [record];
    this.hookIndex = 0;
    try {
      const vdom = this.component({});
      if (this.mounted && this.hookIndex !== this.hooks.length) {
        throw new Error(
          `Hook 호출 개수가 이전 렌더링과 다르다: ${this.hooks.length}개 → ${this.hookIndex}개`,
        );
      }
      this.tree = record;
      return vdom;
    } finally {
      rendering = null;
      callStack = [];
    }
  }

  /* DOM 반영이 끝난 뒤 실행한다. 의존성이 바뀐 Effect만 이전 cleanup → 새 Effect 순서로 돈다. */
  private runEffects(): void {
    this.hooks.forEach((hook, index) => {
      if (hook.kind !== "effect") return;
      if (!hook.pending) {
        this.trace(`useEffect[${index}] 의존성 동일 → 건너뜀`);
        return;
      }
      if (hook.cleanup) {
        this.trace(`useEffect[${index}] 이전 cleanup 실행`);
        hook.cleanup();
      }
      this.trace(`useEffect[${index}] Effect 실행`);
      const cleanup = hook.pending();
      hook.cleanup = typeof cleanup === "function" ? cleanup : undefined;
      hook.pending = undefined;
    });
  }
}

/* 이번 Hook 호출이 쓸 칸을 찾는다. 루트 컴포넌트를 렌더링하는 동안에만 호출할 수 있다. */
function useSlot<K extends Hook["kind"]>(
  kind: K,
  name: string,
): { component: FunctionComponent; index: number; hook: Extract<Hook, { kind: K }> | undefined } {
  const component = rendering;
  if (!component) {
    throw new Error(`${name}은 루트 컴포넌트를 렌더링하는 동안에만 호출할 수 있다.`);
  }
  if (callStack.length > 1) {
    throw new Error(
      `${name}은 루트 컴포넌트에서만 호출할 수 있다. 자식 컴포넌트 ${callStack.at(-1)!.name}는 props만 사용해야 한다.`,
    );
  }
  const index = component.hookIndex++;
  const hook = component.hooks[index];
  if (!hook) {
    if (component.mounted) throw new Error(`이전 렌더링에 없던 ${index}번째 Hook(${name})을 호출했다.`);
    return { component, index, hook: undefined };
  }
  if (hook.kind !== kind) {
    throw new Error(`Hook 호출 순서가 바뀌었다: ${index}번째는 ${hook.kind}였는데 ${name}을 호출했다.`);
  }
  return { component, index, hook: hook as Extract<Hook, { kind: K }> };
}

export function useState<T>(initialValue: T): [T, SetState<T>] {
  const { component, index, hook } = useSlot("state", "useState");
  if (hook) return [hook.value as T, hook.set];

  const created: Extract<Hook, { kind: "state" }> = {
    kind: "state",
    value: initialValue,
    set: (value) => {
      /* 함수를 받으면 지금 저장된 값을 넘겨 새 값을 계산한다. 연달아 호출해도 누적된다. */
      const next = typeof value === "function" ? (value as (previous: T) => T)(created.value as T) : value;
      if (Object.is(next, created.value)) return;
      component.trace(`setState[${index}] ${show(created.value)} → ${show(next)}`);
      created.value = next;
      component.scheduleUpdate();
    },
  };
  component.hooks[index] = created;
  component.trace(`useState[${index}] 초기값 ${show(initialValue)} 저장`);
  return [initialValue, created.set];
}

/* deps가 없으면 매 렌더링 뒤, []이면 mount 뒤 한 번, 값이 있으면 그 값이 바뀐 렌더링 뒤에 실행한다. */
export function useEffect(effect: Effect, deps?: unknown[]): void {
  const { component, index, hook } = useSlot("effect", "useEffect");
  if (!hook) component.hooks[index] = { kind: "effect", deps, pending: effect };
  else if (!deps || !hook.deps || depsChanged(hook.deps, deps)) {
    hook.deps = deps;
    hook.pending = effect;
  }
}

/* 의존 값이 같으면 계산을 건너뛰고 저장한 결과를 돌려준다. */
export function useMemo<T>(calculate: () => T, deps: unknown[]): T {
  const { component, index, hook } = useSlot("memo", "useMemo");
  if (hook && !depsChanged(hook.deps, deps)) {
    component.trace(`useMemo[${index}] 의존 값 동일 → 저장한 결과 사용`);
    return hook.value as T;
  }
  const value = calculate();
  component.hooks[index] = { kind: "memo", value, deps };
  component.trace(`useMemo[${index}] ${hook ? "의존 값 변경 → 다시 계산" : "첫 계산"}: ${show(value)}`);
  return value;
}

function depsChanged(previous: unknown[], next: unknown[]): boolean {
  return previous.length !== next.length || next.some((value, i) => !Object.is(value, previous[i]));
}

function show(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}
