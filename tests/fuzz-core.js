// Deterministic structure-aware generative fuzz harness for mini-react phase1.
// This is NOT a coverage-guided fuzzer (no libFuzzer/AFL instrumentation);
// it generates structured VNode/HTML trees from a deterministic seed and checks
// behavioral oracles.  All randomness comes from the seeded PRNG below.

import { fromDOM, toDOM, validateKeys, VNodeType } from "mini-react/vnode.js";
import { diff } from "mini-react/diff.js";
import { patch } from "mini-react/patch.js";

const FUZZ_MODE = "deterministic-generative-structure-aware";

function splitmix32(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x9e3779b9) | 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z ^= z >>> 15;
    return (z >>> 0) / 0x100000000;
  };
}

function makeGenerator(seed, config) {
  const rng = splitmix32(seed);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const range = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const maybe = (probability) => rng() < probability;

  const leafTags = ["span", "b", "i", "em", "strong", "code"];
  const containerTags = ["div", "section", "article", "ul", "ol", "p"];
  const booleanAttributes = ["checked", "disabled", "readonly", "selected"];
  const stringAttributes = ["class", "id", "title", "data-x", "data-y"];
  const textSamples = [
    "", "a", "ab", "hello", "한글", "x&y", "1<2", "2>1", "a\nb",
    " leading", "trailing ", "  double  ", "\n",
  ];

  function makeProps() {
    const count = range(0, config.maxProps);
    const props = {};
    for (let i = 0; i < count; i++) {
      const name = pick([...booleanAttributes, ...stringAttributes]);
      const value = booleanAttributes.includes(name) ? "" : pick(textSamples);
      props[name] = value;
    }
    return props;
  }

  function makeVNode(depth, siblingKeys = new Set()) {
    if (depth <= 0 || maybe(config.leafProbability)) {
      return { type: VNodeType.TEXT, value: pick(textSamples) };
    }
    const tagName =
      depth <= 1
        ? pick(leafTags)
        : pick([...leafTags, ...containerTags]);
    const childCount = range(
      0,
      config.maxChildrenByDepth[depth] ?? config.maxChildrenByDepth[0]
    );
    const children = [];
    const childKeys = new Set();
    for (let i = 0; i < childCount; i++) {
      children.push(makeVNode(depth - 1, childKeys));
    }
    const key = makeKey(depth, siblingKeys);
    return {
      type: VNodeType.ELEMENT,
      tagName,
      ...(key === undefined ? {} : { key }),
      props: makeProps(),
      children,
    };
  }

  function makeKey(depth, siblingKeys) {
    if (depth >= config.keyDepth || !maybe(config.keyProbability)) {
      return undefined;
    }
    const candidates = [];
    for (let i = 1; i <= config.keyPoolSize; i++) {
      const key = "k" + i;
      if (!siblingKeys.has(key)) candidates.push(key);
    }
    if (candidates.length === 0) return undefined;
    const key = pick(candidates);
    siblingKeys.add(key);
    return key;
  }

  function makePair() {
    const oldTree = makeVNode(config.maxDepth);
    const newTree = structuredClone(oldTree);
    mutateInPlace(newTree, config.maxDepth);
    return { oldTree, newTree };
  }

  function mutateInPlace(node, depth) {
    if (node.type === VNodeType.TEXT) {
      node.value = pick(textSamples);
      return;
    }
    const action = rng();
    if (action < 0.35 && Object.keys(node.props).length > 0) {
      const name = pick(Object.keys(node.props));
      node.props[name] = pick(textSamples);
    } else if (action < 0.55 && node.children.length > 0) {
      mutateInPlace(pick(node.children), depth - 1);
    } else if (
      action < 0.75 &&
      node.children.length < config.maxChildrenByDepth[depth]
    ) {
      const childKeys = collectSiblingKeys(node.children);
      node.children.push(makeVNode(depth - 1, childKeys));
    } else if (node.children.length > 0) {
      node.children.pop();
    }
  }

  function collectSiblingKeys(children) {
    const set = new Set();
    for (const child of children) {
      if (child.type === VNodeType.ELEMENT && child.key !== undefined) {
        set.add(child.key);
      }
    }
    return set;
  }

  function makeKeyedList() {
    const count = range(2, config.keyPoolSize);
    const keys = [];
    for (let i = 1; i <= count; i++) keys.push("k" + i);
    return keys.map((key) => ({
      type: VNodeType.ELEMENT,
      tagName: pick(leafTags),
      key,
      props: makeProps(),
      children: [{ type: VNodeType.TEXT, value: pick(textSamples) }],
    }));
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  return {
    pick,
    range,
    maybe,
    makeVNode,
    makePair,
    makeKeyedList,
    shuffle,
  };
}

function stringify(value) {
  return JSON.stringify(value, (_, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))
        )
      : entry
  );
}

function equal(a, b) {
  return stringify(a) === stringify(b);
}

