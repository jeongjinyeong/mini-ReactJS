# Phase 1 브라우저 테스트 목록

이 목록은 병합 후 Phase 1 회귀 사례를 기록합니다.
기본 Phase 1 목록 Diff는 자식을 재생성하고, 키 재사용 통합 사례 I9는 Phase 2의
`matchKeys: true` 옵션으로 검사합니다. 실행 방법은 [테스트 안내](README.md)에 있습니다.

이 문서는 `tests/phase1-browser-tests.js`의 모든 테스트를 **unit / integration / scenario**로 분류합니다.
같은 테스트 파일이 `standalone`과 `modules` 두 모드에서 실행되므로, 여기서는 **고유 테스트 케이스 수**만 기록합니다.

## 분류 기준

| 구분 | 기준 |
|---|---|
| **unit** | 하나의 엔진 함수(`fromDOM`, `toDOM`, `diff`, `patch`)만을 격리해 검증 |
| **integration** | `diff → patch` 또는 `fromDOM → toDOM` 같은 엔진 함수들의 실제 연동을 검증 |
| **scenario** | iframe 내 Phase 1 데모 UI를 통해 사용자 흐름(편집, Patch, 이력 탐색 등)을 검증 |

---

## 통계

| 구분 | 기존 | 신규 | 합계 |
|---|---:|---:|---:|
| unit | 0 | 5 | **5** |
| integration | 8 | 2 | **10** |
| scenario | 9 | 3 | **12** |
| **합계** | **17** | **10** | **27** |

기존 17건 = 8 integration + 9 scenario입니다.

---

## unit (5건)

| # | 이름 | 검증 내용 |
|---:|---|---|
| U1 | Unit: fromDOM은 주석을 제외하고 나뉜 텍스트 노드를 보존한다 | 주석은 제외하되 그 앞뒤 텍스트는 서로 다른 VText로 보존. 텍스트 병합은 데모 파서의 책임 |
| U2 | Unit: toDOM은 data-key와 checkbox checked 상태를 렌더링한다 | `toDOM`이 `data-key` 속성과 `input[type=checkbox]`의 `checked` 프로퍼티를 복원 |
| U3 | Unit: diff는 새 자식 목록이 비면 기존 자식을 모두 REMOVE한다 | `diff`가 빈 자식 목록을 만났을 때 모든 기존 자식에 대해 `REMOVE` 생성 |
| U4 | Unit: diff는 속성 추가·변경·삭제를 정확히 분류한다 | `diff`가 `UPDATE_PROPS`의 `set`/`remove`로 속성 추가·변경·삭제를 구분 |
| U5 | Unit: patch는 존재하지 않는 경로에서 오류를 던진다 | `patch`가 `resolve` 단계에서 경로가 없을 때 즉시 예외 발생 |

## integration (10건)

| # | 이름 | 검증 내용 |
|---:|---|---|
| I1 | FR-005 DOM → VNode → DOM에서 속성, data-key, 공백, 텍스트 종류 보존 | `fromDOM` → `toDOM` 왕복 시 속성/`data-key`/공백/텍스트/자식 구조 보존, DOM 객체는 새로 생성 |
| I2 | FR-006 빈 diff는 DOM을 쓰지 않고 변경된 텍스트와 속성만 갱신 | `diff`/`patch` no-op과 실제 변경 시 `MutationObserver` 기록이 달라진 속성/텍스트만 포함 |
| I3 | 일반 요소의 INSERT와 REMOVE는 앞에 있는 형제를 유지 | 일반 요소의 자식 삽입·제거에서 앞 형제의 DOM 객체를 유지 |
| I4 | FR-006 타입 또는 태그 변경은 하위 트리 전체 교체 | 타입/태그 변경 시 `REPLACE`로 하위 트리 전체를 교체하고 변경 범위 외 객체는 재사용 |
| I5 | FR-006 루트의 삽입과 제거 | `undefined ↔ VNode` 간 `INSERT`/`REMOVE`가 컨테이너 수준에서 동작 |
| I6 | 목록을 재정렬하거나 항목을 추가하면 자식을 전부 재생성 | 기본 모드에서 목록 요소와 주변 노드를 유지하고 기존 목록 자식을 제거·재생성 |
| I7 | 다른 요소의 변경은 같은 목록의 자식과 공백을 유지 | 목록 밖의 변경에서는 목록 자식과 공백 노드의 DOM 정체성을 유지 |
| I8 | data-key는 일반 HTML 속성으로 갱신 | 기본 모드의 `data-key` 변경은 속성 갱신으로 처리 |
| I9 | Integration: keyed 이동과 텍스트 갱신을 diff·patch로 한 번에 반영 | `matchKeys: true`에서 `MOVE`+`UPDATE_TEXT`를 생성하고 노드 재사용과 최종 텍스트를 검증 |
| I10 | Integration: 속성 추가·삭제·교체를 diff·patch로 반영하고 DOM 객체를 재사용한다 | `diff`가 `UPDATE_PROPS`를 생성하고 `patch`가 속성을 추가/삭제/변경하며 요소 객체 재사용 |

