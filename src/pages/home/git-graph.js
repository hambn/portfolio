// Graph layout for the home page git log — no React, no DOM: it turns
// resume.json branches into rows, lanes and SVG paths. GitLog.jsx draws it.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "Sep 2024" → a sortable month number; "present" never ends, so it sorts last.
export function monthNumber(value) {
  const s = String(value || '').trim();
  if (!s) return -Infinity;
  if (s.toLowerCase() === 'present') return Infinity;
  const month = s.match(/[a-z]{3,}/i);
  const year = s.match(/\d{4}/);
  if (!year) return -Infinity;
  const m = month ? MONTHS.indexOf(month[0].slice(0, 3).toLowerCase()) : 0;
  return Number(year[0]) * 12 + (m < 0 ? 0 : m);
}

// Graph geometry, in px.
export const LANE_W = 20; // horizontal distance between lanes (tightened on phones)
export const LANE_W_SM = 14;
export const LANE_W_MIN = 7; // the tightest spacing a crowded graph packs down to
export const LANE_X0 = 7; // centre of the life line
export const CURVE = 18; // vertical run of a branch/merge curve
export const NODE_DY = 10; // node centre, measured from the top of its row
export const META_W = 84; // the date column, to the left of the graph (lazygit order)

export const laneX = (lane, lw) => LANE_X0 + lane * lw;

const toneOf = (type) =>
  type === 'education' ? 'is-edu' : type === 'project' ? 'is-project' : 'is-work';

// Lays the history out as a git graph over one time axis: the life line runs
// from today at the top down to the birth commit at the bottom. Every company,
// degree or project is a branch — created at its start date, where its first
// commit lands, and merged back into the life line at its end date. A branch
// that has not ended yet simply stays open at HEAD.
export function buildGraph(branches, born) {
  const lanes = (branches || []).map((branch, i) => ({
    branch,
    id: branch.id || `branch-${i}`,
    start: monthNumber(branch.start),
    end: monthNumber(branch.end),
    tone: toneOf(branch.type),
  }));

  const rows = [{ kind: 'head', key: 'head', at: Infinity }];
  lanes.forEach((lane) => {
    if (Number.isFinite(lane.end))
      rows.push({ kind: 'merge', key: `m:${lane.id}`, at: lane.end, lane });
    (lane.branch.commits || []).forEach((commit, i) => {
      rows.push({
        kind: 'commit',
        key: `c:${lane.id}:${i}`,
        at: monthNumber(commit.date),
        seq: i,
        commit,
        lane,
      });
    });
  });
  rows.push({ kind: 'root', key: 'root', at: monthNumber(born), born });

  // Newest first; within one month a merge closes above its commits, and
  // commits keep the order they were written in the file (oldest lowest).
  const rank = { head: 3, merge: 2, commit: 1, root: 0 };
  rows.sort((a, b) => b.at - a.at || rank[b.kind] - rank[a.kind] || (b.seq ?? 0) - (a.seq ?? 0));

  const rowIndex = new Map(rows.map((row, i) => [row.key, i]));
  lanes.forEach((lane) => {
    const own = rows.filter((row) => row.kind === 'commit' && row.lane === lane);
    // the branch point: its oldest commit, at the bottom of its run
    lane.bottomIdx = own.length ? rowIndex.get(own[own.length - 1].key) : rows.length - 1;
    // an open branch runs all the way up to HEAD
    lane.topIdx = Number.isFinite(lane.end) ? rowIndex.get(`m:${lane.id}`) : 0;
    // rows run newest first, commits[] runs oldest first — carry the commit
    // along so a node never reads the wrong end of the branch
    lane.nodes = own.map((row) => ({ idx: rowIndex.get(row.key), row }));
  });

  // A lane is busy from where it merges down to where it branches; a later
  // branch may reuse the column once it is free.
  const busyUntil = [];
  [...lanes]
    .sort((a, b) => a.topIdx - b.topIdx || a.bottomIdx - b.bottomIdx)
    .forEach((lane) => {
      let column = 1;
      while (busyUntil[column] !== undefined && busyUntil[column] >= lane.topIdx) column++;
      busyUntil[column] = lane.bottomIdx;
      lane.column = column;
    });

  return { rows, lanes, laneCount: lanes.reduce((m, l) => Math.max(m, l.column), 0) + 1 };
}

// One branch: the merge curve into the life line at the top (open branches
// start at HEAD instead), the run down its own column, then the curve back into
// the life line just below its first commit.
export function lanePath(lane, ys, lw) {
  const x = laneX(lane.column, lw);
  const life = laneX(0, lw);
  const branchY = ys[lane.bottomIdx];
  const merges = Number.isFinite(lane.end);
  const top = merges ? ys[lane.topIdx] + CURVE : ys[0];

  let d = merges
    ? `M ${life} ${ys[lane.topIdx]} C ${life} ${ys[lane.topIdx] + CURVE * 0.45} ${x} ${top - CURVE * 0.45} ${x} ${top}`
    : `M ${x} ${top}`;
  d += ` L ${x} ${Math.max(top, branchY)}`;
  d += ` C ${x} ${branchY + CURVE * 0.45} ${life} ${branchY + CURVE * 0.55} ${life} ${branchY + CURVE}`;
  return d;
}
