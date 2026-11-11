# mini-react 브라우저 회귀 테스트

저장소 루트에서 Node.js와 설치된 Chrome으로 실행합니다. 추가 패키지가 필요하지 않습니다.

```powershell
node tests/run-phase1-tests.mjs
node tests/run-phase2-tests.mjs
```

복사한 테스트로 다른 작업 트리를 검사할 때는 첫 인자에 저장소 경로를 지정합니다. 마지막 인자는 기본값인 all 외에도 standalone 또는 modules를 받을 수 있습니다.

```powershell
node tests/run-phase1-tests.mjs 'C:\Users\jm\Documents\GitHub\mini-ReactJS' standalone
```

Chrome이 일반적인 설치 경로에 없으면 CHROME_PATH 환경 변수에 실행 파일의 전체 경로를 지정합니다. 격리된 개발 실행 환경에서 Chrome이 자체 샌드박스를 열 수 없는 경우에만 CHROME_NO_SANDBOX를 1로 지정합니다.

- standalone은 임시 HTML에 삽입한 단독 데모를 검사합니다. 파일 접근 플래그나 서버 없이 원본 단독 데모의 임베드 모듈을 실행합니다.
- modules는 개발용 index.html의 실제 파일과 ES 모듈 진입점을 검사합니다. 테스트의 브라우저에만 로컬 파일 접근 플래그를 사용합니다.
- 테스트는 공개 엔진 함수와 실제 DOM, 데모의 조작 버튼과 이력 표시를 확인합니다. 브라우저 프로필과 실행용 HTML은 임시 폴더에 작성한 뒤 정리합니다.

## WSL에서 Windows Chrome 사용

Linux Node.js에서 Windows Chrome을 직접 실행하면 임시 파일 경로 형식이 맞지 않을 수 있습니다.
Windows Node.js와 Windows Chrome을 함께 사용하면 기존 실행기를 그대로 실행할 수 있습니다.
아래는 이번 검증 환경의 경로이며, 설치 위치가 다르면 조정합니다.

```sh
"/mnt/c/Program Files/nodejs/node.exe" tests/run-phase1-tests.mjs
"/mnt/c/Program Files/nodejs/node.exe" tests/run-phase2-tests.mjs
```

## 항목과 결과

- Phase 1은 고유 27건, Phase 2는 고유 14건입니다. Phase 1의 추가 10건은 [테스트 목록](TEST-CASES.md)에 있습니다.
- `all`은 각 사례를 두 모드에서 실행합니다. 정상 종료 코드는 0이며, 실패 또는 브라우저 실행 오류는 1입니다.
- [기존 Phase 1 결과 보고서](../docs/test-report.md): 병합 전 작업 트리의 실행 환경, 실제 통과 수, 검증 한계.
- [변이·퍼징 분석](../docs/testing-analysis.md): 입력 생성, 변이 범위와 상세 결과.

브라우저 회귀 테스트는 런타임 패키지를 추가로 설치하지 않습니다.
변이 도구가 사용하는 개발 의존성과 실행 절차는 [변이·퍼징 분석](../docs/testing-analysis.md)에서 별도로 다룹니다.

현재 VNode의 키는 `props['data-key']`에 저장합니다. 기본 Phase 1 Diff는 목록 자식을 재생성하고,
Phase 2의 키 기반 재사용은 `diff(previous, next, { matchKeys: true })`로 검사합니다.
추가된 키 재사용 테스트와 퍼징도 이 명시적 옵션을 사용합니다.
아래 분석 보고서와 저장된 변이 결과는 `feat/dom-to-vnode`의 과거 실행 기록이며,
병합 후 엔진에서 같은 수치가 나온다는 의미는 아닙니다.

## 스킬 기반 구조 인식 퍼징

`harness-writing` 스킬의 결정적 입력 생성, 크기 제한, 반복별 상태 초기화,
독립 비교 오라클 원칙을 JavaScript와 실제 Chrome DOM에 적용했습니다.
이는 libFuzzer/AFL의 커버리지 유도 퍼징이 아닌 **seed 기반 생성형 퍼징**입니다.

```sh
# seed=42, 1,000회. 반복 수 생략 시 300회
node tests/run-fuzz.mjs 42 1000
```

WSL에서는 앞의 Windows Node.js 경로로 `node`를 대체합니다.
실패 시 출력된 seed와 반복 번호로 같은 입력 흐름을 재현할 수 있습니다.
실행기는 오류를 종료 코드 1로 보고하고 임시 프로필을 정리합니다.

검증 항목은 DOM/VNode 왕복, 동일 트리 diff의 멱등성,
증분 Patch와 새 렌더링의 동등성, 무작위 키 재정렬의 **정확한 순서와 객체 정체성**입니다.
엔진에 직접 VNode를 전달하므로 데모의 HTML 허용 목록을 검사하는 퍼징은 아닙니다.

## 변이 테스트

전용 브라우저 기준 테스트 11개로 `diffProps`와 `UPDATE_PROPS`의 속성 처리 구간을 평가합니다.
회귀 27개 전체나 모든 엔진 코드가 변이 대상인 것은 아닙니다.

```powershell
# 먼저 원본 기준 테스트
node tests/run-mutation-tests.mjs

# 검증에 사용한 도구 버전 설치 후 캠페인 실행
npm install -g @stryker-mutator/core@10.1.1
stryker run tests/stryker.config.json --logLevel info
```

WSL에서는 기준 테스트에 Windows Node.js를 사용하고,
캠페인은 `cmd.exe /c "stryker run tests/stryker.config.json --logLevel info"`로 실행합니다.
Stryker 설치는 Windows npm 환경에 하며 저장소의 런타임 의존성은 늘리지 않습니다.
자동 생성 결과는 [mutation-constrained-report.json](mutation-constrained-report.json)에 기록됩니다.

저장된 과거 캠페인 결과는 22개 중 Killed 14개, Survived 8개, timeout/error 0개입니다.
현재 범위는 `stryker.config.json`을 기준으로 하며, 병합 후 캠페인은 별도로 실행해야 합니다.
종료 코드 0은 캠페인 완료를 의미하며 생존 변이가 없다는 뜻은 아닙니다.