## scenario (12건)

| # | 이름 | 검증 내용 |
|---:|---|---|
| S1 | FR-001 초기 DOM, 편집기, VNode 객체, 첫 이력 위치가 일치 | 페이지 로드 시 실제 영역/편집기/미리보기/VDOM 객체/이력 위치가 일치 |
| S2 | FR-002 HTML 편집은 미리보기만 바꾸고 Patch가 현재 입력을 적용 | `input` 이벤트는 미리보기만 갱신, `Patch`는 최종 편집기 값을 실제 영역에 반영 |
| S3 | FR-002 잘못된 태그·속성은 실제 영역과 이력에 쓰지 않음 | 지원 범위 밖 입력은 오류 표시만 하고 실제 DOM/미리보기/이력/커서를 유지 |
| S4 | FR-002·003·008 B에서 no-op Patch는 redo를 유지하고 새 D는 C를 잘라냄 | 동일 스냅샷 재적용은 redo 보존, 중간에서 새 변경은 뒤 이력을 잘라냄 |
| S5 | FR-003 유효한 이력 이동이 오류를 지우고 실제·편집기·미리보기·객체를 복원 | 뒤로/앞으로 이동 시 오류 메시지를 지우고 선택한 스냅샷으로 전체 UI 복원 |
| S6 | FR-003·008 pre 첫 줄바꿈 스냅샷 복원 후 같은 HTML Patch는 no-op | `<pre>` 선행 줄바꿈이 이력 복원과 재적용에서도 유지되고 no-op으로 처리 |
| S7 | FR-003·008 문자 참조의 CR이 텍스트와 속성에서 이력 복원 후 유지 | `&#13;` 문자 참조가 텍스트/속성에 모두 보존 |
| S8 | FR-004 Patch와 이력 복원 시 바뀐 실제 DOM만 2초간 빨간색 강조 | 변경된 요소에만 2000ms 빨간색 outline 애니메이션, 변경되지 않은 요소에는 없음 |
| S9 | FR-008 이력 10개 상한과 삭제 후 처음·마지막 이동 경계 | 이력 한도 10개 초과 시 가장 오래된 항목 제거, 처음/마지막에서 버튼 비활성화 |
| S10 | FR-002 checkbox input의 checked 상태가 Patch 후에도 반영된다 | `input[type=checkbox]`의 `checked` 속성 추가/제거가 Patch 후 DOM에 반영 |
| S11 | FR-002 빈 입력과 여러 최상위 노드도 파싱되어 Patch된다 | 빈 입력과 여러 루트 노드를 가진 HTML이 파싱/적용되고 이력에 저장 |
| S12 | FR-002 aria-invalid와 오류 표시가 유효성 상태를 반영한다 | 유효/무효/복구 입력에서 접근성 속성, 오류 가시성, 마지막 유효 미리보기와 복구 후 갱신 검증 |

---

## 추가 정보

- 실행 파일: `tests/phase1-browser-tests.js`
- 실행기: `tests/run-phase1-tests.mjs` (`standalone`, `modules`, `all` 모드 지원)
- 신규 테스트 수: 10건 (unit 5 + integration 2 + scenario 3)
- 발견된 기존 결함: 정적 분석 및 추가 테스트 설계 과정에서 확인된 런타임 결함은 없음

