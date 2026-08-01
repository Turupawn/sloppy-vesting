import {useRef, useState} from "react";
import {amountFloat, stopwatch} from "../format";

type Props = {
  /** Chain timestamps in milliseconds. */
  startMs: number;
  cliffMs: number;
  endMs: number;
  nowMs: number;
  /** Amounts as plain floats, already divided by the decimals. */
  total: number;
  claimed: number;
  symbol: string;
};

// The plot area inside the viewBox. Room at the top for the 100%
// label, at the bottom for the time axis.
const W = 640;
const H = 200;
const PAD = {top: 18, right: 46, bottom: 24, left: 10};
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const BASE = PAD.top + PLOT_H;

/**
 * The stream, drawn. The full schedule is a dashed promise: flat zero,
 * the cliff wall, then the straight climb to 100%. What has already
 * run is painted solid green behind the needle, which advances in
 * real time. The one moment that matters — the cliff popping — is the
 * geometry itself: the area appears all at once when the needle
 * crosses the wall.
 *
 * Pure SVG over props. No chart library, no chain: everything it
 * knows arrives as numbers.
 */
export function StreamChart(props: Props) {
  const {startMs, cliffMs, endMs, nowMs, total, claimed, symbol} = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{x: number; tMs: number} | null>(null);

  const span = endMs - startMs;
  if (span <= 0 || total <= 0) return null;

  const x = (tMs: number) =>
    PAD.left + PLOT_W * Math.min(1, Math.max(0, (tMs - startMs) / span));
  const yOf = (value: number) => BASE - PLOT_H * Math.min(1, value / total);

  const unlockedAt = (tMs: number) => {
    if (tMs < cliffMs) return 0;
    if (tMs >= endMs) return total;
    return (total * (tMs - startMs)) / span;
  };

  const cliffX = x(cliffMs);
  const cliffY = yOf(unlockedAt(cliffMs));
  const nowX = x(nowMs);
  const nowY = yOf(unlockedAt(nowMs));
  const afterCliff = nowMs >= cliffMs;
  const done = nowMs >= endMs;

  // The full schedule, dashed: the promise of the stream.
  const schedule = [
    `M ${PAD.left} ${BASE}`,
    `L ${cliffX} ${BASE}`,
    `L ${cliffX} ${cliffY}`,
    `L ${x(endMs)} ${yOf(total)}`,
  ].join(" ");

  // What has already run, as a filled area up to the needle.
  const realized = afterCliff
    ? [
        `M ${cliffX} ${BASE}`,
        `L ${cliffX} ${cliffY}`,
        `L ${nowX} ${nowY}`,
        `L ${nowX} ${BASE}`,
        "Z",
      ].join(" ")
    : "";

  const realizedEdge = afterCliff
    ? `M ${cliffX} ${cliffY} L ${nowX} ${nowY}`
    : "";

  const claimedY = yOf(claimed);

  function onMove(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const clamped = Math.min(PAD.left + PLOT_W, Math.max(PAD.left, px));
    const tMs = startMs + ((clamped - PAD.left) / PLOT_W) * span;
    setHover({x: clamped, tMs});
  }

  return (
    <div className="chart" data-testid="chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Stream de ${amountFloat(total)} ${symbol}: nada hasta el cliff, después sube lineal hasta el final.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0.04" />
          </linearGradient>
          <pattern
            id="chart-locked"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke="var(--amber)"
              strokeOpacity="0.22"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>

        {/* Recessive grid: quarters of the total. */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            className="chart__grid"
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={yOf(total * f)}
            y2={yOf(total * f)}
          />
        ))}
        <line
          className="chart__base"
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={BASE}
          y2={BASE}
        />

        {/* The locked strip: nothing moves in here. */}
        {!afterCliff && (
          <rect
            x={PAD.left}
            y={PAD.top}
            width={Math.max(0, cliffX - PAD.left)}
            height={PLOT_H}
            fill="url(#chart-locked)"
          />
        )}

        {/* The promise: the full schedule, dashed. */}
        <path className="chart__schedule" d={schedule} />

        {/* What already ran. */}
        {afterCliff && (
          <>
            <path d={realized} fill="url(#chart-fill)" />
            <path className="chart__edge" d={realizedEdge} />
          </>
        )}

        {/* Already claimed, marked on the y axis. */}
        {claimed > 0 && (
          <>
            <line
              className="chart__claimed"
              x1={PAD.left}
              x2={PAD.left + PLOT_W}
              y1={claimedY}
              y2={claimedY}
            />
            <text
              className="chart__label chart__label--claimed"
              x={PAD.left + PLOT_W + 4}
              y={claimedY + 3}
            >
              retirado
            </text>
          </>
        )}

        {/* The cliff wall. */}
        <line
          className="chart__cliff"
          x1={cliffX}
          x2={cliffX}
          y1={BASE}
          y2={cliffY}
        />
        <text
          className="chart__label chart__label--cliff"
          x={cliffX + 5}
          y={cliffY - 9}
        >
          cliff · 5% · {stopwatch((cliffMs - startMs) / 1000)}
        </text>

        {/* 100%, where the stream ends. */}
        <text
          className="chart__label"
          x={PAD.left + PLOT_W + 4}
          y={yOf(total) + 3}
        >
          100%
        </text>

        {/* Time axis: just the two ends. The cliff sits so close to
            the start that a tick there would collide with 0:00 — its
            moment is named on the wall label instead. */}
        <text className="chart__tick" x={PAD.left} y={H - 8}>
          0:00
        </text>
        <text
          className="chart__tick chart__tick--end"
          x={PAD.left + PLOT_W}
          y={H - 8}
        >
          {stopwatch(span / 1000)}
        </text>

        {/* The needle: where the stream is right now. */}
        {!done && (
          <line
            className="chart__needle"
            x1={nowX}
            x2={nowX}
            y1={PAD.top}
            y2={BASE}
            data-testid="chart-needle"
          />
        )}
        <circle
          className="chart__dot"
          cx={done ? PAD.left + PLOT_W : nowX}
          cy={done ? yOf(total) : nowY}
          r="4.5"
        />

        {/* Hover: time and unlocked amount at the pointer. */}
        {hover && (
          <line
            className="chart__crosshair"
            x1={hover.x}
            x2={hover.x}
            y1={PAD.top}
            y2={BASE}
          />
        )}
      </svg>

      {hover && (
        <div
          className="chart__tooltip"
          style={{left: `${(hover.x / W) * 100}%`}}
        >
          <span className="chart__tooltip-time">
            {stopwatch((hover.tMs - startMs) / 1000)}
          </span>
          <span className="chart__tooltip-value">
            {amountFloat(unlockedAt(hover.tMs))} {symbol}
          </span>
        </div>
      )}
    </div>
  );
}
