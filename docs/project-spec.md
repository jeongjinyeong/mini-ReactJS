#### Phase 1. Virtual DOM + Diff + Patch

- •

  **`React`** 의 핵심 개념인 **`Virtual DOM`** 과 **`Diff`** 알고리즘을 구현합니다.
  - ◦

    브라우저의 **`DOM`** 정보를 읽어서 **`Virtual DOM`** 으로 변환하는 함수를 작성합니다.
  * ◦

    두 **`Virtual DOM`** 을 비교하여 변경된 부분을 찾아내는 **`Diff`** 알고리즘을 작성합니다.

* •

  이 알고리즘을 검증할 수 있는 웹 페이지를 구현합니다.
  - ◦

    페이지 내에 다음과 같이 2개의 영역과 **`Patch, 뒤로가기, 앞으로가기`** 버튼들이 있어야 합니다.
    - ▪

      실제 영역
    * ▪

      테스트 영역
  * ◦

    웹 페이지를 로드하면
    - ▪

      "실제 영역" 의 샘플 HTML 코드를 **`Virtual DOM`** 트리로 변환합니다.
  - ◦

    방금 만든 **`Virtual DOM`** 을 이용하여 테스트 영역을 렌더링합니다.
  * ◦

    사용자가 "테스트 영역" 에 있는 샘플 HTML 코드를 자유롭게 수정합니다.
  - ◦

    **`Patch`** 버튼을 누르면
    - ▪

      현재 테스트 영역 상태를 다시 **`Virtual DOM`** 으로 만듭니다.
    * ▪

      **`Diff`** 알고리즘을 이용해서 이전 **`Virtual DOM`** 과 비교하여 변경된 부분을 찾습니다.
    - ▪

      변경된 부분만 "실제 영역" 에 렌더링합니다.
    * ▪

      새로 변경된 **`Virtual DOM`** 은 **State History** 에 저장합니다.
  * ◦

    **`뒤로가기`**, **`앞으로가기`** 버튼을 눌러 state history 에 저장된 특정 **`Virtual DOM`** 으로 이동 가능하며 "실제 영역", "테스트 영역" 도 함께 변경되어야 합니다.

---

## 스택

- HTML, CSS, TypeScript 만을 사용하여 구현한다.
- React, Vue.js 등 외부 프레임워크나 라이브러리를 일체 사용하지 않는다.

## 웹 페이지 레이아웃

### 📝 테스트 웹 페이지

- Phase 1. 의 테스트 웹 페이지에는 “실제 영역”과, “테스트 영역” 으로 두 개의 영역이 있어야 한다.
- `Patch, 뒤로 가기, 앞으로 가기` 버튼이 존재해야한다.
- `Patch` 버튼의 시퀀스는 다음과 같다. 해당 함수명은 이해를 돕기 위한 예시일 뿐 다른 함수명으로 교체될 수 있다.
    
    ```mermaid
    sequenceDiagram
        actor U as 사용자
        participant D as 데모
        participant F as Diff
        participant P as Patch
    
        U->>D: Patch 클릭
        D->>D: 현재 편집기 HTML을 파싱·검증
        alt 지원하지 않는 입력
            D-->>U: 오류 표시
        else 유효한 입력
            D->>D: 파싱 결과를 VDOM으로 변환
            D->>F: diff(history[cursor], VDOM)
            F-->>D: 변경 목록
            alt 변경 목록이 비어 있음
                Note over D: 실제 영역과 이력 유지
            else 변경이 있음
                D->>P: applyPatches(actualContainer, changes)
                P->>P: 대상 경로를 DOM 노드로 해석한 뒤 변경 적용
                P-->>D: 적용 완료
                D->>D: cursor 이후 이력을 자르고 nextTree 저장
                D->>D: cursor와 탐색 버튼 상태 갱신
            end
        end
    ```
    
- `뒤로 가기/앞으로 가기` 버튼의 시퀀스는 다음과 같다. 해당 함수명은 이해를 돕기 위한 예시일 뿐 다른 함수명으로 교체될 수 있다.
    
    ```mermaid
    sequenceDiagram
        actor U as 사용자
        participant D as 데모
        participant F as Diff
        participant P as Patch
    
        U->>D: 뒤로 가기 또는 앞으로 가기 클릭
        D->>D: target = cursor - 1 또는 cursor + 1
        alt target이 이력 범위 밖
            Note over D: 현재 상태 유지
        else 이동 가능한 위치
            D->>F: diff(history[cursor], history[target])
            F-->>D: 변경 목록
            opt 변경 목록이 비어 있지 않음
                D->>P: applyPatches(actualContainer, changes)
                P-->>D: DOM 반영 완료
            end
            D->>D: cursor = target
            D->>D: 선택한 스냅샷으로 편집기와 미리보기 복원
            D->>D: 이전 입력 오류를 지우고 버튼 상태 갱신
        end
    ```
    
