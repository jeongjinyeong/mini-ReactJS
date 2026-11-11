import { defineHook, FunctionComponent, h, useEffect, useMemo, useState } from '../../src/phase2/runtime.js';

const app = document.getElementById('app');
if (!app) throw new Error('Missing flight board mount element.');
const minuteMs = 60000;
const wheelStep = 5;
const initialMinute = Math.floor(Date.now() / minuteMs);
const quietMs = 240;
const rowInterval = 170;
const landingMs = 140;
const zone = 'Asia/Seoul';
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});
const tone = {
  '도착': 'status-landed',
  '착륙': 'status-landed',
  '수하물 수취': 'status-baggage',
  '지연': 'status-delayed',
  '예정': 'status-expected',
};

type Direction = -1 | 1;
type ClockDigit = { value: string; previous: string; turn: number; direction?: Direction };
type ClockReading = { text: string; iso: string; date: string; digits: ClockDigit[] };
type Timeline = {
  minute: number;
  clock: ClockReading;
  direction: Direction;
  revision: number;
  locked: number;
  settled: boolean;
};
type FlightStatus = keyof typeof tone;
type FlightCells = {
  scheduled: string;
  flight: string;
  origin: string;
  arrival: string;
  terminal: string;
  status: FlightStatus;
};
type FlightRowData = { id: string; airport: string; cells: FlightCells };
type FlightSchedule = [id: string, origin: string, airport: string, offset: number, delay: number, terminal: string];

function clockAt(minute: number, previous?: ClockReading, direction?: Direction): ClockReading {
  const now = new Date(minute * minuteMs);
  const text = timeFormat.format(now);
  const digits = Array.from(text.replace(':', ''), (value, index) => {
    const digit = previous?.digits[index];
    if (digit?.value === value) return digit;
    return { value, previous: digit?.value ?? value, turn: digit ? digit.turn + 1 : 0, direction };
  });
  return { text, iso: now.toISOString(), date: dayFormat.format(now), digits };
}

const flights = ([
  ['KE 704', '도쿄 · 나리타', 'NRT', -31, -3, 'T2'],
  ['OZ 112', '오사카 · 간사이', 'KIX', -22, -1, 'T1'],
  ['7C 1502', '후쿠오카', 'FUK', -13, 0, 'T1'],
  ['CX 418', '홍콩', 'HKG', -5, 5, 'T1'],
  ['JL 091', '도쿄 · 하네다', 'HND', 6, 1, 'T1'],
  ['SQ 600', '싱가포르', 'SIN', 16, 0, 'T1'],
  ['KE 018', '로스앤젤레스', 'LAX', 26, 2, 'T2'],
  ['TW 614', '타이베이', 'TPE', 38, 9, 'T1'],
] satisfies FlightSchedule[]).map(([id, origin, airport, offset, delay, terminal]) => {
  const expected = initialMinute + offset + delay;
  return {
    id, airport, expected, delay,
    cells: {
      scheduled: timeFormat.format(new Date((initialMinute + offset) * minuteMs)),
      flight: id,
      origin,
      arrival: timeFormat.format(new Date(expected * minuteMs)),
      terminal,
    },
  };
});

function flightsAt(minute: number): FlightRowData[] {
  return flights.map(({ id, airport, expected, delay, cells }) => {
    const elapsed = minute - expected;
    const status: FlightStatus = elapsed >= 26 ? '수하물 수취'
      : elapsed >= 1 ? '도착'
      : elapsed >= -2 ? '착륙'
      : delay >= 6 ? '지연' : '예정';
    return { id, airport, cells: { ...cells, status } };
  });
}

const initialTimeline: Timeline = {
  minute: initialMinute, clock: clockAt(initialMinute), direction: 1,
  revision: 0, locked: flights.length, settled: true,
};

