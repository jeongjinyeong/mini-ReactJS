# React와의 구현 비교

이 문서는 `feat/dom-to-vnode` 병합 전 Phase 1 작업 트리의 분석 기록이다.
현재 브랜치에는 `src/phase2/runtime.ts`의 컴포넌트와 `useState`, `useEffect`, `useMemo`도 있다.
현재 Phase 1은 기본 목록 재생성, Phase 2는 `matchKeys: true`를 사용하므로
아래 키 자료구조·알고리즘과 API 미구현 설명을 현재 브랜치 전체에 적용하면 안 된다.
현재 Phase 1·2 비교는 [README](../README.md#react와의-구현-차이)를 참고한다.

확인일: 2026-11-11. 아래 내용의 mini-react는 당시 작업 트리의 Phase 1 구현이다.
React API 설명은 공식 문서를, 내부 알고리즘은 재현 가능한 **React v19.2.0** 소스를 기준으로 한다.
v19.2.0을 최신 버전이라고 주장하지 않으며, 내부 구현은 공개 API 계약이 아니다.

## 1. 무엇을 구현했는가

이 프로젝트는 HTML을 VNode로 바꾸고 두 트리의 차이를 실제 DOM에 반영하는 학습용 엔진이다.
React의 컴포넌트 런타임 전체를 구현한 것은 아니다.

| 항목 | mini-react Phase 1 | React |
|---|---|---|
| 입력 | HTML 조각을 `<template>`에서 파싱한 실제 DOM | 컴포넌트가 반환하는 React element 트리. JSX는 표현 수단 |
| 표현 | 요소 `{type: 1, tagName, key?, props, children}`, 텍스트 `{type: 3, value}` | React element와 내부 Fiber는 별도 자료구조. 함수·클래스 컴포넌트 등도 처리 |
| 화면 갱신 | 사용자가 Patch 클릭 → `diff` → `patch`를 동기 실행 | root 렌더 및 state 갱신으로 렌더를 예약하고 render/commit 단계를 수행 |
| 상태 | 데모가 VDOM 스냅샷을 최대 10개 보관 | 컴포넌트 위치·타입·key에 연결된 state, Hooks 등 |
| 이벤트 | 데모 자체에 네이티브 `addEventListener` 사용. VNode에는 함수가 없음 | JSX 이벤트 핸들러 등 React DOM의 이벤트 API 지원 |
| 속성 | `Record<string, string>`, `setAttribute`/`removeAttribute` | 이벤트·스타일 객체·DOM 특성별 처리 등. 단순 문자열 속성 맵이 아님 |
| 폼 입력 | HTML의 `value`, `checked` **속성** 반영 | `value`/`checked`와 `onChange`로 controlled input 지원 |
| 키 | `data-key`를 읽어 `key`로 분리하고 DOM에도 `data-key`로 출력 | `key`는 React의 식별 정보이며 일반 prop으로 전달되지 않음 |
| 중복 키 | `validateKeys`가 형제 중복을 예외로 거부 | 개발 모드 경고. 중복 키의 결과는 지원하지 않는 동작 |
| 이력 | Undo/redo와 10개 상한을 데모에서 직접 구현 | React 자체가 애플리케이션의 undo/redo 이력을 제공하지는 않음 |
| 스케줄링 | 재귀 비교와 DOM 반영을 한 호출에서 완료 | Fiber 기반 작업 관리. Transition 등의 비차단 갱신 API 제공 |
| 서버 렌더링 | SSR/hydration 구현 없음 | 서버 생성 HTML에 `hydrateRoot`로 연결 가능 |

로컬 근거: `src/phase1/vnode.js:1`, `src/phase1/vnode.js:14`,
`src/phase1/vnode.js:48`, `src/phase1/diff.js:95`, `src/phase1/patch.js:23`,
`demo/phase1/demo.js:13`, `demo/phase1/demo.js:164`.

`fromDOM`으로 기존 HTML을 읽는 것과 React hydration은 다르다.
여기서는 DOM을 문자열 속성의 스냅샷으로 읽지만, React hydration은 서버에서 렌더한 결과에
컴포넌트 트리와 이벤트 동작을 연결한다.

## 2. 이 저장소의 Diff 알고리즘

`src/phase1/diff.js`는 다음 순서로 동작한다.

1. 이전·다음 트리의 형제 key 중복을 검증한다.
2. 루트가 없으면 INSERT/REMOVE, 루트 key가 달라지면 REPLACE를 반환한다.
3. 노드 타입 또는 태그가 다르면 하위 트리 전체를 REPLACE한다.
4. 같은 텍스트의 값만 달라지면 UPDATE_TEXT를 만든다.
5. 같은 요소는 문자열 속성을 비교하고 자식으로 재귀 진입한다.
6. 부모마다 이전 자식의 key → 인덱스 Map을 만든다.
   키 자식은 같은 key, 키 없는 자식은 **동일 인덱스의 키 없는 자식**과 매칭한다.
7. 매칭되지 않은 이전 자식을 REMOVE한다.
8. 새 자식을 왼쪽부터 처리하면서 INSERT, MOVE, REPLACE 또는 재귀 비교를 수행한다.
   `order` 배열로 적용 중의 형제 순서를 추적한다.

출력은 `INSERT`, `REMOVE`, `REPLACE`, `MOVE`, `UPDATE_TEXT`, `UPDATE_PROPS`의 명시적인 목록이다.
각 `path`는 **적용 전 DOM** 기준이다. `patch`는 모든 경로를 실제 노드 참조로 먼저 해석하고
새 서브트리도 미리 만든 뒤 순서대로 반영한다. 따라서 앞선 삭제·이동 때문에 뒤 작업의 경로가
다른 형제를 가리키는 문제를 피한다. 이 준비 과정이 임의의 잘못된 패치까지 원자적으로
롤백한다는 뜻은 아니다.

주석은 경로 인덱스에서 제외한다. 데모 파서는 주석을 제거하고 인접 텍스트를 병합하지만,
엔진의 `fromDOM` 자체는 주석을 건너뛸 뿐 텍스트를 병합하지 않는다.

## 3. React의 자식 조정과 어디가 다른가

공통점은 형제 범위의 key, 타입에 따른 재사용, 변경된 부분만 DOM에 반영한다는 원칙이다.
그러나 이 공통점만으로 “React와 같은 Diff”라고 할 수는 없다.

React v19.2.0의 `ReactChildFiber.js`에서는:

- `reconcileChildrenArray`가 기존 Fiber와 새 자식을 순서대로 맞추는 경로를 먼저 시도한다.
- 순서대로 처리하지 못한 나머지는 `mapRemainingChildren`에서 key 또는 기존 index로 조회한다.
- `placeChild`는 기존 index와 `lastPlacedIndex`를 비교하여 `Placement` 플래그를 남긴다.
- DOM 변경은 별도의 commit 처리에서 수행한다. 외부에 이 프로젝트와 같은 path 기반 패치 배열을 반환하지 않는다.

반면 이 프로젝트는 부모마다 먼저 key Map과 `matches`/`destinations`/`order`를 만들고,
`splice`로 배열 순서를 모사하며 MOVE를 바로 기록한다.
키 없는 형제가 원래 슬롯을 유지하도록 가로막는 키 형제를 옮기는 별도 반복문도 있다.

### 예: `[A, B, C]` → `[B, C, A]`

모든 항목이 같은 태그이고 key가 안정적이라는 조건에서:

| 구현 | 이동 계획 |
|---|---|
| mini-react | B를 0번으로, C를 1번으로 이동: MOVE 2개 |
| React v19.2.0 | B의 oldIndex=1, C=2를 순서 유지로 보고, A의 oldIndex=0이 `lastPlacedIndex=2`보다 작으므로 A에 Placement |

두 구현의 최종 화면과 DOM 정체성은 같을 수 있지만 이동 계획은 다르다.
React 예시는 소스의 `placeChild` 규칙을 따라 도출한 설명이며 React를 설치해 DOM 호출 수를
벤치마크한 결과는 아니다. 두 알고리즘 모두 일반적인 최소 편집 거리나 최장 증가 부분 수열을
구해 전역 최소 이동 수를 보장하는 방식은 아니다.

### 복잡도에서 주의할 점

React의 기존 공식 reconciliation 설명은 타입과 key를 이용한 O(n) 휴리스틱을 설명한다.
이것을 mini-react의 실행 시간 보장으로 옮기면 안 된다.

이 저장소의 `order.indexOf`, `splice`, 키 없는 슬롯을 맞추는 반복문은 형제 수에 따라 추가 비용이 든다.
예를 들어 k개 키 형제의 역순 재배치는 반복적인 선형 탐색·배열 이동으로 O(k²) 비용을 낼 수 있다.
또한 Patch는 작업마다 경로의 각 단계에서 `childNodes`를 배열로 만들고,
삽입·이동 시에도 형제 목록을 다시 만든다.
DFS 방문 자체와 브라우저 DOM 반영까지 포함한 총비용을 구분해야 한다.
여기서 제시한 복잡도는 소스 분석이며 성능 측정값이 아니다.

## 4. 사용 시 드러나는 차이

- `<Counter />`, `useState`, `useEffect`, Context, refs, Portal, Suspense 같은 React API는 구현하지 않았다.
- 데모의 지원 태그·속성 허용 목록은 **데모 입력 계약**이다. `toDOM` 자체에 같은 검증이 있는 것은 아니다.
- DOM 입력의 현재 `.value`나 `.checked` 같은 사용자 변경 프로퍼티는 `fromDOM`의 속성 스냅샷에 포함되지 않는다.
  따라서 이력 복원이 React controlled input처럼 사용자 입력 상태를 관리한다고 보면 안 된다.
  데모의 실제 영역과 미리보기에는 `inert`가 지정되어 폼을 직접 조작할 수도 없다
  (`demo/phase1/index.html:97`, `demo/phase1/index.html:121`).
- `class`는 HTML 속성 이름 그대로 다룬다. React의 `className`이나 객체형 `style` 사용법을 복사할 수 없다.
- 한 부모의 key를 다른 부모로 옮긴다고 기존 DOM 객체가 전역적으로 이동하는 것은 아니다.
  매칭은 부모별로 수행한다.
- DOM 정체성 유지, no-op 시 쓰기 없음, undo/redo는 테스트로 검증할 수 있지만,
  이것만으로 React API 호환성이나 동급 성능을 주장할 수는 없다.

## 공식 참고 자료

확인일은 모두 2026-11-11이다.

- [Render and Commit](https://react.dev/learn/render-and-commit): 갱신 트리거와 render/commit 구분.
- [Rendering Lists](https://react.dev/learn/rendering-lists): 형제 key와 key 전달 규칙.
- [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state): 위치·타입·key와 상태.
- [Reconciliation (기존 문서)](https://legacy.reactjs.org/docs/reconciliation.html): 휴리스틱과 O(n) 설명. 최신 내부 구현 명세가 아님.
- [React v19.2.0 ReactChildFiber.js](https://github.com/facebook/react/blob/v19.2.0/packages/react-reconciler/src/ReactChildFiber.js):
  `mapRemainingChildren`, `placeChild`, `reconcileChildrenArray`.
- [input](https://react.dev/reference/react-dom/components/input): controlled input과 DOM 입력 특성.
- [startTransition](https://react.dev/reference/react/startTransition): 비차단 Transition.
- [hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot): 서버 HTML과 hydration.
