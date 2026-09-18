import React, { useLayoutEffect, useRef, useState } from 'react';

// The card shown while hovering a branch — the whole history of that company,
// degree or project in one place.
export default function BranchCard({ lane, x, y, maxY }) {
  const { branch } = lane;
  const ref = useRef(null);
  // keep the card inside the log, however far down the lane is hovered
  const [top, setTop] = useState(y);
  useLayoutEffect(() => {
    const h = ref.current ? ref.current.offsetHeight : 0;
    setTop(Math.max(0, Math.min(y, maxY - h)));
  }, [y, maxY, lane]);

  return (
    <div
      className={`git-branch-card ${lane.tone}`}
      ref={ref}
      style={{ left: `${x}px`, top: `${top}px` }}
    >
      <div className="git-branch-card-head">{branch.name}</div>
      <div className="git-branch-card-meta">
        {branch.start} – {branch.end}
        {branch.location ? ` · ${branch.location}` : ''}
      </div>
      {/* newest first, the way the log itself reads */}
      <ul className="git-branch-card-list">
        {[...(branch.commits || [])].reverse().map((commit, i) => (
          <li key={i}>
            <span className="git-branch-card-date">{commit.date}</span>
            <span className="is-milestone">{commit.text}</span>
            {commit.body?.length > 0 && (
              <span className="git-msg">
                {commit.body.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
