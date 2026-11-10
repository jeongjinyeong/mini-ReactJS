/* HTML 편집기에서 받을 수 있는 입력의 범위. 여기서 걸러진 입력은 VDOM으로 만들지 않는다. */
const TAGS = new Set([
  "div", "section", "h1", "h2", "h3", "p", "span", "strong", "em",
  "ul", "ol", "li", "code", "br", "label", "input", "button",
]);
const COMMON_ATTRIBUTE = /^(id|class|title|data-.+|aria-.+)$/;
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/* 지원하지 않는 요소나 속성이 있으면 이유를 담은 오류를 던진다. */
export function validateDraft(fragment: DocumentFragment): void {
  for (const element of Array.from(fragment.querySelectorAll("*"))) {
    const tag = element.localName;
    if (element.namespaceURI !== HTML_NAMESPACE || !TAGS.has(tag)) {
      throw new Error(`지원하지 않는 태그: <${tag}>`);
    }

    const type = element.getAttribute("type") ?? "text";
    for (const { name } of Array.from(element.attributes)) {
      const allowed =
        COMMON_ATTRIBUTE.test(name) ||
        (tag === "input" && (name === "type" || name === "value")) ||
        (tag === "input" && name === "checked" && type === "checkbox");
      if (!allowed) throw new Error(`<${tag}>에서 지원하지 않는 속성: ${name}`);
    }
    if (tag === "input" && type !== "text" && type !== "checkbox") {
      throw new Error(`지원하지 않는 input 타입: ${type}`);
    }
  }
}