## fuzzing 항목

아래 네 항목은 위 27개 고정 사례와 별도로, 각 생성 반복에서 검사합니다.
생성기 깊이, 자식 수, 속성 수를 제한하고 형제 key를 유일하게 유지합니다.
각 반복의 DOM은 초기화하며 모든 난수는 지정한 seed에서 나옵니다.

| ID | 항목 | 기대 결과 |
|---|---|---|
| F1 | VNode → 실제 DOM → VNode 왕복 | 생성한 원본 VNode와 구조·속성·텍스트가 동일 |
| F2 | `diff(v, v)` | 빈 변경 목록 |
| F3 | 기존 트리를 한 번 변형한 뒤 `diff → patch` | 새 트리를 처음부터 렌더한 DOM과 동일 |
| F4 | 유일한 key를 가진 형제 목록의 무작위 순열 | 목표 순서와 자식 수가 정확하며 모든 실제 노드 객체 재사용 |

실행: `node tests/run-fuzz.mjs <seed> <iterations>`.
기본 300회, 지정 가능 범위 1~10,000회이며,
테스트 전체가 아닌 엔진의 생성형 속성 검사다. 코드 커버리지를 계측하지 않는다.
실제 실행 seed, 횟수와 결과는 [결과 보고서](../docs/test-report.md)에 기록한다.

## mutation 항목

변이용 기준 suite는 `mutation-unit-tests.js`의 아래 11개다.
앞의 회귀 27개를 모두 실행하는 suite가 아니므로 개수나 점수를 합산하지 않는다.

| ID | 기준 입력/동작 | 기대 결과 |
|---|---|---|
| MB1 | 동일 트리 비교 | 빈 diff |
| MB2 | 텍스트 값 변경 | UPDATE_TEXT |
| MB3 | class 값 변경 | UPDATE_PROPS와 새 class 값 |
| MB4 | 요소 태그 변경 | REPLACE |
| MB5 | 빈 목록에 자식 추가 | INSERT |
| MB6 | 목록 자식 제거 | REMOVE |
| MB7 | 키 형제 순서 교환 | 최종 트리 일치와 기존 DOM 객체 재사용 |
| MB8 | 같은 부모의 중복 key | 예외 |
| MB9 | 텍스트·속성 변경 후 Patch | 새 렌더링과 동일한 최종 트리 |
| MB10 | 주석 앞뒤 텍스트 변환 | 주석 제외, 텍스트 경계 보존 |
| MB11 | 서로 다른 부모에 같은 key | 허용 |

아래는 병합 전 `feat/dom-to-vnode`의 `diff.js:12-19`와 `patch.js:65-68`에서
Stryker가 생성한 변이 기록이다. 현재 캠페인의 범위는 `stryker.config.json`을 기준으로 확인한다.

| 변이 연산자 | 생성 수 | 바뀌는 동작 |
|---|---:|---|
| BlockStatement | 2 | 블록 본문 제거 |
| MethodExpression | 2 | 속성 선택 필터 제거 |
| ArrowFunction | 2 | 콜백 반환 동작 변경 |
| ConditionalExpression | 5 | 조건을 상수 참/거짓으로 변경 |
| LogicalOperator | 2 | 논리 연산 변경 |
| BooleanLiteral | 2 | 불리언 판정 반전 |
| EqualityOperator | 1 | 동등 비교 변경 |
| ObjectLiteral | 1 | 패치 객체 제거 |
| StringLiteral | 2 | 작업 종류 문자열 변경 |
| CallExpression | 3 | 속성 변경 또는 변경 대상 기록 호출 제거 |
| 합계 | **22** | |

기대 검출 조건은 기준 테스트의 실패이며, 최종 14개가 검출되고 8개가 생존했다.
각 변이의 원본 위치·대체 코드·실제 상태는
[JSON 원본](mutation-constrained-report.json)에, 생존 8개의 검증 공백은
[상세 분석](../docs/testing-analysis.md)에 있다.
