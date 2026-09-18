import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowWidth } from '../../hooks/useWindowWidth.js';
import BranchCard from './BranchCard.jsx';
import GitRow from './GitRow.jsx';
import {
  buildGraph,
  lanePath,
  laneX,
  LANE_W,
  LANE_W_SM,
  LANE_X0,
  META_W,
  NODE_DY,
} from './git-graph.js';

export default function GitLog({ branches, born }) {
  const { rows, lanes, laneCount } = useMemo(() => buildGraph(branches, born), [branches, born]);
  const narrow = useWindowWidth() < 560;
  const lw = narrow ? LANE_W_SM : LANE_W;
  const wrapRef = useRef(null);
  const rowRefs = useRef([]);
  // Row heights depend on wrapped text, so the graph is drawn from measurements
  // rather than guessed. Before the first measure (and in the prerendered HTML)
  // only the rows render; the gutter is already reserved, so nothing shifts.
  const [ys, setYs] = useState(null);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !rows.length) return undefined;

    const measure = () => {
      const top = wrap.getBoundingClientRect().top;
      setYs(
        rows.map((_, i) => {
          const row = rowRefs.current[i];
          return row ? row.getBoundingClientRect().top - top + NODE_DY : 0;
        }),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [rows]);

  const width = laneCount * lw + 8;
  const metaW = narrow ? 0 : META_W;
  const rootY = ys ? ys[rows.length - 1] : 0;
  const hovered = hover && lanes.find((lane) => lane.id === hover.id);

  return (
    <div
      className={`git-log${hovered ? ' is-hovering' : ''}`}
      ref={wrapRef}
      style={{ '--git-meta': `${metaW}px`, '--git-gap': `${width + 8}px` }}
      onMouseLeave={() => setHover(null)}
    >
      {ys && (
        <svg
          className="git-graph"
          style={{ left: `${metaW}px` }}
          width={width}
          height={rootY + 6}
          viewBox={`0 0 ${width} ${rootY + 6}`}
        >
          {/* the life line — today at the top, the birth commit at the bottom */}
          <path d={`M ${LANE_X0} 0 L ${LANE_X0} ${rootY}`} className="git-lane is-life" />
          <circle cx={LANE_X0} cy={ys[0]} r="4.5" className="git-dot is-life is-hollow" />
          <circle cx={LANE_X0} cy={rootY} r="4.5" className="git-dot is-life" />

          {lanes.map((lane) => {
            const d = lanePath(lane, ys, lw);
            const x = laneX(lane.column, lw);
            const open = !Number.isFinite(lane.end);
            const dim = hovered && hovered.id !== lane.id;

            return (
              <g key={lane.id} className={`${lane.tone}${dim ? ' is-dim' : ''}`}>
                <path d={d} className="git-lane" />
                {/* wide invisible stroke so the lane is comfortable to hover */}
                <path
                  d={d}
                  className="git-hit"
                  onMouseMove={(e) => {
                    const box = wrapRef.current.getBoundingClientRect();
                    setHover({ id: lane.id, y: e.clientY - box.top, card: true });
                  }}
                />
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
        <BranchCard lane={hovered} x={metaW + width + 14} y={hover.y - 24} maxY={rootY} />
      )}

      {rows.map((row, i) => (
        <GitRow
          key={row.key}
          row={row}
          narrow={narrow}
          dim={hovered && row.lane && row.lane.id !== hovered.id}
          rowRef={(el) => (rowRefs.current[i] = el)}
          onHover={(id) => setHover({ id })}
        />
      ))}
    </div>
  );
}
