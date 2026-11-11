![mini-react](src/img/image.png)

# mini-react Phase 1

HTML을 VNode로 변환하고, 이전·다음 트리의 차이를 실제 DOM에 적용하는 학습용 프로젝트입니다.
React 컴포넌트나 Hooks를 실행하는 라이브러리가 아니라 **DOM 변환 → Diff → Patch**의 동작을
확인하는 Phase 1 구현입니다. 런타임 의존성이나 별도 번들러 설치 없이 데모를 열 수 있습니다.

## 데모 사용

[데모 HTML](demo/phase1/demo.html)을 Chrome에서 열면 바로 실행됩니다.

지원 입력은 HTML 요소 23종과 문자열 속성으로 제한됩니다. `data-key`가 같은 형제 노드는
재정렬 시 기존 DOM 객체를 재사용합니다. 편집은 미리보기만 바꾸며, Patch가 성공하면
최대 10개의 VDOM 스냅샷으로 뒤로·앞으로 이동할 수 있습니다.

## 구조

```text
src/phase1/vnode.js    DOM ↔ VNode 변환과 형제 key 검증
src/phase1/diff.js     key/인덱스 매칭과 여섯 종류의 변경 작업 생성
src/phase1/patch.js    적용 전 경로를 해석하고 실제 DOM 갱신
demo/phase1/demo.js    HTML 입력 검증, 미리보기, 이력과 강조 표시
demo/phase1/index.html 개발용 ES 모듈 데모
demo/phase1/demo.html  생성된 오프라인 단독 데모
tests/                브라우저 회귀 테스트와 분석 테스트
```

## 실행과 검증

Node.js와 설치된 Chrome을 사용합니다. 기본 회귀 테스트에는 추가 npm 패키지가 필요하지 않습니다.

```sh
# 데모 재생성: 소스나 index.html 변경 후 실행
node demo/build-demo.js

# 단독 데모와 실제 ES 모듈 양쪽에서 테스트
node tests/run-phase1-tests.mjs
```

Chrome 경로를 자동으로 찾지 못하면 `CHROME_PATH`를 지정합니다.
단일 진입점 검사, WSL 실행 방법, 변이·퍼징 명령은 [테스트 실행 안내](tests/README.md)에 있습니다.

## 문서 모음

- [Phase 1 명세](docs/project-spec.md): 지원하는 HTML, VNode, Diff·Patch와 이력 계약.
- [테스트 실행 안내](tests/README.md): 실행 옵션, WSL 환경과 변이·퍼징 명령.
- [테스트 항목](tests/TEST-CASES.md): 단위·통합·사용자 시나리오의 검증 대상과 기대 결과.
- [테스트 결과 보고서](docs/test-report.md): 실행 환경, 실제 결과, 범위와 남은 제약.
- [변이·퍼징 분석](docs/testing-analysis.md): 재현 가능한 입력 생성과 변이 테스트 상세.
- [React와의 비교](docs/react-comparison.md): 표현 방식, Diff 알고리즘, key, 상태, 스케줄링 차이.

2026-11-11 검증 결과:

| 종류 | 결과 |
|---|---|
| 단위·통합·시나리오 | 고유 27개, 두 실행 모드에서 54/54 통과 |
| 스킬 기반 생성형 퍼징 | 5개 seed, 5,000/5,000 통과 |
| 변이 테스트 | 속성 처리 두 구간의 22개 중 14개 검출, 8개 생존, 점수 63.64% |

변이 점수는 전용 11개 테스트와 지정 구간만의 결과입니다. 생존 변이의 검증 공백과
정적 진단·타 브라우저 등 미실행 범위는 결과 보고서에 구분했습니다.

Diff는 DFS와 형제 key Map을 사용하지만 React와 동일한 알고리즘은 아닙니다.
형제 순서를 배열 탐색·이동으로 추적하므로 큰 재정렬에서는 제곱 비용이 발생할 수 있습니다.
또한 React의 컴포넌트 state, 이벤트 prop, controlled input, Fiber 스케줄링, SSR/hydration은 구현하지 않았습니다.

