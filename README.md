# mini-react Phase 1

HTML을 VNode로 변환하고, 이전·다음 트리의 차이를 실제 DOM에 적용하는 학습용 프로젝트입니다.
React 컴포넌트나 Hooks를 실행하는 라이브러리가 아니라 **DOM 변환 → Diff → Patch**의 동작을
확인하는 Phase 1 구현입니다. 런타임 의존성이나 별도 번들러 설치 없이 데모를 열 수 있습니다.

## 데모 사용

[데모 HTML](demo/phase1/demo.html)을 Chrome에서 열면 바로 실행됩니다.

1. HTML을 편집해 Virtual DOM의 JavaScript 객체를 확인합니다. 렌더링 결과는 **렌더링 미리보기**에서 볼 수 있습니다.
2. **Patch**를 눌러 실제 DOM에 반영합니다. 적용한 부분은 빨간색으로 2초간 강조됩니다.
3. **뒤로 가기**와 **앞으로 가기**로 실제 화면, 편집기, VDOM을 함께 복원합니다.

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

## 테스트와 분석 문서

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
