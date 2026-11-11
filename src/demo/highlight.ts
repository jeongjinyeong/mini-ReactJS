/* 바뀐 영역을 2초 동안 빨갛게 표시한다. 애니메이션은 DOM 속성을 건드리지 않는다. */
export function highlight(nodes: Node[]): void {
  const red = { backgroundColor: "rgba(255, 0, 0, 0.3)", outline: "2px solid red" };
  /* 텍스트는 부모 요소에 표시한다. 줄바꿈·들여쓰기뿐인 텍스트는 눈에 보이는 변화가 아니므로 뺀다. */
  const visible = nodes.filter((node) => node instanceof Element || node.nodeValue?.trim());
  const elements = new Set(visible.map((node) => (node instanceof Element ? node : node.parentElement)));
  for (const element of elements) element?.animate([red, red], 2000);
}
