# mini-react

## Phase 2 · 컴포넌트와 Hooks

[장바구니 실습 HTML](demo/phase2/demo.html)을 Chrome에서 열면 실행됩니다.

- **+1**을 누르면 `App`의 상태가 바뀌고 `FruitRow`와 `CartSummary`에 새 props가 전달됩니다.
- **담은 과일만**을 누르면 필터 Effect의 정리와 실행, `useMemo`의 저장값 재사용을 볼 수 있습니다.
- **컴포넌트 제거**를 누르면 마지막 Effect가 정리됩니다. **다시 마운트**하면 초기값으로 돌아옵니다.

구현은 [src/phase2/runtime.js](src/phase2/runtime.js)에 있습니다. `h(Child, props)`로 자식 컴포넌트를 호출하며, `defineHook(function useName() { ... })`으로 사용자 Hook을 등록할 수 있습니다. 목록의 `key`는 `data-key`로 변환하고 기존 Phase 1 Diff·Patch로 반영합니다.

[Phase 2 명세](docs/phase-2-spec.md) · [브라우저 테스트 안내](tests/README.md)

## Phase 1 · HTML 편집과 이력

[데모 HTML](demo/phase1/demo.html)을 Chrome에서 열면 바로 실행됩니다.

1. HTML을 편집해 Virtual DOM의 JavaScript 객체를 확인합니다. 렌더링 결과는 **렌더링 미리보기**에서 볼 수 있습니다.
2. **Patch**를 눌러 실제 DOM에 반영합니다. 목록의 자식이 달라지면 해당 목록의 자식을 모두 새로 만듭니다. 적용한 부분은 빨간색으로 2초간 강조됩니다.
3. **뒤로 가기**와 **앞으로 가기**로 실제 화면, 편집기, VDOM을 함께 복원합니다.

## 소스와 검증

- [src/phase1/](src/phase1/)에는 DOM 변환, Diff, Patch 엔진이 있습니다.
- [demo/phase1/](demo/phase1/)에는 편집기와 데모 화면의 소스가 있습니다.

소스를 바꾼 뒤 저장소 루트에서 `node demo/build-demo.js`를 실행하면 두 Phase의 단독 실행 HTML이 갱신됩니다.

테스트는 저장소 루트에서 `node tests/run-phase1-tests.mjs`로 실행합니다. 설치된 Chrome을 사용하며, [테스트 실행 안내](tests/README.md)에서 실행 옵션을 확인할 수 있습니다.
