import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import BranchCard from './BranchCard.jsx';
import GitRow from './GitRow.jsx';
import {
  buildGraph,
  CURVE,
  lanePath,
  laneX,
  LANE_W,
  LANE_W_SM,
  LANE_W_MIN,
  LANE_X0,
  META_W,
  NODE_DY,
} from './git-graph.js';

// The graph may take at most this share of the log's width; past that, lanes
// pack closer together instead of squeezing the messages.
const GUTTER_SHARE = 0.3;

/** Lane spacing that fits `laneCount` lanes into the gutter budget. */
function fitLaneWidth(base, laneCount, width) {
  if (!width) return base;
  const room = (width * GUTTER_SHARE - 16) / laneCount;
  return Math.max(LANE_W_MIN, Math.min(base, Math.floor(room)));
}

/**
 * Which branch the pointer is on. Over the graph, the nearest lane within half
 * a lane spacing owns it; anywhere else, the row under the pointer does. One
 * rule over one element, so neighbouring lanes and the rows they cross can't
 * take turns claiming the same spot.
 */
function pick({ x, y }, { lanes, rows, ys, lw, graphLeft, graphWidth }) {
  const gx = x - graphLeft;
  if (gx >= 0 && gx <= graphWidth) {
    let best = null;
    let bestDistance = lw / 2;
    for (const lane of lanes) {
      const top = Number.isFinite(lane.end) ? ys[lane.topIdx] : ys[0];
      const bottom = ys[lane.bottomIdx] + CURVE;
      if (y < top || y > bottom) continue;
      const distance = Math.abs(gx - laneX(lane.column, lw));
      if (distance <= bestDistance) {
        best = lane;
        bestDistance = distance;
      }
    }
    if (best) return { id: best.id, card: true };
  }
  // Each row owns the band from its own top to the next row's top.
  const row = ys.findLastIndex((rowY) => rowY - NODE_DY <= y);
  const lane = row >= 0 ? rows[row].lane : null;
  return lane ? { id: lane.id, card: false } : null;
}

