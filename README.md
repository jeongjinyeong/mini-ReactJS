<div align="center">

# mini-react

**다음 화면을 데이터로 표현하고, 달라진 DOM만 갱신하기.**

Virtual DOM부터 Diff, Patch, Component, Hooks까지 직접 만드는 TypeScript UI 프로젝트.

<p>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&amp;logo=vite&amp;logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/status-in%20development-2563EB?style=flat-square" alt="개발 중">
</p>

[소개](#overview) · [시작하기](#getting-started) · [구현 예제](#example) · [로드맵](#roadmap) · [문서](#documentation)

</div>

---

## Overview

**상태가 달라지면 다음 화면의 모습을 정의하고, 실제 DOM에서 무엇을 바꿀지는 mini-react에 맡긴다.**

크래프톤 정글 과제로 시작한 이 프로젝트는 HTML, CSS, TypeScript로 UI 갱신 엔진을 직접 구현한다. 외부 UI 프레임워크 없이 DOM을 데이터로 읽는 것부터 시작해, 이전 트리와 다음 트리를 비교하고 변경점만 반영하는 구조를 만든다.

| 목표 | 접근 |
| --- | --- |
| **화면을 데이터로** | 요소·속성·텍스트·자식 순서를 Virtual DOM으로 표현한다. |
| **변경은 필요한 곳에만** | Diff가 변경 목록을 만들고 Patch가 해당 DOM 노드에 적용한다. |
| **하나의 상태, 일관된 UI** | 루트 컴포넌트의 상태로 다음 트리를 계산하고 자식에는 props로 내려 준다. |

```text
Phase 1   실제 DOM → Virtual DOM → Diff → Patch → 실제 DOM
Phase 2   상태 변경 → Component + Hooks → 다음 Virtual DOM → 같은 엔진 재사용
```

### 현재 구현 상태

현재 **Phase 1과 Phase 2의 엔진과 데모가 구현**되어 있다.

| 범위 | 상태 |
| --- | --- |
| DOM → VDOM (`fromDOM`) | 요소·속성·텍스트 재귀 변환, 공백 보존, 주석 제외, `data-key` → `key`, input의 현재 `value`·`checked` 읽기 |
| VDOM → DOM (`toDOM`) | 구현 |
| Diff (`diff`) | `INSERT`·`REMOVE`·`REPLACE`·`UPDATE_TEXT`·`UPDATE_PROPS`·`MOVE`, `key` 기반 대응, `key` 중복 오류 |
| Patch (`patch`) | 경로를 먼저 DOM 노드로 해석한 뒤 변경 대상만 수정 |
| HTML 편집기 / 미리보기 / 이력 탐색 | 구현. 이력은 최대 10개, 바뀐 영역은 2초간 빨갛게 표시 |
| Component (`h`, `FunctionComponent`) | 함수형 컴포넌트와 props, `mount()`·`update()`·`unmount()`. JSX 없이 `h`를 직접 호출 |
| Hooks | `useState`·`useEffect`·`useMemo`, 사용자 정의 Hook. 루트 컴포넌트에서만 호출 가능 |
| 이벤트 | `onClick` 같은 함수 props. 한 핸들러 안의 상태 변경은 한 번의 갱신으로 반영 |
| Phase 2 데모 | 과일 장바구니와 컴포넌트·Hook·VDOM 검사 화면(`/phase2.html`) |
| 항공편 데모 | 시간 위에서 휠을 돌리면 출발 항공편이 바뀌는 플랩 안내판(`/flights.html`, 더미 데이터) |
| 자동 테스트 | 브라우저 테스트 페이지(`/tests/index.html`). `npm test`는 미설정 |

## Getting started

```sh
git clone https://github.com/jeongjinyeong/mini-ReactJS.git
cd mini-ReactJS
git switch feat/dom-to-vnode
npm ci
npm run dev
```

개발 서버가 출력한 주소의 `/`에서 Phase 1 데모를, `/phase2.html`에서 Phase 2 데모를, `/flights.html`에서 항공편 데모를, `/tests/index.html`에서 테스트 결과를 연다. 데모 소스는 `src/demo/`에 둔다.

### Commands

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run check` | TypeScript 타입 검사 |
| `npm run build` | 타입 검사 후 두 데모 페이지 빌드 |
| `npm test` | 아직 미설정이며 실패 코드로 종료. 테스트는 브라우저에서 실행한다. [테스트 안내](tests/README.md) 참고 |

## Example

`fromDOM`은 DOM 노드 하나와 그 자손을 `VNode` 데이터로 변환한다. `diff`는 두 트리의 차이를 변경 목록으로 만들고, `patch`는 그 목록만큼만 실제 DOM을 고친다. 다음은 브라우저에서 실행하는 TypeScript 예제다.

```ts
import { diff } from "./src/engine/diff";
import { fromDOM } from "./src/engine/dom";
import { patch } from "./src/engine/patch";

const actual = document.createElement("div");
actual.innerHTML = '<button class="likes">좋아요 10</button>';
const previous = fromDOM(actual);

const draft = document.createElement("div");
draft.innerHTML = '<button class="likes">좋아요 11</button>';
const next = fromDOM(draft);

const changes = diff(previous, next);
patch(actual, changes); // 기존 button 노드는 그대로 두고 텍스트만 바꾼다.
```

```ts
// previous
{
  type: VNodeType.ELEMENT,
  tagName: "div",
  props: {},
  children: [
    {
      type: VNodeType.ELEMENT,
      tagName: "button",
      props: { class: "likes" },
      children: [{ type: VNodeType.TEXT, value: "좋아요 10" }],
    },
  ],
}

// changes
[{ type: "UPDATE_TEXT", path: [0, 0], value: "좋아요 11" }]
```

원본 DOM은 읽는 동안 수정하지 않는다. 별도의 트리 타입은 없고 루트 `VNode` 하나가 전체 트리를 표현한다. 형제의 순서가 바뀌는 요소는 HTML의 `data-key` 속성으로 `key`를 준다.

## Roadmap

### Phase 1 · Virtual DOM, Diff, Patch

- [x] `VNode`·변경 목록 타입 정의
- [x] DOM → VNode 기본 변환과 지원 input 상태 읽기
- [x] VNode → DOM 생성 및 왕복 변환 검증
- [x] 추가·삭제·교체·이동·텍스트·속성·프로퍼티 변경을 구분하는 Diff와 `key` 기반 대응
- [x] 변경 대상 밖 노드의 객체 참조를 유지하는 Patch
- [x] HTML 편집기·미리보기·입력 검증과 Patch 버튼
- [x] 초기 스냅샷과 성공한 변경을 저장하는 이력, 뒤로·앞으로 탐색
- [x] 모듈 테스트 (브라우저 테스트 페이지)
- [ ] 브라우저 인수 테스트 P1-E1–P1-E8 전체 기록

예를 들어 `<h1>Hello</h1><p>World</p>`에서 제목만 바꾸면, 제목의 텍스트를 수정하고 기존 `p` 노드는 재사용하는 것이 목표다. 화면이 같다는 것뿐 아니라 **어떤 노드를 왜 유지했는지**도 검증한다.

<details>
<summary>Phase 1 데모의 목표 사용 흐름</summary>

1. 실제 영역의 샘플 DOM을 스냅샷으로 읽어 편집기와 미리보기를 채운다.
2. HTML을 편집하면 미리보기에서 초안을 확인한다. 실제 영역은 아직 바뀌지 않는다.
3. **Patch**를 누르면 초안과 직전 스냅샷을 비교해 실제 영역에 반영한다.
4. 변경이 있는 Patch에 성공했을 때만 새 스냅샷을 이력에 저장한다.
5. **뒤로·앞으로** 이동하면 실제 영역·편집기·미리보기를 함께 복원한다.
6. 뒤로 간 위치에서 새 변경을 적용하면 이후 이력을 새 경로로 바꾼다. 변경 없는 Patch는 기존 이력을 유지한다.

</details>

### Phase 2 · Component, State, Hooks

- [x] 함수형 컴포넌트 조합과 props 전달
- [x] `FunctionComponent` 인스턴스의 `mount()`·`update()`와 Hook 슬롯 관리
- [x] `useState`를 통한 상태 변경과 자동 DOM 갱신
- [x] DOM 반영 이후의 `useEffect` 및 정리 함수
- [x] 의존성 기반 계산 재사용을 위한 `useMemo`
- [x] 하나의 루트 상태를 공유하는 여러 자식의 UI 일관성 검증
- [x] 연속 상태 변경을 한 번의 갱신으로 묶기
- [ ] 브라우저 인수 테스트 P2-E1–P2-E6 전체 기록

Hook과 상태는 루트가 소유한다. 자식은 props로 받은 값과 콜백을 사용하며, Phase 1의 Diff와 Patch를 그대로 재사용한다.

```ts
import { FunctionComponent, h, useState } from "./src/engine/component";

function Counter({ count, onAdd }: { count: number; onAdd: () => void }) {
  return h("button", { type: "button", onClick: onAdd }, `좋아요 ${count}`);
}

function App() {
  const [count, setCount] = useState(10);
  return h("div", null, h(Counter, { count, onAdd: () => setCount((previous) => previous + 1) }));
}

new FunctionComponent(App, document.body).mount(); // 클릭하면 button의 텍스트만 바뀐다.
```

## Why mini-react?

좋아요 하나를 눌렀을 때 버튼 표시, 게시글의 좋아요 개수, 사이드바의 개수를 각각 수정하면 어느 한 곳을 놓치기 쉽다. **같은 상태에서 다음 UI를 계산하고, 이전 화면과 비교하는 일을 공통 코드로 옮길 수 있을까?** 이 프로젝트는 그 질문을 작은 브라우저 구현으로 확인한다.

- **데이터와 UI의 일관성:** 같은 정보를 표시하는 여러 영역을 하나의 상태 흐름으로 연결한다.
- **유지보수:** 이벤트·상태·DOM 갱신이 뒤섞이는 대신, 다음 화면의 정의와 갱신 절차를 분리한다.
- **갱신 범위:** 매번 전체 화면을 만드는 대신 어떤 노드를 수정하고 재사용하는지 확인한다.

<details>
<summary>출발점과 대상 사용자</summary>

서버에서 HTML을 만드는 SSR 이후에도 JavaScript와 AJAX로 화면을 갱신할 수 있다. 상호작용이 적을 때는 직접 DOM을 수정하는 방식이 간단하지만, 같은 데이터가 여러 곳에 표시되면 동기화 경로를 추적하기 어려워진다.

Backbone.js, Knockout.js, AngularJS 같은 도구의 MVC/MVVM, 이벤트, 템플릿과 데이터 바인딩에서 모델과 뷰를 연결하는 아이디어를 얻었다. 여기서는 다음 화면을 데이터로 정의하고 비교하는 접근을 직접 구현한다.

주요 사용자는 **JavaScript로 동적인 화면을 만들고 유지보수하는 프론트엔드 개발자**다. 과제 참여자는 상태와 DOM의 관계를 구현하고 설명할 수 있는 것을 목표로 한다.

| 관점 | 확인할 질문 |
| --- | --- |
| 프론트엔드 개발자 | 상태로 UI를 정의하고 컴포넌트를 재사용하기 쉬운가? |
| 기술 리더 | 기존 앱 일부에 적용할 수 있고 도입·확장 비용에 비해 유지보수에 도움이 되는가? |
| QA 엔지니어 | 같은 입력에 같은 결과가 나오며 변경 순서를 재현할 수 있는가? |
| 백엔드 개발자 | 기존 API에서 받은 데이터를 UI에 연결하기 쉬운가? |
| 최종 사용자 | 클릭·입력에 반응하고 같은 정보가 일관되게 표시되는가? |
| 라이브러리 유지보수자 | 모듈의 역할이 분명하고 회귀를 테스트로 찾을 수 있는가? |

기존 앱에 대한 점진적 도입과 API 연동은 기획의 고려 사항이다. Phase 1의 인수 범위는 DOM 갱신 엔진과 데모다.

</details>

### 무엇으로 검증하는가?

아래는 이미 달성한 성과가 아니라 구현으로 확인할 가설이다. DOM 쓰기 감소와 실행 시간 개선은 구분해서 측정한다.

| 기대 효과 | 검증 기준 |
| --- | --- |
| 개발 생산성 | 직접 DOM을 조작하는 구현과 반복 갱신 코드 비교 |
| UI 일관성 | 하나의 상태를 읽는 버튼과 두 카운터의 값 일치 |
| 재사용·유지보수 | 카운터 추가·변경 시 수정해야 하는 코드 범위 비교 |
| DOM 갱신 범위 | 변경 종류·범위 기록 및 대상 밖 Node 참조의 `===` 유지 |
| 렌더링 비용 | 같은 브라우저·입력에서 Diff 시간과 Layout·Paint 비용을 나눠 반복 측정 |
| 기능 정확성 | 초기 렌더·부분 갱신·이력 복원·경계 입력 테스트 |

## Project structure

```text
mini-react/
├─ index.html       # Phase 1 데모 진입점과 샘플 DOM
├─ phase2.html      # Phase 2 데모 진입점
├─ flights.html     # 항공편 데모 진입점
├─ src/
│  ├─ engine/       # Virtual DOM 타입, DOM 변환, Diff, Patch, 이력, 컴포넌트와 Hook
│  └─ demo/         # Phase 1 편집기·이력 UI, Phase 2 장바구니와 검사 화면
├─ tests/           # 브라우저 테스트 페이지와 테스트 코드
└─ docs/            # 요구사항, 아키텍처, 테스트 계획
```

의존 방향은 `demo → engine`이다. 컴포넌트와 Hook은 `src/engine/component.ts`에 있다.

## Documentation

| 문서 | 내용 |
| --- | --- |
| [요구사항](docs/requirements.md) | Phase 1·2 기능 범위와 인수 기준 |
| [아키텍처](docs/architecture.md) | Virtual DOM 타입, Diff 규칙, Patch 경로, HTML 입력 경계 |
| [테스트 계획](docs/testing.md) | 모듈·브라우저 검증 절차와 선택 성능 측정 |
| [테스트 추가 안내](tests/README.md) | 첫 테스트를 추가하는 방법 |
| [작업 안내](AGENTS.md) | 프로젝트 규칙과 구현 순서 |