## 명세

- [Phase 1 명세](docs/project-spec.md)에 지원하는 HTML과 VNode, Diff·Patch, 이력 계약이 있습니다.
- [src/phase1/](src/phase1/)에는 DOM 변환, Diff, Patch 엔진이 있습니다.
- [demo/phase1/](demo/phase1/)에는 편집기와 데모 화면의 소스가 있습니다.

## 기존 설계 및 React 비교

아래는 기존 README의 Phase 1·2 설계 설명입니다. 현재 브랜치의 실행 방법과 구현 범위는 위의 Phase 1 안내를 기준으로 확인하세요.

HTML, CSS, TypeScript와 브라우저 API만으로 Virtual DOM, Diff/Patch, 함수 컴포넌트와 Hooks를 구현한 학습용 프로젝트입니다. React의 기능을 직접 구현해보며, 핵심 흐름을 관찰하는 것이 목적입니다.

## 🎯 목표

> `mini-react`는 브라우저에서 바뀐 부분만 새로 렌더링하는 웹 프론트엔드 프레임워크다.
>

---

## ❌ 기존 개발의 특징과 불편했던 점

- 데이터와 DOM은 별개의 구성 요소라서 `JavaScript` 객체의 값을 변경한다고 브라우저 화면이 자동으로 갱신되지 않았다.
- 데이터만 변경한다고 해서 UI 기능 구현이 끝난게 아니고, 그 데이터를 이용해서 개발자가 새로 렌더링 코드를 작성해야했다.
- 개발자가, HTML에서 내용이 하나 변경됨(ex. 개수 추가) → 변경된 내역에 따라 바뀌어야하는 내용(ex. 합계)을 모두 DOM트리에서 찾아서 갱신해줘야 한다. 하나라도 놓치면 정합성이 깨진다.

---

## 🔜 구현 방향

> 우리는 데이터가 바뀌면 자동으로 렌더링해주는 프레임워크를 만들자.
>
- 하나의 상태가 바뀔 때, 전체 DOM 트리를 다시 렌더링하는 것은 비효율적이다. 따라서 우리는 “과거”의 DOM 트리와 “새롭게 갱신한” 가상 DOM 트리를 비교하여, 트리에서 바뀐 노드만 갱신하는 로직을 설계한다.
- 다만 DOM 트리를 전부 `cloneNode()` 로 복사하는 것도 비용이니, 트리의 구조와 값만 추출하여 VDOM 자료구조로 변환한다.
- 예를 들어, 다음과 같이 변환하여 비교한다.

```tsx
<div>
  <h2>게시글</h2>
  <span>좋아요 10</span>
  <button>좋아요</button>
</div>
```

```tsx
/* 이는 예시 변환일 뿐, 정확한 자료구조와 명세는 아래에서 정의한다 */
const oldTree: VTree = {
  tag: "span",
  children: ["좋아요 10"]
};

const newTree = {
  tag: "span",
  children: ["좋아요 11"]
};
```

- VDOM 객체 생성 함수의 개념은 다음과 같다.

```jsx
구조 A: 텍스트를 문자열 그대로
function h(type, props, ...children) {
  return { type, props: props ?? {}, children: children.flat() };
}

구조 B: 텍스트도 객체로 통일
function h(type, props, ...children) {
  return {
    type,
    props: props ?? {},
    children: children.flat().map((c) =>
      typeof c === "string" ? { type: "#text", value: c } : c
    ),
  };
}
```

- 렌더링 함수의 개념은 다음과 같다.

```jsx
function render(vnode) {
  /*
   * 객체의 타입에 맞게 처리
   * type이 "#text"이면 document.createTextNode(vnode.value)
   * type이 "function"이면 해당 함수 호출하고 반환값으로 다시 render
   * type이 "string"인 경우 type의 값이 "div", "p" 등의 태그로 createElement(vnode.type) 반환
   */
 }
```

## 특징