- 웹 페이지를 로드하면 “실제 영역”의 샘플 HTML 코드를 `Virtual DOM`  (이하 VDOM) 트리로 변환한다. 해당 VDOM을 이용하여 테스트 영역에 렌더링한다.
- 사용자는 “테스트 영역(HTML 편집기 같은 예시를 들 수 있다)”에 있는 샘플 HTML 코드를 자유롭게 수정할 수 있으며, `Patch` 버튼을 누르면 현재 테스트 영역 상태를 다시 VDOM으로 만들고, `Diff` 알고리즘을 이용해서 이전 VDOM과 비교하여 변경된 부분을 탐색한다.
- 변경된 부분만 “실제 영역” 에 렌더링하고 새로 변경된 VDOM을 State History (이하 히스토리) 자료구조에 저장한다.
- `뒤로 가기/앞으로 가기` 버튼을 눌러 히스토리에 저장된 특정 VDOM으로 이동 가능하며, “실제 영역”과 “테스트 영역”도 함께 변경되어야 한다.
- Patch 버튼을 누르면 이전 Real DOM에서부터 바뀐 영역만 갱신하면서 빨간색으로 2초간 시각적으로 구분할 수 있게 한다.
- 히스토리 배열은 웹페이지 위에 몇개가 있는지 보이게 한다.
- 뒤로가기, 앞으로가기 할때마다 현재 페이지가 배열의 어느 위치에 있는지 보이게 한다.
- Patch와 마찬가지로 히스토리로 변경할 때도 바뀐 영역이 갱신하면서 빨간색으로 2초간 시각적 구분이 가능하게 한다.

## 자료구조

### 🐟 VDOM

- 브라우저의 실제 DOM과 독립적으로, UI를 표현하는데 필요한 구조와 값만 `JavaScript` 자료구조에 저장한다.
- 우리의 `mini-react`에서는 더 엄격한 구조를 본뜨기 위해 `TypeScript`를 사용하여 정의한다.
- HTML 노드를 `VNode` 자료구조로 표현하고, HTML 요소를 표현하는 `Element Node` 와 텍스트를 표현하는 `Text Node`를 다음과 같은 `TypeScript` 자료구조로 표현한다. 또한, DOM의 노드 타입 체계를 가져온다. Phase 1에서의 VDOM 자료구조 초안은 다음과 같다.
    
    ```tsx
    enum VNodeType {
        ELEMENT = 1,
        TEXT = 3
    }
    
    interface VNode {
        type: VNodeType; /* 노드 종류인 ELEMENT 또는 TEXT */
    }
    
    interface VElement extends VNode {
        tagName: string; /* HTML 태그 이름 */
        key?: string; /* <li> 등 순서가 변경되는 UI 요소를 위한 고유 식별자 */
        props: { /* 속성, 이벤트 핸들러 등. Phase 2에서 이벤트 핸들러가 들어올 시 바뀔 가능성 존재 */ */
            [name: string]: string;
        };
        children: VNode[]; /* 하위 자식 노드 리스트 */
    }
    
    interface VText extends VNode {
        value: string; /* 텍스트 내용 */
    }
    ```
    
- 예를 들어, 해당 HTML은 다음과 같은 자료구조로 변환된다.
    
    ```html
    <button class="likes">좋아요 10</button>
    ```
    
    ```tsx
    const tree: VElement = {
    	type: VNodeType.ELEMENT,
    	tagName: "button",
    	props: {
    		class: "likes"
    	},
    	children: [
    		{
    			"type": VNodeType.TEXT,
    			"value": "좋아요 10"
    		}
    	]
    };
    ```
    
- 다만 `TypeScript`의 타입만으로는 완전히 강제하지 못하므로, `VElement.type`은 반드시 `VNodeType.ELEMENT`, `VText.type`은 반드시 `VNodeType.TEXT` 라는 제약 조건을 명시하고 함수에서 이를 보장해야 한다.
- `VNode`에서 `props` 속성은 HTML 요소에서, 문자열이 아닌 값도 들어갈 수 있다. 따라서 실제 DOM 프로퍼티와 이벤트 핸들러 등의 타입도 표현할 수 있어야 한다. 예시 속성은 다음과 같다. 해당 구조는 Phase 2에서 재점화 예정이다.
    
    ```tsx
    input.value;       // string
    checkbox.checked;  // boolean
    button.onclick;    // function 또는 null
    ```
    
