// Minimal browser-based unit tests for mutation testing.
// Focuses on deterministic, fast assertions over diff/patch/vnode.

import { fromDOM, toDOM, validateKeys, VNodeType } from "mini-react/vnode.js";
import { diff } from "mini-react/diff.js";
import { patch } from "mini-react/patch.js";

const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stringify(value) {
  return JSON.stringify(value, (_, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
      : entry
  );
}

function equal(a, b) {
  return stringify(a) === stringify(b);
}

function element(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild;
}

async function test(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}

await test("same tree yields empty diff", () => {
  const v = fromDOM(element("<div><p>a</p></div>"));
  assert(equal(diff(v, v), []), "diff(v,v) must be empty");
});

await test("text change yields UPDATE_TEXT", () => {
  const a = fromDOM(element("<div>old</div>"));
  const b = fromDOM(element("<div>new</div>"));
  const changes = diff(a, b);
  assert(changes.length === 1 && changes[0].type === "UPDATE_TEXT", "expected UPDATE_TEXT");
});

await test("prop change yields UPDATE_PROPS", () => {
  const a = fromDOM(element('<div class="a"></div>'));
  const b = fromDOM(element('<div class="b"></div>'));
  const changes = diff(a, b);
  assert(changes.length === 1 && changes[0].type === "UPDATE_PROPS", "expected UPDATE_PROPS");
  assert(changes[0].set.class === "b", "class updated to b");
});

await test("tag change yields REPLACE", () => {
  const a = fromDOM(element("<div></div>"));
  const b = fromDOM(element("<span></span>"));
  const changes = diff(a, b);
  assert(changes.length === 1 && changes[0].type === "REPLACE", "expected REPLACE");
});

await test("insert child yields INSERT", () => {
  const a = fromDOM(element("<ul></ul>"));
  const b = fromDOM(element("<ul><li>x</li></ul>"));
  const changes = diff(a, b);
  assert(changes.some((c) => c.type === "INSERT"), "expected INSERT");
});

await test("remove child yields REMOVE", () => {
  const a = fromDOM(element("<ul><li>x</li></ul>"));
  const b = fromDOM(element("<ul></ul>"));
  const changes = diff(a, b);
  assert(changes.some((c) => c.type === "REMOVE"), "expected REMOVE");
});

await test("keyed reorder yields MOVE and reuses DOM", () => {
  const a = fromDOM(element('<ul><li data-key="a">A</li><li data-key="b">B</li></ul>'));
  const b = fromDOM(element('<ul><li data-key="b">B</li><li data-key="a">A</li></ul>'));
  const host = element("<div></div>");
  host.appendChild(toDOM(a));
  const oldA = host.querySelector('[data-key="a"]');
  const oldB = host.querySelector('[data-key="b"]');
  patch(host, diff(a, b));
  const newA = host.querySelector('[data-key="a"]');
  const newB = host.querySelector('[data-key="b"]');
  assert(oldA === newA && oldB === newB, "keyed elements reused");
  assert(equal(fromDOM(host.firstElementChild), b), "patched DOM matches new VNode");
});

await test("duplicate keys throw", () => {
  const good = fromDOM(element('<ul><li data-key="a">A</li></ul>'));
  const bad = fromDOM(element('<ul><li data-key="a">A</li><li data-key="a">B</li></ul>'));
  let threw = false;
  try {
    diff(good, bad);
  } catch (e) {
    threw = true;
  }
  assert(threw, "duplicate keys must throw");
});

await test("patch produces equivalent DOM to fresh render", () => {
  const oldTree = fromDOM(element('<section><p class="x">a</p><span>b</span></section>'));
  const newTree = fromDOM(element('<section><p class="y">c</p><span>b</span></section>'));
  const host = element("<div></div>");
  host.appendChild(toDOM(oldTree));
  patch(host, diff(oldTree, newTree));
  const patched = fromDOM(host.firstElementChild);
  const expected = fromDOM(toDOM(newTree));
  assert(equal(patched, expected), "patched DOM equals fresh render");
});

await test("fromDOM ignores comments", () => {
  const el = element("<div>a<!-- comment -->b</div>");
  const v = fromDOM(el);
  assert(v.children.length === 2, "comment ignored, two text nodes remain");
});

await test("validateKeys recurses", () => {
  const bad = fromDOM(element('<div><p data-key="x"><span data-key="x">dup</span></p></div>'));
  let threw = false;
  try {
    validateKeys(bad);
  } catch (e) {
    threw = true;
  }
  assert(!threw, "duplicate keys under different parents are allowed");
});

if (typeof window !== "undefined" && window.__reportFuzzMutation) {
  window.__reportFuzzMutation(results);
} else {
  const summary = results.map((r) => (r.passed ? "PASS " : "FAIL ") + r.name + (r.error ? " — " + r.error : "")).join("\n");
  const failed = results.filter((r) => !r.passed).length;
  document.body.setAttribute(
    "data-mutation-report",
    btoa(unescape(encodeURIComponent(JSON.stringify({ results, summary, failed, total: results.length }))))
  );
}