### Phase 1: Virtual DOM + Diff + Patch 검증기

- `테스트 영역`에 임의의 HTML을 입력하면 검증된 **VNode와 미리보기를 즉시 생성**합니다.
- `실제 영역`에서는 `Patch` 버튼을 누를 때만 `테스트 영역`의 변경 사항을 반영합니다.
- 같은 키와 태그의 노드는 **재생성하지 않고 이동**시켜 DOM 동일성을 보존합니다.
- **변경된 영역을 2초간 강조**합니다. 혼합 콘텐츠의 텍스트는 Range 기반 오버레이로
표시하여 관리 중인 DOM 구조를 바꾸지 않습니다.
- **최대 10개 VNode 스냅샷을 저장**합니다. `뒤로가기/앞으로가기` 버튼으로 `실제 영역`, `편집기`, `미리보기`를 복원하고, 과거 위치에서 새 변경을 적용하면 이후 이력을 버립니다.
- 변경이 없으면 실제 영역의 DOM 쓰기와 이력 추가를 생략합니다.

### Phase 2: 함수 컴포넌트와 Hooks

- `h()`로 VNode를 만들고 `FunctionComponent`가 `mount/update/unmount`를 관리합니다.
- **루트 컴포넌트만 상태와 Hooks를 소유**합니다. 자식 컴포넌트는 `props`만 받습니다.
- `useState`, `useEffect`, `useMemo`, `useCustomHook`을 제공합니다.
- 카운터, 텍스트 입력, 체크박스, 계산 결과, Effect 로그를 확인할 수 있습니다.
VNode는 현재 스냅샷과 이력 개수를 표시하며, Phase 2에는 이력 탐색 UI가 없습니다.
- Reset은 새 인스턴스를 생성하고, Unmount/Mount로 정리 함수와 재생성을 관찰합니다.

### 타입과 입력 경계

`VNode`는 요소(`type: 1`)와 텍스트(`type: 3`)의 구분된 유니온입니다.
`Patch`도 작업 종류별 유니온으로 정의합니다. TypeScript의 `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` 등을 활성화했습니다.

편집기의 `parseHTML()`은 하나의 루트 요소만 받으며 태그·속성·URL 허용 목록으로
입력을 검사합니다. 실행 가능한 태그, 인라인 이벤트, `style` 속성, SVG,
주석, `contenteditable`, 파일 입력의 비어 있지 않은 초기 `value` 등은 거절합니다.
이 검증은 **편집기 HTML 입력 경로**에 적용됩니다.
`h()`나 `fromDOM()`으로 만든 트리에 같은 HTML 검증이 자동 적용되는 것은 아닙니다.

## 실행 방법

- Bun: 빌드와 서버 실행에 사용합니다. 기본 브라우저 자동 테스트 경로는
`Bun.WebView`가 있는 버전이 필요하며, 기존 검증 환경은 Bun 1.4.4입니다.
`BROWSER_CDP_URL`로 기존 브라우저에 연결하면 `Bun.WebView`를 사용하지 않습니다.
- Chrome/Chromium: 자동 브라우저 테스트에 필요합니다.
- TypeScript CLI(`tsc`): 타입 검사에 필요합니다. `package.json`에 의존성이
선언되어 있지 않으므로 실행 환경에서 별도로 제공해야 합니다.
- 저장소 루트에서 다음 명령줄을 실행합니다.

    ```bash
    bun run build
    bun run start
    ```

- 브라우저에서 `http://localhost:3000`을 엽니다. `PORT=3001 bun run start`로 포트를 바꿀 수 있습니다. 서버는 정적 파일을 제공하며 자동 재빌드하지 않으므로, **소스를 수정하면 다시 빌드**해야 합니다.

## 🌲코드 구조

### 레포 구조

