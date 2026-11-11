![mini-react](src/img/image.png)

# mini-react

DOM을 Virtual DOM으로 변환하고 Diff·Patch로 화면을 갱신하는 학습용 프로젝트입니다.
Phase 1의 HTML 편집기와 이력 기능 위에 Phase 2의 함수 컴포넌트,
`useState`, `useEffect`, `useMemo`를 구현했습니다. React API 전체와 호환되는 라이브러리는 아닙니다.

## 데모

빌드된 단독 HTML은 Chrome에서 파일을 열어 바로 실행할 수 있습니다.

- [Phase 1: HTML 편집과 이력](demo/phase1/demo.html)
- [Phase 2: 장바구니와 Hooks](demo/phase2/demo.html)
- [국제선 도착 전광판](demo/flight-board/demo.html)

### Phase 1: HTML 편집과 이력

1. HTML을 편집하면 VNode와 렌더링 미리보기가 갱신됩니다.
2. **Patch**를 누르면 실제 영역에 변경을 반영하고, 변경 영역을 2초간 강조합니다.
3. **뒤로 가기 / 앞으로 가기**로 편집기와 실제 DOM, VNode를 복원합니다.
   스냅샷은 최대 10개를 저장합니다.

편집기는 지원하는 HTML 태그·속성만 받습니다. 기본 Diff에서는 `ul`·`ol`의
자식이 달라지면 목록의 자식을 모두 재생성합니다. Phase 2의 키 기반 재사용과는 별도 동작입니다.

### Phase 2: 컴포넌트와 Hooks

구현 위치는 [src/phase2/runtime.ts](src/phase2/runtime.ts)이며,
브라우저에서는 컴파일된 [runtime.js](src/phase2/runtime.js)를 실행합니다.

- `FunctionComponent`: `mount()`, `update()`, `unmount()`와 VNode 이력을 관리합니다.
- `h(tag, props, ...children)`: VNode를 만들고, `h(Child, props)`로 자식 컴포넌트를 조합합니다.
- `useState(initialValue)`: 상태와 setter를 반환합니다. 함수형 업데이트를 지원하며
  `Object.is`로 같은 값이면 갱신을 생략합니다.
- `useEffect(effect, deps?)`: DOM 반영 후 동기 실행합니다. 의존성이 바뀌면 이전 cleanup 후
  새 Effect를 실행하고, unmount에서도 cleanup을 실행합니다.
- `useMemo(calculate, deps?)`: 의존성이 같으면 저장한 계산 결과를 재사용합니다.
- `defineHook(function useName() { ... })`: 사용자 Hook을 등록합니다.

상태와 Hooks는 루트 컴포넌트만 소유하고, 자식은 props만 받습니다.
Hooks는 렌더링마다 같은 순서와 개수로 호출해야 합니다.
`key`는 `data-key`로 변환되며, 런타임이 `diff(..., { matchKeys: true })`를 사용해
같은 키의 형제 DOM을 재사용합니다.

장바구니에서 **+1**로 상태와 자식 props 갱신을, **담은 과일만**으로 Effect cleanup과
Memo 재사용을, **컴포넌트 제거 / 다시 마운트**로 정리와 초기화를 확인할 수 있습니다.

### 국제선 도착 전광판

서울 시각으로 시작하는 가상 항공편 전광판입니다. 휠을 아래로 돌리면 +5분,
위로 돌리면 -5분 이동하며, 휠을 멈추면 항공편이 위에서부터 한 줄씩 확정됩니다.
[TypeScript 소스](demo/flight-board/demo.ts)에서 컴포넌트와 Hooks 사용을 볼 수 있습니다.

## 실행과 검증

Node.js, npm과 Chrome이 필요합니다. 개발 의존성인 TypeScript 버전은 lockfile로 고정합니다.

```sh
npm ci
npm run build
npm run typecheck
node tests/run-phase1-tests.mjs
node tests/run-phase2-tests.mjs
```

`npm run build`는 `.ts`를 같은 경로의 `.js`로 컴파일한 뒤 세 데모의 단독 HTML을 갱신합니다.
소스를 수정한 후 다시 빌드해야 하며, 정적 파일 서버는 필수가 아닙니다.
Chrome을 자동 탐색하지 못하면 `CHROME_PATH`를 지정합니다.
회귀 테스트는 단독 HTML(`standalone`)과 실제 ES 모듈(`modules`)을 모두 검사합니다.
WSL에서 Windows Node·Chrome을 사용하는 방법과 추가 분석 명령은
[테스트 실행 안내](tests/README.md)에 있습니다.

## 구조

