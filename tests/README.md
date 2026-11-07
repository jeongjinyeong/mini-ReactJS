# 테스트

현재 실행 가능한 테스트는 없다. 테스트 기준은
[`docs/testing.md`](../docs/testing.md)의 P1-01–P1-12와 P1-E1–P1-E8을 따른다.

DOM → VNode 변환은 구현되어 있지만 브라우저 검증은 아직 수행하지 않았다.
다음은 `toDOM` 구현과 DOM 왕복 변환 검증이다. 브라우저 테스트 페이지,
TypeScript 테스트, 작은 assertion 함수를 추가해 다음 순서로 확인한다.

1. P1-01: `fromDOM`의 재귀 변환, 공백·순서 보존, 주석 제외, 미지원 노드 오류와 원본 보존.
2. P1-07의 스냅샷 부분: input의 HTML 속성과 현재 프로퍼티 구분, `checked: false` 보존.
3. P1-02: `toDOM` 생성과 `fromDOM` 재독해의 값 일치, 생성 노드의 분리 상태와 입력 VNode 비변경.

P1-07의 Patch 적용 검증은 Diff·Patch 구현 후 진행한다.
아직 테스트 러너나 성공으로 표시되는 빈 테스트는 만들지 않는다.