```
mini-react/
├── index.html                 # 앱 HTML, CSS 및 빌드된 스크립트 로드
├── src/
│   ├── main.ts                # Phase 1·2 앱 진입점
│   ├── types.ts               # VNode, Props, Patch, MiniReactError
│   ├── element.ts             # h(): 키와 자식 정규화
│   ├── dom.ts                 # HTML 검증·파싱, DOM ↔ VNode 변환
│   ├── serialize.ts           # VNode → HTML, 이스케이프·줄바꿈 보존
│   ├── diff.ts                # 트리 비교, 중복 키 검사, Patch 생성
│   ├── patch.ts               # 경로 해석과 순차 DOM 갱신
│   ├── properties.ts          # 속성·폼 프로퍼티·이벤트 리스너 갱신
│   ├── history.ts             # 최대 10개 VNode 이력과 커서
│   ├── runtime.ts             # FunctionComponent 생명주기
│   ├── hooks.ts               # 훅 슬롯·상태·Memo·Effect·호출 경계
│   ├── demo.ts                # Phase 1 편집기와 이력 UI
│   ├── component-demo.ts      # Phase 2 컴포넌트 데모
│   ├── highlight.ts           # 변경 영역 애니메이션
│   └── style.css              # 반응형 레이아웃과 밝은/어두운 테마
├── tests/                     # 실제 브라우저에서 실행하는 테스트
├── scripts/
│   ├── serve.ts               # 정적 서버
│   └── test.ts                # 테스트 서버와 WebView/CDP 실행기
├── dist/                      # 앱과 테스트의 빌드 산출물
├── PHASE_1_ARCHITECTURE.md     # VDOM·Diff·Patch·이력 명세
├── PHASE_2_ARCHITECTURE.md     # 컴포넌트·Hooks 명세
├── DESIGN.md                  # 화면 설계
└── TEST_REPORT.md             # 이전 검증 결과와 알려진 문제
```

### 렌더링 흐름

```
Phase 1
HTML 입력 → parseHTML → VNode → 미리보기 / JSON
Patch 클릭 → 현재 HTML 재파싱 → diff(현재 이력, 새 VNode)
           → applyPatches → 이력 추가 → 변경 영역 강조
Back/Forward → 목표 VNode와 diff → applyPatches
             → serializeHTML로 편집기와 미리보기 복원

Phase 2
mount → 루트 함수 실행 + 훅 슬롯 생성 → toDOM → 초기 이력 저장
setter → 상태 변경 → 루트 함수 재실행 → diff → applyPatches → 이력 저장
DOM 반영 후 → queueMicrotask → 이전 cleanup → 새 Effect
unmount → cleanup → DOM 제거
```

- `diff()`는 DOM을 직접 수정하지 않고 아래 여섯 작업을 반환합니다.
- `path: []`는 컨테이너의 첫 번째 자식인 루트를 가리키며, `[0, 1]`은 루트의 첫 번째 자식 아래 두 번째 자식입니다.


    | Patch | 처리 |
    | --- | --- |
    | `INSERT` | 새 노드 삽입 |
    | `REMOVE` | 기존 노드 제거 |
    | `REPLACE` | 타입·태그·키가 다른 노드 교체 |
    | `UPDATE_TEXT` | 텍스트 값 수정 |
    | `UPDATE_PROPS` | 변경된 속성·이벤트 반영 및 사라진 속성 제거 |
    | `MOVE` | 같은 부모 안에서 기존 노드 이동 |
- 키가 있는 자식은 Map으로 찾고, **키가 없는 자식은 키 없는 기존 자식끼리 순서대로 대응**시킵니다. 이후 작업 배열에 이동·삽입·삭제를 반영합니다.
- `indexOf`와 `splice`를 사용하므로 형제 수에 대해 **최악의 경우 이차 시간이 걸릴 수 있으며**, 대규모 목록용 최적화나 최소 이동 횟수를 보장하지 않습니다.

### 사용 예시