function vnodeToHTML(vnode) {
  if (vnode.type === VNodeType.TEXT) {
    return vnode.value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  const attrs = Object.entries(vnode.props)
    .map(([name, value]) =>
      value === "" ? name : `${name}="${value.replace(/"/g, "&quot;")}"`
    )
    .join(" ");
  const keyAttr = vnode.key !== undefined ? ` data-key="${vnode.key}"` : "";
  const open = `<${vnode.tagName}${keyAttr}${attrs ? " " + attrs : ""}>`;
  const close = `</${vnode.tagName}>`;
  const body = vnode.children.map(vnodeToHTML).join("");
  return open + body + close;
}

function runFuzz(seed, config) {
  const gen = makeGenerator(seed, config);
  const host = document.createElement("div");
  document.body.append(host);
  const report = {
    seed,
    mode: FUZZ_MODE,
    iterations: config.iterations,
    passed: 0,
    failed: 0,
    failures: [],
  };

  function recordFailure(name, detail) {
    report.failed += 1;
    report.failures.push({ iteration: i, oracle: name, ...detail });
  }

  let i = 0;
  try {
    for (i = 0; i < config.iterations; i++) {
      host.innerHTML = "";

      // Oracle 1: fromDOM(toDOM(v)) == v (roundtrip)
      const v = gen.makeVNode(config.maxDepth);
      const dom1 = toDOM(v);
      const roundtrip = fromDOM(dom1);
      if (!equal(roundtrip, v)) {
        recordFailure("roundtrip", {
          expected: stringify(v),
          actual: stringify(roundtrip),
          html: vnodeToHTML(v),
        });
        break;
      }

      // Oracle 2: diff(v, v) == [] (idempotence)
      const noChanges = diff(v, v);
      if (!Array.isArray(noChanges) || noChanges.length !== 0) {
        recordFailure("idempotence", {
          changes: stringify(noChanges),
          html: vnodeToHTML(v),
        });
        break;
      }

      // Oracle 3: patch(toDOM(old), diff(old, new)) equals toDOM(new)
      const { oldTree, newTree } = gen.makePair();
      const oldDOM = toDOM(oldTree);
      host.appendChild(oldDOM);
      const changes = diff(oldTree, newTree);
      patch(host, changes);
      const patchedVNode = fromDOM(host.firstElementChild ?? host.firstChild);
      const expectedNewDOM = toDOM(newTree);
      const expectedVNode = fromDOM(expectedNewDOM);
      if (!equal(patchedVNode, expectedVNode)) {
        recordFailure("patch-equivalence", {
          oldHTML: vnodeToHTML(oldTree),
          newHTML: vnodeToHTML(newTree),
          changes: stringify(changes),
          expected: stringify(expectedVNode),
          actual: stringify(patchedVNode),
        });
        break;
      }

      // Oracle 4: keyed identity preservation for deterministic reordering.
      // Generates a flat keyed list, shuffles it, and verifies each keyed
      // element is reused (same DOM object) after a patch.
      host.innerHTML = "";
      const keyedList = gen.makeKeyedList();
      const oldOrder = keyedList;
      const newOrder = gen.shuffle([...keyedList]);
      const oldContainer = {
        type: VNodeType.ELEMENT,
        tagName: "div",
        props: {},
        children: oldOrder,
      };
      const newContainer = {
        type: VNodeType.ELEMENT,
        tagName: "div",
        props: {},
        children: newOrder,
      };
      const oldDOM2 = toDOM(oldContainer);
      host.appendChild(oldDOM2);
      const oldElements = new Map();
      for (const el of host.querySelectorAll("[data-key]")) {
        oldElements.set(el.getAttribute("data-key"), el);
      }
      patch(host, diff(oldContainer, newContainer));
      const actualChildren = host.firstElementChild.children;
      const identityOk = actualChildren.length === newOrder.length &&
        newOrder.every((child, index) =>
          actualChildren[index] === oldElements.get(child.key));
      if (!identityOk) {
        recordFailure("keyed-identity", {
          oldHTML: vnodeToHTML(oldContainer),
          newHTML: vnodeToHTML(newContainer),
        });
        break;
      }

      report.passed += 1;
    }
  } catch (error) {
    recordFailure("uncaught-exception", {
      message: error.message,
      stack: error.stack,
    });
  } finally {
    host.remove();
  }

  return report;
}

export function execute(seed = 1, overrides = {}) {
  const config = {
    maxDepth: 3,
    maxChildrenByDepth: { 3: 4, 2: 3, 1: 2, 0: 0 },
    maxProps: 2,
    leafProbability: 0.45,
    keyProbability: 0.35,
    keyDepth: 3,
    keyPoolSize: 4,
    iterations: 300,
    ...overrides,
  };
  return runFuzz(seed, config);
}

export function formatReport(report) {
  const lines = [
    `mode: ${report.mode}`,
    `seed: ${report.seed}`,
    `iterations: ${report.iterations}`,
    `passed: ${report.passed}`,
    `failed: ${report.failed}`,
  ];
  for (const failure of report.failures) {
    lines.push(
      `FAILURE iteration=${failure.iteration} oracle=${failure.oracle}`
    );
    for (const [key, value] of Object.entries(failure)) {
      if (key === "iteration" || key === "oracle") continue;
      lines.push(`  ${key}: ${value}`);
    }
  }
  return lines.join("\n");
}