```text
src/phase1/             DOM ↔ VNode, Diff, Patch의 TypeScript와 생성된 JavaScript
src/phase2/runtime.ts   컴포넌트 생명주기, 상태, Hooks
demo/phase1/           HTML 편집·미리보기·이력 데모
demo/phase2/           장바구니·Hooks 데모
demo/flight-board/     전광판 데모
demo/build-demo.js     오프라인 단독 HTML 생성
tests/                 Phase 1·2 브라우저 회귀와 퍼징·변이 분석
docs/                  명세와 분석 문서
```

## 문서 모음

- [Phase 1 명세](docs/project-spec.md): HTML 입력과 VNode, Diff·Patch, 이력 계약.
- [Phase 2 명세](docs/phase-2-spec.md): 컴포넌트, 상태, Hooks와 Phase 1 연계.
- [테스트 실행 안내](tests/README.md): Phase 1·2 실행 옵션과 WSL, 퍼징·변이 명령.
- [Phase 1 테스트 목록](tests/TEST-CASES.md): 단위·통합·시나리오 사례.
- [Phase 1 테스트 결과 보고서](docs/test-report.md): 병합 전 분석 결과와 환경 기록.
- [Phase 1 변이·퍼징 분석](docs/testing-analysis.md): 기존 캠페인의 범위와 생존 변이.
- [Phase 1과 React의 비교 분석](docs/react-comparison.md): 병합 전 Phase 1 구현의 상세 분석.

분석 보고서의 기존 수치는 `feat/dom-to-vnode` 작업 트리에서 얻은 과거 결과입니다.
현재 브랜치의 Phase 2와 병합 후 검증 결과로 해석하면 안 됩니다.
현재 API는 `.ts` 구현과 위 실행 명령을 기준으로 확인하세요.

## React와의 구현 차이

공통점은 이전·다음 트리를 비교해 DOM 변경을 줄이고, Hook 호출 순서와 의존성으로
상태·계산·부수 효과를 관리한다는 점입니다.

| 항목 | mini-react Phase 1·2 | React |
| --- | --- | --- |
| UI 표현 | HTML 파싱 또는 `h()`. JSX 변환 없음 | JSX 또는 `createElement` |
| 상태 소유 | 루트 인스턴스의 `hooks` 배열, 자식은 props만 사용 | 자식도 독립 상태를 소유하고 위치·타입·키로 보존 [1] |
| 갱신 | setter가 루트 함수를 동기 재실행하고 Diff·Patch 적용 | 렌더와 커밋을 구분하고 여러 상태 갱신을 배치 처리 [2][3] |
| 키 | Phase 2에서 형제 DOM 재사용. DOM의 `data-key`로도 출력 | 컴포넌트 상태 보존·초기화에 사용하는 식별 정보 [1] |
| 사용자 Hook | `defineHook(useSomething)`으로 등록 | `useSomething()`을 직접 호출해 로직 재사용 [4] |
| `useState` | 값 또는 함수형 setter. 초기값은 전달된 값 그대로 저장 | 초기화 함수를 통한 지연 초기화도 지원 [5] |
| Effect 시점 | DOM 반영 직후 같은 호출 안에서 실행 | paint 전후 실행 시점은 상호작용 등의 조건에 따라 달라짐 [6] |
| 이벤트 | 컨테이너의 네이티브 click 위임, VNode별 핸들러 관리 | React 이벤트 객체와 이벤트 처리 체계 제공 [7] |
| 이력 | 최대 10개의 VNode 스냅샷. Hook 상태 복원 기능은 아님 | 이 프로젝트 형태의 undo/redo UI는 별도 구현 대상 |
| 제공 범위 | 세 가지 내장 Hook과 컴포넌트 생명주기 | 더 넓은 Hook·API와 생태계 |

Phase 2의 키 매칭은 Map과 배열 이동을 사용하며 대규모 재정렬에서 이차 비용이 날 수 있습니다.
Fiber, 우선순위 스케줄링, SSR/hydration이나 React 전체 API는 구현하지 않았습니다.

### React 공식 참고 문서

1. [Preserving and Resetting State][1]
2. [Render and Commit][2]
3. [Queueing a Series of State Updates][3]
4. [Reusing Logic with Custom Hooks][4]
5. [useState][5]
6. [useEffect][6]
7. [Common components: React event object][7]

[1]: https://react.dev/learn/preserving-and-resetting-state
[2]: https://react.dev/learn/render-and-commit
[3]: https://react.dev/learn/queueing-a-series-of-state-updates
[4]: https://react.dev/learn/reusing-logic-with-custom-hooks
[5]: https://react.dev/reference/react/useState
[6]: https://react.dev/reference/react/useEffect
[7]: https://react.dev/reference/react-dom/components/common#react-event-object