- 다음 코드는 브라우저용 TypeScript 모듈에서 사용합니다.

    ```tsx
    import {
      FunctionComponent, component, h, useCustomHook, useEffect, useMemo, useState,
    } from './src/runtime';
    import type { VNode } from './src/types';

    function Label(props: { text: string }): VNode {
      return h('span', null, props.text);
    }

    function useCounter() {
      const [count, setCount] = useState(0);
      return { count, increment: () => setCount(previous => previous + 1) };
    }

    function App(): VNode {
      const { count, increment } = useCustomHook(useCounter);
      const doubled = useMemo(() => count * 2, [count]);

      useEffect(() => {
        document.title = `count:${count}`;
      }, [count]);

      return h('section', null,
        component(Label, { text: `두 배:${doubled}` }),
        h('button', { onClick: increment }, count),
      );
    }

    const container = document.querySelector('#app');
    if (container === null) throw new Error('Missing #app');
    const app = new FunctionComponent(App, container);
    app.mount();
    // 제거할 때: app.unmount();
    ```

- `h()`는 중첩 자식 배열을 펼치고 문자열·숫자를 텍스트로 바꿉니다.
`null`, `undefined`, boolean 자식은 생략합니다.
- `key`와 `data-key`를 키로 받으며 명시적 `key`가 우선합니다.
숫자는 문자열로 변환하고, DOM에는 `data-key`로 출력합니다.
같은 부모 아래 중복 키는 `h()` 호출 시점이 아니라
`validateTree()`를 사용하는 파싱·diff·mount 시점에 거절합니다.
- 자식 컴포넌트는 `component(Child, props)`로 호출해야 훅 사용 금지가 검사됩니다.
일반 함수를 직접 호출하는 모든 경로를 자동으로 탐지하는 것은 아닙니다.
- 훅은 호출 순서로 슬롯을 구분합니다. 렌더 사이 호출 개수와 종류가 달라지면 오류입니다.
- `useState`는 값과 함수형 업데이트를 지원하고 `Object.is`로 같은 값이면 갱신을 생략합니다.
- `useEffect(fn)`, `useEffect(fn, [])`, `useEffect(fn, [value])`는 각각 매 렌더 후,
최초 한 번, 의존성 변경 시 실행합니다. 의존성 비교는 `Object.is`를 사용합니다.
- Effect 실행 중 setter 호출은 현재 Effect 묶음 종료 후 루트별로 모아 갱신합니다.
- 언마운트 정리 함수가 실패해도 나머지 정리와 DOM 제거를 수행한 뒤 `AggregateError`를 던집니다.
- 제거한 인스턴스는 재마운트할 수 없습니다. 새 `FunctionComponent`를 생성해야 합니다.
- 이력은 VNode 스냅샷이며 훅 상태나 외부 부수 효과를 복원하는 타임 트래블 기능은 아닙니다.

## 🤔 React와의 구현 차이

> 공통점은 **선언적으로 UI를 기술하고, 이전·다음 트리를 비교해 DOM 변경을 줄이며, 호출 순서와 의존성을 바탕으로 상태와 Effect를 관리**한다는 점입니다. 다만 다음 차이 때문에 React 코드를 그대로 실행할 수는 없습니다.
>