- **별도의 `VTree` 자료구조는 선언하지 않는다. 루트 `VNode` 하나로 그 아래의 전체 트리를 표현한다.**

### 🌧️  `Diff` 비교와 갱신 기준

> 두 노드가 같은 종류의 요소라면 내부를 비교하고, 서로 다른 종류라면 해당 노드를 통째로 교체하자.
> 
- `mini-react`의 비교 알고리즘 초안은 다음 표와 같다.
    
    
    | **조건** | **수행 작업** |
    | --- | --- |
    | 이전 노드 **없음/**새 노드 **있음** | `INSERT` |
    | 이전 노드 **있음/**새 노드 **없음** | `REMOVE` |
    | 노드 타입이 다름 | `REPLACE`  |
    | 둘 다 요소인데 `tagName` 이 다름 | `REPLACE` |
    | 둘 다 텍스트인데 `value`가 다름(내용이 다름) | `UPDATE_TEXT` |
    | 같은 태그인데 `props`가 다름 | `UPDATE_PROPS` |
    | 기존 `props` 속성이 사라짐 | 해당 DOM 속성 제거 |
    | 같은 태그인데 자식이 존재함 | 부모 노드가 유지될 수 있다면, 자식끼리 재귀적으로 비교 |
    | 같은 노드인데 위치가 달라짐 | `MOVE` |
    | 자식 노드가 0개가 됨 | 기존 자식 모두 제거 |
    | `key` 중복 | 오류 처리 |
    | `key`는 같으나 태그가 변경됨 | `REPLACE` |
- 태그가 달라지는 경우의 예시. 우리의 `mini-react`는 태그가 달라진 노드를 루트로 하는 하위 트리 전체를 교체한다.
    
    ```tsx
    /* 이전의 DOM */
    <div>
      <h2>게시글</h2>
      <span>
        <strong>좋아요 10</strong>
      </span>
      <button>좋아요</button>
    </div>
    
    /* 새롭게 갱신될 DOM. span 태그가 p 태그로 변경되었다. */
    <div>
      <h2>게시글</h2>
      <p>
        <strong>좋아요 10</strong>
      </p>
      <button>좋아요</button>
    </div>
    ```
    
- 자식 노드의 개수가 달라지는 경우의 예시. 기존의 자식 노드는 유지하며, 노드를 추가하거나 삭제한다.
    
    ```tsx
    /* 이전의 DOM */
    <ul>
      <li>사과</li>
      <li>바나나</li>
    </ul>
    
    /* 새롭게 갱신될 DOM. "포도"라는 li 자식 노드가 추가되었다. */
    <ul>
      <li>사과</li>
      <li>바나나</li>
      <li>포도</li>
    </ul>
    ```
    
- `<li>` 태그처럼 같은 노드이나 순서가 달라질 경우(추가/삭제/정렬이 발생할 경우), 노드에 텍스트 뿐만이 아닌 버튼, 입력창, 이벤트 리스너 등의 `props`가 붙어 있을 수 있기에, 이전 VDOM과 새로운 VDOM의 노드를 대응시키기 위한 “고유 식별자”로 구분해야한다.
    
    ```tsx
    /* 고유 식별자는 다음과 같이 사용할 수 있다. */
    {
    	type: VNodeType.ELEMENT,
    	tagName: "li",
    	key: "post-42",
    	props: {},
    	children: []
    }
    ```
    
- 예를 들어 다음과 같은 상황일때는, 예시 결과처럼 작동해야한다.
    
    ```tsx
    /* 이전의 DOM */
    <ul>
      <li>포도</li>
      <li>사과</li>
      <li>바나나</li>
    </ul>
    
    /* 이전의 VDOM */
    [
    	{key: "A", tagName: "li" },
    	{key: "B", tagName: "li" },
    	{key: "C", tagName: "li" }
    ]
    
    /* 새롭게 갱신될 DOM. 내용은 유지된 채 순서만 바뀌었다. */
    <ul>
      <li>사과</li>
      <li>바나나</li>
      <li>포도</li>
    </ul>
    
    /* 새롭게 갱신될 VDOM */
    [
    	{key: "B", tagName: "li" },
    	{key: "C", tagName: "li" },
    	{key: "A", tagName: "li" }
    ]
    
    /* 
    	mini-react의 비교 알고리즘은 다음과 같이 작동한다.
    	1. 새로운 첫 번째의 노드의 키는 B -> 기존의 B 노드를 찾는다.
    	2. B를 첫 번째 위치로 옮긴다.
    	3. 두 번째의 노드의 키는 C -> 기존의 C 노드를 찾는다.
    	4. C를 두 번째 노드로 옮긴다.
    	5. B, C, A 이므로 종료한다.
    */
    ```
    
- 정리하면 다음과 같다.
    1. 기존 자식들의 `key`를 수집한다. 빠르게 찾을 수 있도록 `key → 기존 VDOM 노드 및 실제 DOM 노드` 대응표를 만든다.
    2. 새로운 자식 배열을 왼쪽부터 순회한다. 새 자식의 `key`로 이전 노드를 찾는다.
    3. 같은 `key`가 존재한다면 재사용한다. 내용이 달라졌다면 내부를 비교하고, 위치가 다르면 DOM을 이동한다.
    4. 존재하지 않는 `key`라면 새로운 노드를 생성한다.
    5. 새로운 목록에서 사라진 `key`는 제거한다.
- 고유 식별자 “key” 속성은 기본적으로 같은 부모의 자식들에서 비교하게 되므로 전체 페이지에서 유일할 필요 없이, 같은 부모 아래의 형제 노드들 사이에서만 유일하면 충분하다. 또한 렌더링할 때마다 바뀌어서는 안된다.
    
    
    | 상황 | 비교 기준 |
    | --- | --- |
    | `key`가 없는 일반 노드 | 위치와 노드 종류 |
    | `key`가 있는 노드 | 식별자와 노드 종류 |
    | `key`는 같지만 태그가 달라짐 | 노드 교체 |
    | `key`가 같고 위치만 달라짐 | 기존 노드 이동 |

### ⁉️고려사항

- HTML 요소에서 `key`를 어떻게 읽어오거나, 할당할 것인가?
- 그 외 고려사항들:

## 함수

| **모듈** | **핵심 함수** | **책임** |
| --- | --- | --- |
| VDOM 변환 | `fromDOM()` | 실제 DOM → VDOM |
| DOM 생성 | `toDOM()` | VDOM → 실제 DOM |
| 비교 | `diff()` | 이전과 새 VDOM 차이 계산 |
| 갱신 | `patch()` | 변경 사항을 실제 DOM에 적용 |
1. `fromDOM()` : DOM 객체를 바탕으로 VDOM 객체를 생성한다.
    
    ```jsx
    /* 텍스트도 객체로 통일하여, 다음과 같은 예시로 만든다. */
    function h(type, props, ...children) {
      return {
        type,
        props: props ?? {},
        children: children.flat().map((c) =>
          typeof c === "string" ? { type: "#text", value: c } : c
        ),
      };
    }
    ```
    
2. `toDOM()` : VDOM 객체를 바탕으로 실제 DOM 객체를 생성한다.
    
    ```jsx
    /* fromDOM()의 역순 흐름으로 구성한다. 다음과 같은 예시로 만든다. */
    function render(vnode) {
      /*
       * 객체의 타입에 맞게 처리
       * type이 "#text"이면 document.createTextNode(vnode.value)
       * type이 "function"이면 해당 함수 호출하고 반환값으로 다시 render
       * type이 "string"인 경우 type의 값이 "div", "p" 등의 태그로 createElement(vnode.type) 반환
       */
     }
    ```
    
3. `diff()` : 두 VDOM 트리를 비교한다.
    1. MVP는 DFS 탐색을 사용한다. 
    
    ```jsx
    old!==new
    ```
    
4. `patch()` : 변경된 사항을 바탕으로 페이지를 갱신한다.
    1. `diff()` 에서 전달받은 내용으로 페이지 업데이트
    2. 히스토리 자료구조에 변경된 VDOM을 저장한다.

### ⌛히스토리

- 웹페이지 렌더링 변경 이력을 저장할 히스토리 배열을 선언한다.
- 렌더링된 DOM의 원본인 VDOM을 최대 10개 저장한다.
- 사용자가 뒤로 가기로 이전 상태로 이동한 뒤 새 변경 사항을 Patch로 적용하면, 이력 배열에서 현재 위치 뒤에 있던 항목을 모두 삭제한다.
- 자료구조의 예시와 시퀀스는 다음과 같다.
    
    ```tsx
    /* VTree 배열은 예시일 뿐, 우리의 명세서에서는 VNode로 트리를 표현하기로 했다 */
    const history: VTree[] = [initialTree]
    let cursor: number = 0
    ```
    
    | **동작** | **이력** | **커서(Cursor)** |
    | --- | --- | --- |
    |  A에서 시작  |  `[A]`  |  `0`  |
    |  B, C를 차례로 적용  |  `[A, B, C]`  |  `2`  |
    |  뒤로 가서 B 표시  |  `[A, B, C]`  |  `1`  |
    |  B에서 변경 없이 Patch  |  `[A, B, C]`  |  `1`  |
    |  B에서 새 변경 D를 적용  |  `[A, B, D]`  |  `2`  |

## 테스트

### VDOM · 변환

- DOM → VNode → DOM으로 왕복했을 때 속성, `data-key`, 텍스트와 공백, 요소·텍스트 노드 종류가 보존되는지 검사

### Diff · 변경 판단

- 노드 종류나 태그가 바뀌면 해당 하위 트리를 `REPLACE`로 처리하는지 검사
- 키가 있는 목록을 `[A, B, C]` → `[B, C, A]`로 재정렬할 때 `MOVE`로 처리하고 기존 DOM 노드를 재사용하는지 검사
- 같은 부모 아래의 중복 키를 거절하고, 부모가 다르면 같은 키를 허용하는지 검사

### Patch · 실제 DOM 반영

- 변경 목록이 비어 있으면 DOM 쓰기가 0건이고, 변경이 있으면 해당 텍스트와 속성만 갱신하는지 검사
- `INSERT`  `REMOVE` 적용 시 대상 경로가 올바르게 해석되고 다른 형제 노드의 객체가 유지되는지 검사
- 루트 노드를 삽입하고 제거할 수 있는지 검사
- 키가 있는 노드를 이동할 때 들여쓰기용 공백 노드와 일반 형제 노드가 유지되는지 검사

### 데모·이력 통합

| 검사 | 결과 |
| --- | --- |
| 첫 로드에서 실제 DOM, 편집기, VNode 객체 코드, 첫 이력 위치가 일치하는지 | 통과 |
| 편집 중에는 VDOM 표시가 갱신되고, Patch가 클릭 시점의 HTML을 적용하는지 | 통과 |
| 잘못된 태그·속성·중복 키가 실제 DOM과 이력에 반영되지 않는지 | 통과 |
| B에서 변경 없이 Patch하면 앞으로 갈 이력이 유지되고, 새 D를 적용하면 C가 제거되는지 | 통과 |
| 이력 이동이 실제 DOM, 편집기, 객체 코드, 렌더링 미리보기를 복원하고 입력 오류를 지우는지 | 통과 |
| Patch와 이력 이동에서 변경된 실제 영역만 2초간 빨갛게 표시되는지 | 통과 |
| 이력이 최대 10개이고, 처음과 마지막에서 해당 탐색 버튼이 비활성화되는지 | 통과 |
| `<pre>` 첫 줄바꿈이 이력 복원 후 편집 없이 Patch해도 보존되는지 | **실패 → 수정 후 통과** |
| `&#13;`으로 입력한 CR이 이력 복원 후 텍스트와 속성 모두에서 보존되는지 | **실패 → 수정 후 통과** |