const useTimeline = defineHook(function useTimeline() {
  const [timeline, setTimeline] = useState(initialTimeline);

  function adjust(direction: Direction) {
    setTimeline(previous => {
      const minute = previous.minute + direction * wheelStep;
      return {
        minute, clock: clockAt(minute, previous.clock, direction), direction,
        revision: previous.revision + 1, locked: 0, settled: false,
      };
    });
  }

  useEffect(() => {
    function onWheel(event: WheelEvent) {
      if (event.ctrlKey || event.shiftKey || event.deltaY === 0 || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      adjust(event.deltaY < 0 ? -1 : 1);
    }
    app.addEventListener('wheel', onWheel, { passive: false });
    return () => app.removeEventListener('wheel', onWheel);
  }, []);

  const { revision } = timeline;
  useEffect(() => {
    if (!revision) return;
    const timers = flights.map((_, index) => setTimeout(() => {
      setTimeline(current => current.revision === revision ? { ...current, locked: index + 1 } : current);
    }, quietMs + index * rowInterval));
    timers.push(setTimeout(() => {
      setTimeline(current => current.revision === revision ? { ...current, settled: true } : current);
    }, quietMs + (flights.length - 1) * rowInterval + landingMs));
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [revision]);

  return timeline;
});

type FlipTileProps = { value: string; kind: string; digit?: ClockDigit; rolling?: boolean };

function FlipTile({ value, kind, digit, rolling }: FlipTileProps) {
  function half(side: 'top' | 'bottom', text: string, layer: string) {
    return h('span', { className: 'half half-' + side + ' ' + layer, 'aria-hidden': true },
      h('span', { className: 'glyph' }, h('span', { className: 'glyph-value' }, text)));
  }

  const outgoing = digit?.direction === -1 ? 'bottom' : 'top';
  const incoming = outgoing === 'top' ? 'bottom' : 'top';
  return h('div', { className: 'flip ' + kind, 'data-turn': (digit?.turn ?? 0) % 2, 'data-value': value },
    half('top', value, 'rest'),
    half('bottom', value, 'rest'),
    digit?.turn ? [
      half(incoming, digit.previous, 'old-half'),
      half(outgoing, digit.previous, 'flap-out'),
      half(incoming, value, 'flap-in'),
    ] : null,
    rolling ? h('span', { className: 'rolling-window', 'aria-hidden': true },
      h('span', { className: 'rolling-card' }),
      h('span', { className: 'rolling-card rolling-card-next' })) : null);
}

function Clock({ clock, minute }: Pick<Timeline, 'clock' | 'minute'>) {
  return h('div', { className: 'clock-area' },
    h('p', { className: 'clock-label' }, 'SEOUL TIME'),
    h('time', { className: 'clock', dateTime: clock.iso, 'data-minute': minute, 'aria-label': '서울 시각 ' + clock.text },
      h('span', { className: 'sr-only' }, clock.text),
      clock.digits.flatMap((digit, index) => [
        index === 2 ? h('span', { className: 'clock-colon', 'aria-hidden': true }) : null,
        h('div', { 'aria-hidden': true, key: index }, h(FlipTile, { value: digit.value, digit, kind: 'clock-digit' })),
      ])),
    h('div', { className: 'clock-meta' },
      h('p', { className: 'clock-date' }, clock.date + ' · UTC+09:00'),
      h('p', { className: 'clock-hint' }, '휠 ↑ −' + wheelStep + '분 · ↓ +' + wheelStep + '분')));
}

const columns = [
  ['scheduled', '예정', 'Scheduled', 5, 'board-time'],
  ['flight', '항공편', 'Flight', 7, 'flight-number'],
  ['origin', '출발지', 'Origin', 13, 'origin'],
  ['arrival', '도착', 'Arrival', 5, 'board-time'],
  ['terminal', '터미널', 'Terminal', 3, 'terminal'],
  ['status', '상태', 'Status', 6, 'status'],
] satisfies [keyof FlightCells, string, string, number, string][];
const rowSlots = columns.reduce((total, [, , , slots]) => total + slots, 0);

type FlightCharactersProps = { value: string; kind: string; rolling: boolean; slots: number; airport: string | null };

function FlightCharacters({ value, kind, rolling, slots, airport }: FlightCharactersProps) {
  const characters = Array.from(value);
  const airportStart = slots - (airport?.length ?? 0);
  return h('div', { className: 'flight-characters', 'aria-hidden': true },
    Array.from({ length: slots }, (_, index) => {
      const isAirport = airport !== null && index >= airportStart;
      return h(FlipTile, {
        key: index,
        value: isAirport ? airport[index - airportStart] : (characters[index] ?? ' '),
        kind: 'flight-tile ' + (isAirport ? 'airport-tile' : kind),
        rolling,
      });
    }));
}

type FlightRowProps = { row: FlightRowData; index: number; rolling: boolean; changing: boolean };

function FlightRow({ row, index, rolling, changing }: FlightRowProps) {
  return h('tr', {
    'data-flight': row.id,
    'data-stage': rolling ? 'rolling' : 'locked',
    'data-changed': changing,
    style: '--roll-period:' + (205 + index % 4 * 26) + 'ms;--row-delay:' + (-23 * index) + 'ms',
  }, columns.map(([name, , , slots, kind], column) => {
    const value = row.cells[name];
    const airport = name === 'origin' ? row.airport : null;
    const statusTone = name === 'status' ? ' ' + tone[row.cells.status] : '';
    return h('td', { 'data-column': name, style: '--column-delay:' + (-17 * column) + 'ms' },
      h('span', { className: 'sr-only' }, airport ? value + ' ' + airport : value),
      h(FlightCharacters, { value, kind: kind + statusTone, rolling, slots, airport }));
  }));
}

type FlightTableProps = Pick<Timeline, 'locked' | 'revision' | 'settled'> & { rows: FlightRowData[] };

function FlightTable({ rows, locked, revision, settled }: FlightTableProps) {
  return h('div', { className: 'table-wrap' },
    h('table', { 'aria-label': '국제선 도착 항공편', 'aria-busy': !settled },
      h('colgroup', null, columns.map(([name, , , slots]) =>
        h('col', { key: name, style: 'width:' + (100 * slots / rowSlots) + '%' }))),
      h('thead', { className: 'flight-head' },
        h('tr', null, columns.map(([name, label, english]) =>
          h('th', { key: name, scope: 'col' }, label, h('span', { 'aria-hidden': true }, english))))),
      h('tbody', null, rows.map((row, index) =>
        h(FlightRow, { key: row.id, row, index, rolling: index >= locked, changing: revision > 0 })))));
}

function BoardHeader() {
  return h('div', { className: 'board-head' },
    h('div', { className: 'board-title' },
      h('div', { className: 'plane', 'aria-hidden': true }, h('span', null, '✈︎')),
      h('div', null,
        h('h1', { id: 'board-title' }, '국제선 도착'),
        h('p', { className: 'eyebrow' }, 'INCHEON · INTERNATIONAL ARRIVALS'))),
    h('div', { className: 'hall' },
      h('div', { className: 'hall-label' }, '도착장', h('span', null, 'HALL')),
      h('strong', null, 'B')));
}

function App() {
  const { minute, clock, locked, revision, direction, settled } = useTimeline();
  const rows = useMemo(() => flightsAt(minute), [minute]);
  const table = useMemo(() => h(FlightTable, { rows, locked, revision, settled }),
    [rows, locked, revision, settled]);
  return h('main', {
    className: 'shell', 'data-direction': direction < 0 ? 'up' : 'down',
  },
    h(Clock, { clock, minute }),
    h('section', { className: 'board', 'aria-labelledby': 'board-title' },
      h(BoardHeader), table));
}

new FunctionComponent(App, app).mount();