| 항목 | mini-react | React |
| --- | --- | --- |
| UI 표현 | `h('tag', props, children)`와 요소·텍스트 VNode. JSX 변환 설정 없음 | JSX 또는 `createElement`로 컴포넌트와 UI 표현 |
| 컴포넌트 상태 | 루트 인스턴스의 `hooks[]`만 상태 소유. 자식 호출은 즉시 VNode로 평가 | 자식도 독립 상태를 소유하고 트리상의 위치·타입·키로 상태 보존 [1] |
| 갱신 범위 | setter가 루트 함수를 재실행하고 전체 반환 VNode 비교 | 상태 갱신이 해당 컴포넌트의 렌더를 요청하고 기본적으로 자식도 재귀 렌더 [2] |
| 스케줄링 | 일반 setter는 즉시 동기 갱신. Effect 묶음 안에서만 갱신을 모음 | 이벤트 처리의 여러 상태 업데이트를 배치 처리 [3] |
| 비교·반영 | 재귀 비교로 경로 기반 Patch 배열을 만든 뒤 순서대로 적용. 별도 Fiber·우선순위 스케줄러 없음 | 렌더와 커밋 단계를 구분하고 커밋에서 필요한 DOM 변경 반영 [2] |
| 키 | 형제 DOM 요소 매칭에 사용하며 DOM의 `data-key`로도 출력 | 컴포넌트의 상태 보존·초기화에도 관여하는 식별자 [1] |
| 사용자 훅 | `useCustomHook(useSomething)` 래퍼에서 실행 문맥과 이름 검사 | `useSomething()`을 직접 호출해 상태 로직 재사용 [4] |
| `useState` 초기값 | 전달된 값을 그대로 저장. 지연 초기화 함수 실행 로직 없음 | 초기화 함수를 전달하는 지연 초기화 지원 [5] |
| Effect 시점 | DOM 반영 뒤 마이크로태스크에서 실행. 브라우저 paint 이후라는 보장 없음 | 커밋 후 실행하며 상호작용 여부에 따라 paint 전후 시점이 달라질 수 있음 [6] |
| 이벤트 | 요소마다 네이티브 `addEventListener`, WeakMap으로 기존 리스너 교체 | React 이벤트 객체와 이벤트 처리 체계 제공 [7] |
| 제공 범위 | 세 가지 내장 훅과 명시적 생명주기, DOM 렌더링 | 더 넓은 Hook/API와 생태계 제공 |
| 이력 | 학습용 VNode 스냅샷과 Back/Forward UI 제공 | 이 프로젝트 형태의 VNode 이력 UI는 별도 구현 대상 |

비교 참고 자료는 React 공식 문서입니다.

- 1. [Preserving and Resetting State][1]
- 2. [Render and Commit][2]
- 3. [Queueing a Series of State Updates][3]
- 4. [Reusing Logic with Custom Hooks][4]
- 5. [useState][5]
- 6. [useEffect][6]
- 7. [Common components: React event object][7]

[1]: https://react.dev/learn/preserving-and-resetting-state
[2]: https://react.dev/learn/render-and-commit
[3]: https://react.dev/learn/queueing-a-series-of-state-updates
[4]: https://react.dev/learn/reusing-logic-with-custom-hooks
[5]: https://react.dev/reference/react/useState
[6]: https://react.dev/reference/react/useEffect
[7]: https://react.dev/reference/react-dom/components/common#react-event-object

## 🙏 테스트 방식

### 실행 명령

```bash
bun run build
bun run test
bun run typecheck
```

- `build`는 앱과 테스트를 각각 `dist/main.js`, `dist/tests/browser.js`로 번들링합니다.
- `test`는 빌드를 수행하지 않으므로 소스 변경 후 먼저 빌드해야 합니다. 여기서 `bun run test`는 사용자 정의 스크립트이며 `bun test` 러너를 사용하는 것이 아닙니다.

### 실행 구조와 판정

1. `scripts/test.ts`가 임시 포트의 로컬 정적 서버를 실행합니다.
2. 기본 경로에서는 `Bun.WebView`로 `tests/index.html`을 엽니다.
`BROWSER_CDP_URL`이 있으면 대신 CDP로 새 테스트 탭을 생성합니다.
3. `tests/browser.ts`가 테스트 묶음을 순차 실행합니다.
각 테스트는 자체 assertion 함수로 값, DOM 구조, 노드 참조, 예외를 검사합니다.
4. 성공 시 `#results`에 `{ status: 'passed', count, passed }`를 기록합니다.
assertion 실패 시 `{ status: 'failed', error }`를 기록하고 해당 실행을 중단합니다.
5. 실행기는 `MutationObserver`로 결과 상태 변경을 감지합니다.
성공 상태가 아니거나 실행 오류가 발생하면 종료 코드가 실패로 처리됩니다.

- Effect 테스트는 고정 시간 sleep 대신 마이크로태스크를 진행시켜 실행 순서를 확인합니다.
- 무변경 갱신은 `MutationObserver.takeRecords()`로 DOM 쓰기 0건인지 검사하고,
키 이동은 노드 참조가 같은지 검사합니다.

