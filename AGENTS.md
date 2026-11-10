# mini-react 작업 안내

## 현재 상태

2026-11-09 기준 Phase 1의 엔진과 데모가 구현되어 있다. `src/engine/`에 VDOM 타입(`vnode.ts`), `fromDOM`·`toDOM`(`dom.ts`), `diff`(`diff.ts`), `patch`(`patch.ts`)가 있고, `src/demo/`에 편집기·미리보기·이력 탐색 데모(`main.ts`), 이력(`history.ts`), 입력 검증(`validate.ts`)이 있다. 브라우저 진입점은 루트 `index.html`이다. 자동 테스트는 개발 서버의 `/tests/index.html`에서 실행하는 브라우저 테스트(`tests/engine.test.ts`)이며 `npm test`는 아직 설정하지 않았다. 실행 명령은 README, 테스트 실행 방법은 `tests/README.md`를 참고한다. 검증 결과는 실행한 환경과 실제 출력을 확인해 기록한다.

## 읽는 순서

1. [requirements.md](docs/requirements.md)에서 이번 단계의 기능과 완료 기준을 확인한다.
2. [architecture.md](docs/architecture.md)에서 레포 구조, Virtual DOM 타입, Diff 규칙, HTML 입력 경계를 확인한다.
3. [testing.md](docs/testing.md)에서 지금 만들 기능에 대응하는 테스트를 고른다.

프로젝트의 출발점과 타깃 사용자는 [README.md](README.md)에 있다. 기능을 구현하거나 이 문서들을 손볼 때도 그 배경과 기대 효과를 보존한다.

## Phase 1 작업 순서

1. 작은 브라우저 샘플에서 `DOM → VDOM → DOM` 왕복을 구현하고 혼합 텍스트와 공백을 검증한다.
2. 텍스트 하나 변경을 Diff → Patch로 연결한다. 대상 밖 형제 노드가 같은 객체인지 확인한다.
3. 추가·삭제·교체·속성 변경까지 확장하고 입력 컨트롤의 프로퍼티를 검증한다.
4. 실제 영역, 테스트 영역의 HTML 편집기·미리보기, Patch 버튼, 뒤로·앞으로를 연결한다. 이력 분기와 유효하지 않은 입력을 검증한다.

## 작업할 때

- 현재 요청과 실제 파일을 먼저 확인한다. 문서에 적힌 계획과 실제 구현 상태를 구분하고, 확인한 테스트 결과만 보고한다.
- HTML, CSS, TypeScript를 쓴다. 엔진은 `src/engine/`, 브라우저 데모는 `src/demo/`, 테스트는 `tests/`에 둔다. 브라우저 진입점은 루트 `index.html`을 사용한다.
- Phase 1에서 만든 Diff와 Patch는 Phase 2에서도 재사용한다. 이번 주에는 Phase 1을 끝내고 컴포넌트와 Hooks는 Phase 2에서 다룬다.
- 기존 문서가 정한 계약을 바꿔야 하면 요구사항, 설계, 테스트에서 영향을 받는 항목을 함께 맞춘다.
- 결과물을 우선 완성하고, 사용자가 구현을 설명할 수 있게 답변은 한국어로 결론부터 적는다. 첫 설명은 “이전 트리와 다음 트리를 비교해 어떤 DOM 노드를 왜 유지했는가”에서 시작한다.
- YAGNI 원칙을 적용하고, Ponytail Skill을 적용한다. 최대한 표준 라이브러리 내에서 구현하거나, 구현 방법을 설명한다.
