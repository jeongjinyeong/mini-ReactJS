# mini-ReactJS Phase 1 퍼징/뮤테이션 테스트 분석

이 문서는 본 세션에서 구현·실행한 **결정론적 구조 인식 생성 퍼징**과
**Stryker 뮤테이션 테스트** 결과를 기록한다.

> fuzz harness(`tests/fuzz-core.js`, `tests/run-fuzz.mjs`)는 Main이 최종 보정 및
> 검증을 마쳤다. 최종 fuzz 수치는 `docs/test-report.md`를 참조한다.
> 본 문서의 "퍼징" 절은 해당 최종 결과를 인용만 한다.

---

## 1. 실행 환경

| 항목 | 값 |
|------|-----|
| OS | Linux WSL2 (Windows 11 host) |
| Node.js | `C:\Program Files\nodejs\node.exe` v24.16.0 |
| Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` 157.0.8103.50 |
| Bun | 1.4.4 (WSL) |
| Stryker | `@stryker-mutator/core` 10.1.1 (Windows 전역 npm) |

---

## 2. 결정론적 구조 인식 생성 퍼징 (최종 결과)

### 2.1 모드

- **deterministic-generative-structure-aware**
- 커버리지 가이드 퍼저(libFuzzer/AFL 등)가 아님.
- 분할혼합(splitmix32) 시드 PRNG로 구조화된 VNode/HTML 트리를 생성하고
  행동 오라클(behavioral oracle)을 검증한다.

### 2.2 오라클

1. **roundtrip**: `fromDOM(toDOM(v))`가 `v`와 동일
2. **idempotence**: `diff(v, v)`는 빈 배열
3. **patch-equivalence**: `patch(toDOM(old), diff(old, new))`로 만든 DOM이
   `toDOM(new)`와 동일
4. **keyed-identity**: 평면 키 목록을 셔플한 후 patch 시 같은 data-key를 가진
   DOM 객체가 재사용되고, 최종 DOM의 순서/개수도 새 트리와 일치하는지 확인

### 2.3 최종 실행 결과

Main이 보정한 최종 harness로 아래 시드에서 각 1,000회 반복 실행했다.

| seed | iterations | passed | failed | exit code |
|------|------------|--------|--------|-----------|
| 0    | 1,000      | 1,000  | 0      | 0         |
| 1    | 1,000      | 1,000  | 0      | 0         |
| 42   | 1,000      | 1,000  | 0      | 0         |
| 2026 | 1,000      | 1,000  | 0      | 0         |
| 20261111 | 1,000  | 1,000  | 0      | 0         |
| **합계** | **5,000** | **5,000** | **0** | **0** |

위 실행에서 관측된 엔진 실패는 없다. 전체 입력에서의 무결함을 뜻하지 않는다.

상세 명령과 재현 방법은 `docs/test-report.md`에 기술되어 있다.

---

## 3. Stryker 뮤테이션 테스트

### 3.1 사전 준비 및 전제 조건

Stryker는 `genotoxic` skill의 권고에 따라 실제 뮤테이션 프레임워크로 선정했다.
Trailmark 기반 그래프 분석은 실행하지 않았다. 도구가 설치되어 있지 않아
`genotoxic`의 전체 그래프 기반 워크플로를 완료했다고 주장하지 않는다.
아래 분류는 소스와 변이 결과를 검토한 것이며 도달 가능성·blast radius 계측 결과가 아니다.

**설치:**

```bash
cmd.exe /c npm install -g @stryker-mutator/core@10
```

설치 결과: `@stryker-mutator/core` 10.1.1이 Windows 전역 npm에 추가됨.
같은 버전을 재현하려면 `npm install -g @stryker-mutator/core@10.1.1`로
정확한 버전을 지정한다. 저장소에 package.json이나 런타임 의존성은 추가하지 않았다.

### 3.2 범위

- **타겟**: `src/phase1/diff.js` 12-19행(`diffProps`) 및
  `src/phase1/patch.js` 65-68행(`UPDATE_PROPS` 분기)
- **테스트 커맨드**: `node tests/run-mutation-tests.mjs`
- **활성화 방식**: Stryker는 `process.env.__STRYKER_ACTIVE_MUTANT__`로
  돌연변이를 활성화한다. 브라우저 JS 환경은 Node의 `process.env`를 물려받지
  않으므로, `tests/run-mutation-tests.mjs`가 하네스 HTML에 클래식
  `<script>` 태그로 `window.__stryker__ = { activeMutant: ... }`를 주입한다.
  이렇게 하지 않으면 모든 돌연변이가 "survived"로 잘못 집계된다.

### 3.3 재현 명령

```bash
# WSL에서 Windows Stryker 실행
cmd.exe /c "stryker run tests/stryker.config.json --logLevel info"
```

Windows 터미널에서는 `stryker run tests/stryker.config.json --logLevel info`로 실행한다.
설정의 기본 `mutate` 자체를 위 두 구간으로 제한했으므로 별도 옵션 없이 전체 파일로 확대되지 않는다.
Chrome 자동 탐색 실패 시 `CHROME_PATH`를 지정한다.

### 3.4 탐색적 실행 (exploratory, 최종 보고서 근거 아님)

- `src/phase1/diff.js:1-40`: 57 mutants, 36 killed, 14 survived, 7 timeout,
  score 75.44%, 164초.
- `src/phase1/patch.js:1-40`: 33 mutants, 15 killed, 18 survived, 0 timeout,
  score 45.45%, 31초.

이들은 범위가 넓고 일부 mutant가 Stryker timeout까지 도달해
캠페인 시간이 예측 불가능했으므로, 최종 보고서는 더 응집력 있는 범위로
제한했다. 탐색 결과는 최종 점수와 합산하지 않으며 임시 탐색 로그는 산출물에서 제외했다.

### 3.5 최종 bounded campaign

| 파일 | 범위 | mutants | killed | survived | timeout | errors | score |
|------|------|---------|--------|----------|---------|--------|-------|
| diff.js | 12-19 | 18 | 12 | 6 | 0 | 0 | 66.67% |
| patch.js | 65-68 | 4 | 2 | 2 | 0 | 0 | 50.00% |
| **합계** | | **22** | **14** | **8** | **0** | **0** | **63.64%** |

- **종료 코드**: `0`
- **소요 시간**: 하위 에이전트 실행 17.6초, 주 조정자의 최종 설정 재실행 약 16초
- **기계 판독 가능 보고서**: `tests/mutation-constrained-report.json`
- **사용한 suite**: 전용 브라우저 기준 테스트 11개. 회귀 27개 전체나 저장소 전체의 점수가 아니다.
- **점수 해석**: 14 / 22 × 100 = 63.64%. 종료 코드 0은 캠페인의 정상 완료이며 모든 변이 검출을 뜻하지 않는다.

### 3.6 생존 돌연변이 분류

| JSON ID | 파일:행 | 돌연변이 | 분류 | 사유 및 추가할 검증 |
|---|--------|----------|------|------|
| 1 | diff.js:13 | `set` 필터 제거 | 전용 suite의 검증 공백 | 변경 없는 속성이 `set`에 포함되지 않는지 확인 |
| 3 | diff.js:14 | 필터 조건을 `true`로 변경 | 전용 suite의 검증 공백 | 최소 변경 집합과 불필요한 DOM 쓰기 검사 |
| 6 | diff.js:14 | `!Object.hasOwn` → `Object.hasOwn` | 전용 suite의 검증 공백 | 새 속성을 추가할 때 `set`에 포함되는지 확인 |
| 9 | diff.js:15 | `remove` 필터 제거 | 전용 suite의 검증 공백 | 유지할 속성이 `remove`에 포함되지 않는지 확인 |
| 10 | diff.js:15 | 필터가 `undefined` 반환 | 전용 suite의 검증 공백 | 삭제 대상이 있을 때 `remove`와 실제 DOM 확인 |
| 11 | diff.js:15 | `!Object.hasOwn` → `Object.hasOwn` | 전용 suite의 검증 공백 | 제거·유지 속성을 함께 넣어 분리 확인 |
| 20 | patch.js:66 | `removeAttribute` 호출 생략 | 전용 suite의 검증 공백 | 제거 패치 후 `hasAttribute`가 false인지 확인 |
| 22 | patch.js:68 | `affected.add(target)` 생략 | 전용 suite의 검증 공백 | 속성 변경 대상이 반환 목록에 포함되는지 확인. 누락 시 강조도 사라짐 |

8개 모두 전용 11개 테스트의 검증 공백으로 분류했다.
특히 `affected.add` 제거는 공개 반환값과 강조 동작에 영향을 주므로 동등 변이가 아니다.
회귀 suite에는 속성 추가·제거와 no-op 쓰기 검증도 있으므로,
위 표를 저장소 전체에 해당 테스트가 없다는 주장으로 읽으면 안 된다.
생존 변이 자체가 원본 코드에 같은 결함이 존재한다는 증거도 아니다.

---

## 4. 브라우저 회귀 기준선

```bash
/mnt/c/Program\ Files/nodejs/node.exe tests/run-phase1-tests.mjs
```

- **종료 코드**: `0`
- **standalone**: 27/27 pass
- **modules**: 27/27 pass
- **mutation unit baseline**: 11/11 pass (`node tests/run-mutation-tests.mjs`)

---

## 5. 결론 및 한계

- **퍼징**: Main이 최종 보정한 결정론적 구조 인식 생성 퍼저로 5,000회
  실행하여 실패를 발견하지 못했다(`docs/test-report.md` 참조).
- **뮤테이션**: Stryker를 사용해 `diffProps`와 `UPDATE_PROPS`라는 명시적
  범위에서 22개 돌연변이를 테스트했다. 14개 kill, 8개 survived,
  0 timeout/error, score 63.64%를 기록했다. 생존자 8개는 전용 suite의 검증 공백으로 분류했다.
- **그래프 분석**: Trailmark 기반 graph 분석은 본 세션에서 실행하지 않았다.
  향후 graph-aware variant 분석이 필요하면 Trailmark 설치 후 재실행할 수
  있다.
- **한계**: 뮤테이션 커맨드는 Chrome을 매 mutant마다 새로 띄우므로, 더 넓은
  범위는 시간이 크게 늘어난다. 따라서 최종 보고서는 속성 업데이트라는
  응집력 있는 두 코드 블록으로 범위를 제한했다.

---

## 6. 산출물

- `tests/mutation-unit-tests.js`
- `tests/run-mutation-tests.mjs`
- `tests/stryker.config.json`
- `tests/mutation-constrained-report.json`
- `docs/testing-analysis.md`