### 테스트 범위

> 현재 브라우저 테스트 정의는 총 121개입니다.
>

| 파일 | 케이스 | 주요 검증 |
| --- | --- | --- |
| `tests/core.ts` | 46 | DOM 왕복 변환, 파싱·직렬화, 여섯 Patch, 키·속성·이벤트 |
| `tests/runtime.ts` | 33 | 이력, `h()`, 컴포넌트, 상태·Effect·Memo·사용자 훅 |
| `tests/regressions.ts` | 6 | 루트 교체, Effect 순서·취소, 컴포넌트 이름 |
| `tests/invariants.ts` | 7 | 입력 거절, 줄바꿈 보존, 매칭, 무변경·리스너 불변식 |
| `tests/demo.ts` | 13 | Phase 1·2 화면의 이벤트와 통합 동작 |
| `tests/demo-regressions.ts` | 4 | 이력 복원, DOM 동일성, 줄바꿈·메타데이터 |
| `tests/review.ts` | 12 | select, 파일 입력, 속성 처리, 정리 함수 예외 |
- 타입 검사는 `src/**/*.ts`와 `tests/**/*.ts`가 대상입니다.
- `scripts/`는 포함하지 않으며 별도 lint 스크립트와 커버리지 계측 설정은 없습니다. 실제 앱 진입점·시각적 강조·이력 버튼 경계 등 기존 테스트의 공백은 `TEST_REPORT.md`에 별도로 기록되어 있습니다.

### 브라우저 실행 환경

> 기본 WebView 경로에서 Chrome 자동 탐색에 실패하면 해당 운영 환경에서 실행할 수 있는 브라우저 경로를 Bun의 `BUN_CHROME_PATH` 환경 변수로 지정할 수 있습니다.
>

```bash
BUN_CHROME_PATH=/usr/bin/chromium bun run test
```

- 기존 격리 브라우저의 browser-level CDP WebSocket 주소는 `BROWSER_CDP_URL`, 브라우저가 접근할 별도 서버 주소는 `TEST_BASE_URL`로 전달합니다. `TEST_BASE_URL`을 사용하면 그 주소에서 최신 빌드와 테스트 페이지를 제공해야 합니다.
- 자동 실행이 어려우면 `bun run start` 후 `http://localhost:3000/tests/index.html`을 직접 열어 같은 테스트 결과를 확인할 수 있습니다. WSL에서 Windows Chrome 경로만 지정하는 방법은 실패한 기록이 있으므로, Linux용 브라우저 또는 접근 가능한 별도 CDP 환경이 필요할 수 있습니다.

### 결과

2026-11-11, WSL2 / Bun 1.4.4에서 확인했습니다.

| 검증 | 결과 |
| --- | --- |
| `bun run build` | 통과, 종료 코드 0 |
| `bun run typecheck` | `tsc`가 PATH에 없어 종료 코드 127 |
| 이미 설치된 캐시 TypeScript CLI로 `--noEmit` | 통과, 종료 코드 0 |
| `bun run test` | Chrome 탐색 실패로 종료 코드 1, 테스트 본문 실행 불가 |

## 🌧️ 알려진 한계

`TEST_REPORT.md`에는 다음 원본 구현 문제가 기록되어 있습니다. 명세의 예시와 현재 API가 다를 때는 `src/` 구현을 기준으로 읽어야 합니다.

- `parseHTML()` 트리에서 `h()` 트리로 갱신하는 혼합 경로에서 DOM의 `data-key`가 사라질 수 있습니다.
- Effect가 예외를 던지면 같은 묶음의 뒤쪽 Effect 실행이 중단됩니다.
- `StateHistory.go()`에 `NaN`이나 소수를 전달하면 커서가 손상될 수 있습니다.
데모 UI는 정수 `1`, `1`만 전달합니다.
- 실패한 마운트 뒤 같은 인스턴스를 재사용하면 이전 훅 슬롯이 남을 수 있습니다.