### 시나리오 테스트

| 기능 | 확인한 결과 |
| --- | --- |
| **FR-001 초기 화면** | 실제 화면·편집기·미리보기가 일치하고, 이력은 1개로 시작했습니다. |
| **FR-002 HTML 적용** | Patch를 누르자 `좋아요 10`이 `좋아요 11`로 바뀌었습니다. 같은 내용으로 다시 누르면 이력이 추가되지 않았습니다. |
| **FR-003 뒤로·앞으로** | 실제 화면·편집기·미리보기가 선택한 이력으로 함께 복원됐습니다. |
| **FR-004 변경 강조** | Patch와 이력 이동 모두 바뀐 부분만 2초간 빨갛게 강조됐습니다. |
| **FR-005 VNode 변환** | DOM을 VNode로 바꾼 뒤 다시 DOM으로 만들어도 속성·텍스트·자식 순서가 유지됐습니다. |
| **FR-006 Diff·Patch** | 텍스트·속성 수정과 노드 추가·삭제·교체를 한 번에 적용한 결과가 미리보기와 일치했습니다. |
| **FR-007 목록 이동** | `[포도, 사과, 바나나]`가 `[사과, 바나나, 포도]`로 바뀌면서 기존 노드가 재사용됐습니다. 중복 `key`는 오류로 표시됐습니다. |
| **FR-008 이력 분기와 한도** | B에서 새 변경 D를 적용하자 이후 이력 C가 제거됐습니다. 계속 적용해도 이력은 10개로 유지됐습니다. |