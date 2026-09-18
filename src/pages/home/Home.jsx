import { mediaUrl } from '../../lib/api.js';
// Home.jsx — landing page
// Data: contents/home/profile.json, contents/home/resume.json, contents/links/links.json
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowWidth } from '../../hooks/useWindowWidth.js';
import { PortfolioData } from '../../lib/data.js';
import { navigate } from '../../lib/router.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "Sep 2024" → a sortable month number; "present" never ends, so it sorts last.
function monthNumber(value) {
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
const LANE_W = 20; // horizontal distance between lanes (tightened on phones)
const LANE_W_SM = 14;
const LANE_X0 = 7; // centre of the life line
const CURVE = 18; // vertical run of a branch/merge curve
const NODE_DY = 10; // node centre, measured from the top of its row

const laneX = (lane, lw) => LANE_X0 + lane * lw;
const toneOf = (type) =>
  type === 'education' ? 'is-edu' : type === 'project' ? 'is-project' : 'is-work';

// Lays the history out as a git graph over one time axis: the life line runs
// from today at the top down to the birth commit at the bottom. Every company,
// degree or project is a branch — created at its start date, where its first
// commit lands, and merged back into the life line at its end date. A branch
// that has not ended yet simply stays open at HEAD.
function buildGraph(branches, born) {
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
    lane.rowIdxs = own.map((row) => rowIndex.get(row.key));
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
function lanePath(lane, ys, lw) {
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

// The card shown while hovering a branch — the whole history of that company,
// degree or project in one place.
function BranchCard({ lane, x, y }) {
  const { branch } = lane;
  return (
    <div className="git-branch-card" style={{ left: `${x}px`, top: `${y}px` }}>
      <div className="git-branch-card-head">
        <span className="git-ref">{lane.id}</span>
        <strong>{branch.name}</strong>
      </div>
      <div className="git-branch-card-meta">
        {branch.start} – {branch.end}
        {branch.location ? ` · ${branch.location}` : ''}
      </div>
      <ul className="git-branch-card-list">
        {(branch.commits || []).map((commit, i) => (
          <li key={i} className={commit.milestone ? 'is-milestone' : ''}>
            <span className="git-branch-card-date">{commit.date}</span>
            {commit.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GitLog({ branches, born }) {
  const { rows, lanes, laneCount } = useMemo(() => buildGraph(branches, born), [branches, born]);
  const lw = useWindowWidth() < 560 ? LANE_W_SM : LANE_W;
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
  const rootY = ys ? ys[rows.length - 1] : 0;
  const hovered = hover && lanes.find((lane) => lane.id === hover.id);

  return (
    <div
      className={`git-log${hovered ? ' is-hovering' : ''}`}
      ref={wrapRef}
      style={{ paddingLeft: `${width + 6}px` }}
      onMouseLeave={() => setHover(null)}
    >
      {ys && (
        <svg
          className="git-graph"
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
                    setHover({ id: lane.id, y: e.clientY - box.top });
                  }}
                />
                {/* merge commit — it belongs to the life line it merges into */}
                {!open && <circle cx={LANE_X0} cy={ys[lane.topIdx]} r="3.5" className="git-dot" />}
                {open && <circle cx={x} cy={ys[0]} r="4.5" className="git-dot is-hollow" />}
                {lane.rowIdxs.map((idx, i) => (
                  <circle
                    key={idx}
                    cx={x}
                    cy={ys[idx]}
                    r={lane.branch.commits[i]?.milestone ? 4.5 : 3.5}
                    className={`git-dot${lane.branch.commits[i]?.milestone ? ' is-hollow' : ''}`}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      )}

      {hovered && <BranchCard lane={hovered} x={width + 14} y={Math.max(0, hover.y - 24)} />}

      {rows.map((row, i) => {
        const setRef = (el) => (rowRefs.current[i] = el);
        const dim = hovered && row.lane && row.lane.id !== hovered.id;
        const tone = row.lane ? row.lane.tone : '';

        if (row.kind === 'head')
          return (
            <div className="git-commit is-note" key={row.key} ref={setRef}>
              <span className="git-ref is-head">HEAD</span>
              <span className="git-note-text">today</span>
            </div>
          );

        if (row.kind === 'root')
          return (
            <div className="git-commit is-note" key={row.key} ref={setRef}>
              <span className="git-note-text">init — born</span>
              <span className="git-date">{row.born}</span>
            </div>
          );

        if (row.kind === 'merge')
          return (
            <div
              className={`git-commit is-note ${tone}${dim ? ' is-dim' : ''}`}
              key={row.key}
              ref={setRef}
              onMouseEnter={() => setHover(null)}
            >
              <span className="git-note-text">
                Merge branch <span className="git-branch-name">{row.lane.id}</span>
              </span>
              <span className="git-date">{row.lane.branch.end}</span>
            </div>
          );

        const { commit, lane } = row;
        const isFirst = row.seq === 0;

        return (
          <div
            className={`git-commit ${tone}${dim ? ' is-dim' : ''}`}
            key={row.key}
            ref={setRef}
            onMouseEnter={() => setHover(null)}
          >
            <span className={`git-text${commit.milestone ? ' is-milestone' : ''}`}>
              {commit.text}
            </span>
            {isFirst && <span className="git-ref is-branch">{lane.id}</span>}
            {isFirst && <span className="git-where">{lane.branch.name}</span>}
            <span className="git-date">{commit.date}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [profile, setProfile] = useState(() => PortfolioData.peek('profile'));
  const [resume, setResume] = useState(() => PortfolioData.peek('resume'));
  const [links, setLinks] = useState(() => PortfolioData.peek('links'));

  useEffect(() => {
    PortfolioData.getProfile()
      .then(setProfile)
      .catch(() => {});
    PortfolioData.getResume()
      .then(setResume)
      .catch(() => {});
    PortfolioData.getLinks()
      .then(setLinks)
      .catch(() => {});
  }, []);

  const hasResume = resume && resume.branches?.length;

  // Footer quick-links — driven by links.json so no duplication
  const footerLinks = links
    ? ['github', 'x', 'telegram']
        .filter((k) => links[k])
        .map((k) => ({ label: k, url: links[k].url }))
    : [];

  return (
    <main
      className="home-page"
      style={{
        maxWidth: '760px',
        margin: '0 auto',
      }}
    >
      {/* ── Intro ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <img
          src={
            profile?.avatar ||
            (profile?.handle &&
              mediaUrl(`https://avatars.githubusercontent.com/${profile.handle}`)) ||
            undefined
          }
          alt={profile?.name || ''}
          width="72"
          height="72"
          decoding="async"
          fetchpriority="high"
          className="home-avatar"
        />
        <div>
          <h1
            style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: '700',
              letterSpacing: '-0.025em',
              marginBottom: '4px',
              lineHeight: 1.2,
            }}
          >
            {profile?.name || ''}
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--primary)' }}>
            @{profile?.handle || ''}
          </p>
        </div>
      </div>

      {/* intro paragraphs — falls back to the one-line bio used for meta/cards */}
      <div
        style={{
          color: 'var(--foreground-muted)',
          fontSize: 'var(--text-base)',
          lineHeight: '1.85',
          // ~70 characters per line — comfortable for multi-sentence paragraphs.
          maxWidth: '620px',
          marginBottom: '36px',
          display: 'grid',
          gap: '18px',
        }}
      >
        {(profile?.intro?.length ? profile.intro : [profile?.bio].filter(Boolean)).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '56px' }}>
        <a
          href={import.meta.env.BASE_URL + 'projects/'}
          onClick={(e) => {
            e.preventDefault();
            navigate('projects');
          }}
          className="btn btn-default btn-md"
        >
          projects
        </a>
        <a
          href={import.meta.env.BASE_URL + 'blog/'}
          onClick={(e) => {
            e.preventDefault();
            navigate('blog');
          }}
          className="btn btn-outline btn-md"
        >
          blog
        </a>
        <a
          href={import.meta.env.BASE_URL + 'links/'}
          onClick={(e) => {
            e.preventDefault();
            navigate('links');
          }}
          className="btn btn-ghost btn-md"
        >
          social & contact →
        </a>
      </div>

      {/* ── Stack ── */}
      {resume?.skills?.length > 0 && (
        <div style={{ marginBottom: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <h2 className="section-label">
              <span className="prompt-sigil" aria-hidden="true">
                $
              </span>{' '}
              stack --list
            </h2>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {resume.skills.map((s) => (
              <span className="stack-chip" key={s}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Work & education timeline ── */}
      {hasResume && (
        <div style={{ marginBottom: '56px' }}>
          {/* label — rule — resume link, so the section closes itself */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <h2 className="section-label">
              <span className="prompt-sigil" aria-hidden="true">
                $
              </span>{' '}
              git log --graph <span className="sr-only">work &amp; education</span>
            </h2>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <a
              href={import.meta.env.BASE_URL + 'resume/'}
              onClick={(e) => {
                e.preventDefault();
                navigate('resume');
              }}
              className="link-quiet"
              style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}
            >
              full resume →
            </a>
          </div>
          <GitLog branches={resume.branches || []} born={resume.born} />
        </div>
      )}

      {/* ── Footer quick-links ── */}
      {footerLinks.length > 0 && (
        <div style={{ paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {footerLinks.map(({ label, url }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-quiet"
                style={{ fontSize: 'var(--text-xs)' }}
              >
                {label} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