export default function GitLog({ branches, born }) {
  const { rows, lanes, laneCount } = useMemo(() => buildGraph(branches, born), [branches, born]);
  const narrow = useMediaQuery('(max-width: 559px)');
  const wrapRef = useRef(null);
  const rowRefs = useRef([]);
  // Row heights depend on wrapped text, so the graph is drawn from measurements
  // rather than guessed. Before the first measure (and in the prerendered HTML)
  // only the rows render; the gutter is already reserved, so nothing shifts.
  const [layout, setLayout] = useState(null); // { ys, width }
  const [hover, setHover] = useState(null); // { id, card, y, pinned? }

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !rows.length) return undefined;

    const measure = () => {
      const box = wrap.getBoundingClientRect();
      setLayout({
        width: box.width,
        ys: rows.map((_, i) => {
          const row = rowRefs.current[i];
          return row ? row.getBoundingClientRect().top - box.top + NODE_DY : 0;
        }),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [rows]);

  const ys = layout?.ys;
  const lw = fitLaneWidth(narrow ? LANE_W_SM : LANE_W, laneCount, layout?.width);
  const width = laneCount * lw + 8;
  const metaW = narrow ? 0 : META_W;
  const rootY = ys ? ys[rows.length - 1] : 0;
  const hovered = hover && lanes.find((lane) => lane.id === hover.id);

  // Until measured, the gutter matches the prerendered CSS for either breakpoint.
  const gutter = layout
    ? { '--git-gap': `${laneCount * lw + 16}px`, '--git-gap-small': `${laneCount * lw + 16}px` }
    : {
        '--git-gap': `${laneCount * LANE_W + 16}px`,
        '--git-gap-small': `${laneCount * LANE_W_SM + 16}px`,
      };

  const pointAt = (event) => {
    const box = wrapRef.current.getBoundingClientRect();
    const point = { x: event.clientX - box.left, y: event.clientY - box.top };
    const next = pick(point, { lanes, rows, ys, lw, graphLeft: metaW, graphWidth: width });
    // The card follows the pointer; a row highlight has nothing to move.
    return next && { ...next, y: next.card ? Math.round(point.y) : null };
  };

  // Mouse: follow the pointer.
  const onPointerMove = (event) => {
    if (event.pointerType !== 'mouse' || !ys) return;
    const next = pointAt(event);
    setHover((prev) =>
      prev && next && prev.id === next.id && prev.card === next.card && prev.y === next.y
        ? prev
        : next,
    );
  };

  // Touch and pen have no hover, so a tap selects what the mouse would hover,
  // and tapping the same branch again clears it. A scroll gesture ends in
  // pointercancel, not pointerup, so swiping past the log selects nothing.
  const onPointerUp = (event) => {
    if (event.pointerType === 'mouse' || !ys) return;
    const next = pointAt(event);
    setHover((prev) =>
      !next || (prev && prev.id === next.id && prev.card === next.card)
        ? null
        : { ...next, pinned: true },
    );
  };

  // A pinned selection clears on a tap anywhere outside the log.
  const pinned = Boolean(hover?.pinned);
  useEffect(() => {
    if (!pinned) return undefined;
    const clear = (event) => {
      if (!wrapRef.current?.contains(event.target)) setHover(null);
    };
    document.addEventListener('pointerdown', clear);
    return () => document.removeEventListener('pointerdown', clear);
  }, [pinned]);

  return (
    <div
      className={`git-log${hovered ? ' is-hovering' : ''}${hover?.card ? ' is-on-lane' : ''}`}
      ref={wrapRef}
      style={{ '--git-meta': `${META_W}px`, ...gutter }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setHover(null)}
    >
      {ys && (
        <svg
          className="git-graph"
          style={{ left: `${metaW}px` }}
          width={width}
          height={rootY + 6}
          viewBox={`0 0 ${width} ${rootY + 6}`}
          aria-hidden="true"
        >
          {/* the life line — today at the top, the birth commit at the bottom */}
          <path d={`M ${LANE_X0} 0 L ${LANE_X0} ${rootY}`} className="git-lane is-life" />
          <circle cx={LANE_X0} cy={ys[0]} r="4.5" className="git-dot is-life is-hollow" />
          <circle cx={LANE_X0} cy={rootY} r="4.5" className="git-dot is-life" />

          {lanes.map((lane) => {
            const x = laneX(lane.column, lw);
            const open = !Number.isFinite(lane.end);
            const dim = hovered && hovered.id !== lane.id;

            return (
              <g key={lane.id} className={`${lane.tone}${dim ? ' is-dim' : ''}`}>
                <path d={lanePath(lane, ys, lw)} className="git-lane" />
                {/* merge commit — it belongs to the life line it merges into */}
                {!open && <circle cx={LANE_X0} cy={ys[lane.topIdx]} r="3.5" className="git-dot" />}
                {open && <circle cx={x} cy={ys[0]} r="4.5" className="git-dot is-hollow" />}
                {lane.nodes.map(({ idx, row }) => {
                  const hollow = row.seq === 0 || row.commit.milestone;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={ys[idx]}
                      r={row.seq === 0 ? 5 : hollow ? 4.5 : 3.5}
                      className={`git-dot${hollow ? ' is-hollow' : ''}`}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}

      {hovered && hover.card && (
        <BranchCard
          lane={hovered}
          x={metaW + width + 14}
          y={hover.y - 24}
          maxX={layout.width}
          maxY={rootY}
        />
      )}

      {rows.map((row, i) => (
        <GitRow
          key={row.key}
          row={row}
          dim={hovered && row.lane && row.lane.id !== hovered.id}
          rowRef={(el) => (rowRefs.current[i] = el)}
        />
      ))}
    </div>
  );
}
