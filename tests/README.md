# 테스트

테스트 기준은 [`docs/testing.md`](../docs/testing.md)를 따른다.

테스트는 브라우저에서 실행한다. `npm run dev`로 개발 서버를 띄우고
`/tests/index.html`을 열면 [`engine.test.ts`](engine.test.ts)가 실행되어
케이스별 통과·실패와 합계가 페이지와 탭 제목에 표시된다.

`npm test`는 아직 설정하지 않았다. 브라우저 인수 테스트(P1-E1–P1-E8)는 데모 페이지에서 직접 확인한다.
