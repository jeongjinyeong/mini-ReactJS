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
