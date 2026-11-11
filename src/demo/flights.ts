/* 항공편 출발 안내판. 시간 위에서 휠을 돌리면 시간이 바뀌고 그 시간 이후의 항공편을 보여 준다.
   상태(시간)는 루트 App만 가지고, 자식은 props만 받는다. 데이터는 더미다. */
import { FunctionComponent, h, useEffect, useMemo, useState } from "../engine/component";
import type { VNode } from "../engine/vnode";

/* ───────── 더미 데이터 ───────── */

interface Flight {
  time: number; // 자정부터의 분
  destination: string;
  code: string;
  gate: string;
  note: "" | "DELAYED" | "CANCELLED";
}

const DAY = 24 * 60;
const MIN_ROWS = 3; // 창이 아주 낮아도 이만큼은 보여 준다.
/* 처음 보여 줄 시간: 페이지를 연 시각을 5분 단위로 내린 값 */
const START = new Date().getHours() * 60 + Math.floor(new Date().getMinutes() / 5) * 5;
const DESTINATIONS = [
  "TOKYO", "OSAKA", "FUKUOKA", "NEW YORK", "LOS ANGELES", "VANCOUVER", "PARIS", "LONDON",
  "FRANKFURT", "STUTTGART", "DUESSELDORF", "ZUERICH", "GOETEBORG", "RIGA", "HELSINKI", "ROME",
  "MADRID", "DUBAI", "SINGAPORE", "BANGKOK", "HANOI", "MANILA", "HONG KONG", "TAIPEI", "SYDNEY",
  "JEJU", "BUSAN",
];
const AIRLINES = ["KE", "OZ", "LH", "AF", "BA", "JL", "SQ", "EK", "AY", "LX"];

/* 하루치 항공편을 한 번만 만든다. 같은 씨앗을 쓰므로 새로 고쳐도 같은 표가 나온다. */
const FLIGHTS: Flight[] = (() => {
  let seed = 7;
  const random = (limit: number): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >>> 16) % limit; // 아래쪽 비트는 규칙적으로 되풀이되므로 위쪽 비트를 쓴다.
  };
  const flights: Flight[] = [];
  for (let time = 5; time < DAY; time += 5 + random(4) * 5) {
    const chance = random(20);
    flights.push({
      time,
      destination: DESTINATIONS[random(DESTINATIONS.length)],
      code: `${AIRLINES[random(AIRLINES.length)]}${100 + random(900)}`,
      gate: `${"ABCD"[random(4)]}${String(1 + random(40)).padStart(2, "0")}`,
      note: chance === 0 ? "CANCELLED" : chance < 3 ? "DELAYED" : "",
    });
  }
  return flights;
})();

/* 지금 시간 이후에 출발하는 항공편 rows개. 자정을 넘으면 다음 날 첫 편으로 이어진다. */
function departuresFrom(now: number, rows: number): Flight[] {
  const start = FLIGHTS.findIndex((flight) => flight.time >= now);
  const first = start === -1 ? 0 : start;
  return Array.from({ length: rows }, (_, offset) => FLIGHTS[(first + offset) % FLIGHTS.length]);
}

