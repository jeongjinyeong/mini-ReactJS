import { createVDOM, getNodeKey } from './vdom.js';
import { diff } from './diff.js';
import { patch } from './patch.js';

const root = document.getElementById('actual');
const addButton = document.getElementById('add');
const changeList = document.getElementById('changes');
const patchResult = document.getElementById('patch-result');
const countKey = getNodeKey(document.getElementById('count').firstChild);
const doubleKey = getNodeKey(document.getElementById('double').firstChild);
let state = { count: 1 };

function updateCount(tree, nextState) {
  const pending = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.kind === 'element') {
      pending.push(...node.children);
    } else if (node.key === countKey) {
      node.value = `수량: ${nextState.count}`;
    } else if (node.key === doubleKey) {
      node.value = `두 배: ${nextState.count * 2}`;
    }
  }
}

addButton.addEventListener('click', () => {
  const nextState = { count: state.count + 1 };
  const baseTree = createVDOM(root, nextState);
  const targetTree = createVDOM(root, nextState, [updateCount]);
  const changes = diff(baseTree, targetTree);
  const applied = patch(root, changes);

  state = nextState;
  changeList.textContent = JSON.stringify(changes, null, 2);
  patchResult.textContent = `텍스트 노드 ${applied}개 갱신`;
});

addButton.disabled = false;