function remark(flight: Flight, now: number): string {
  if (flight.note) return flight.note;
  const left = (flight.time - now + DAY) % DAY;
  return left <= 10 ? "GATE CLOSED" : left <= 25 ? "BOARDING" : left <= 45 ? "GO TO GATE" : "";
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/* ───────── 컴포넌트 ───────── */

/* 글자 하나가 플랩 한 칸이다. 칸 수가 항상 같아서 다시 렌더링하면 바뀐 글자의 텍스트만 갱신된다. */
function Flaps({ text, length, tone = "" }: { text: string; length: number; tone?: string }): VNode {
  return h("span", { class: `flaps ${tone}`.trim(), "aria-label": text.trim() || "없음" },
    Array.from(text.padEnd(length).slice(0, length), (letter) => h("span", { class: "flap", "aria-hidden": "true" }, letter)),
  );
}

/* 휠을 돌리거나 위·아래 화살표 키를 누르면 onStep(+1 또는 -1)을 부른다. */
function Dial({ label, value, onStep }: { label: string; value: string; onStep: (direction: number) => void }): VNode {
  return h("span",
    {
      class: "dial",
      role: "spinbutton",
      tabindex: "0",
      "aria-label": label,
      "aria-valuenow": String(Number(value)),
      onWheel: (event) => {
        event.preventDefault(); // 페이지가 같이 스크롤되지 않게 한다.
        const direction = wheelStep((event as WheelEvent).deltaY);
        if (direction !== 0) onStep(direction);
      },
      onKeyDown: (event) => {
        const key = (event as KeyboardEvent).key;
        if (key !== "ArrowUp" && key !== "ArrowDown") return;
        event.preventDefault();
        onStep(key === "ArrowUp" ? 1 : -1);
      },
    },
    h(Flaps, { text: value, length: 2 }),
  );
}

function Clock({ now, onChange }: { now: number; onChange: (minutes: number) => void }): VNode {
  const [hours, minutes] = clock(now).split(":");
  return h("div", { class: "clock" },
    h(Dial, { label: "시", value: hours, onStep: (direction) => onChange(direction * 60) }),
    h("span", { class: "colon", "aria-hidden": "true" }, ":"),
    h(Dial, { label: "분", value: minutes, onStep: (direction) => onChange(direction * 5) }),
  );
}

function FlightRow({ flight, now }: { flight: Flight; now: number }): VNode {
  const note = remark(flight, now);
  const tone = note === "DELAYED" || note === "CANCELLED" ? "warn" : note === "BOARDING" ? "go" : "";
  return h("li", { class: "row" },
    h(Flaps, { text: clock(flight.time), length: 5 }),
    h(Flaps, { text: flight.destination, length: 12 }),
    h(Flaps, { text: flight.code, length: 5 }),
    h(Flaps, { text: flight.gate, length: 3 }),
    h(Flaps, { text: note, length: 11, tone }),
  );
}

function Board({ flights, now }: { flights: Flight[]; now: number }): VNode {
  return h("div", { class: "board" },
    h("div", { class: "row head", "aria-hidden": "true" },
      h("span", null, "TIME"), h("span", null, "DESTINATION"), h("span", null, "FLIGHT"), h("span", null, "GATE"), h("span", null, "REMARKS"),
    ),
    h("ol", null, flights.map((flight) => h(FlightRow, { flight, now }))),
  );
}

function App(): VNode {
  const [now, setNow] = useState(START);
  const [rows, setRows] = useState(MIN_ROWS);
  const flights = useMemo(() => departuresFrom(now, rows), [now, rows]);
  /* 처음 그린 뒤와 창 크기가 바뀔 때마다 화면 높이에 들어가는 행 수를 다시 센다. */
  useEffect(() => {
    const fit = (): void => setRows(rowsThatFit());
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => {
    document.title = `${clock(now)} 출발 · mini-react`;
  }, [now]);

  return h("main", { class: "airport" },
    h("header", null,
      h("div", null,
        h("h1", null, "DEPARTURES ", h("small", null, "출발")),
        h("p", { class: "hint" }, "시간 위에서 휠을 돌리면 시간이 바뀐다. (시: 1시간, 분: 5분 · ↑↓ 키도 가능)"),
      ),
      h(Clock, { now, onChange: (minutes: number) => setNow((previous) => (previous + minutes + DAY) % DAY) }),
    ),
    h(Board, { flights, now }),
    h("p", { class: "hint" }, "더미 데이터 · ", h("a", { href: "/phase2.html" }, "Phase 2 데모"), " · ", h("a", { href: "/" }, "Phase 1 데모")),
  );
}

/* ───────── 실행 ───────── */

/* 트랙패드는 휠 이벤트를 잘게 여러 번 보낸다. 움직인 양을 모아 일정량마다 한 칸으로 센다. */
const WHEEL_STEP = 60;
let wheelTotal = 0;
function wheelStep(deltaY: number): number {
  wheelTotal += deltaY;
  if (Math.abs(wheelTotal) < WHEEL_STEP) return 0;
  const direction = wheelTotal > 0 ? -1 : 1; // 아래로 돌리면 이전 시간, 위로 돌리면 다음 시간
  wheelTotal = 0;
  return direction;
}

/* 스크롤 없이 한 화면에 들어가는 행 수. 실제로 그려진 행의 높이와 판 위아래 영역의 높이를 잰다. */
function rowsThatFit(): number {
  const list = document.querySelector(".board ol");
  const row = list?.firstElementChild;
  const page = document.querySelector(".airport");
  if (!list || !row || !page) return MIN_ROWS;
  const box = list.getBoundingClientRect();
  const above = box.top + window.scrollY;
  const below = page.getBoundingClientRect().bottom - box.bottom; // 판 아래 여백과 안내문
  const fits = Math.floor((window.innerHeight - above - below) / row.getBoundingClientRect().height);
  return Math.min(FLIGHTS.length, Math.max(MIN_ROWS, fits));
}

const container = document.getElementById("app");
if (!container) throw new Error("#app 요소가 없다.");
const app = new FunctionComponent(App, container);

/* 엔진이 알려 준 "바뀐 노드" 가운데 플랩 글자만 한 번 뒤집는다. */
const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
app.onUpdate = ({ changed }) => {
  if (calm.matches) return;
  for (const node of changed) {
    const flap = node.parentElement;
    if (node.nodeType !== Node.TEXT_NODE || !flap?.classList.contains("flap")) continue;
    flap.animate(
      [{ transform: "perspective(12em) rotateX(-90deg)" }, { transform: "perspective(12em) rotateX(0)" }],
      { duration: 220, easing: "ease-out" },
    );
  }
};

app.mount();
