import React from 'react';

// One line of the log: HEAD, a merge, the birth commit, or a commit.
// Wide: the date sits in its own column, left of the graph. Narrow: there is no
// room for it there, so it moves in above the message.
export default function GitRow({ row, narrow, dim, rowRef, onHover }) {
  const tone = row.lane ? row.lane.tone : '';
  // hovering a row highlights its branch too, without opening the card
  const lift = row.lane ? { onMouseEnter: () => onHover(row.lane.id) } : null;

  const lead = (date) =>
    narrow ? null : (
      <span className="git-meta">
        <span className="git-date">{date}</span>
      </span>
    );
  const when = (date, extra) =>
    narrow ? <span className="git-when">{extra ? `${date} · ${extra}` : date}</span> : null;

  if (row.kind === 'head')
    return (
      <div className="git-commit is-note is-life" ref={rowRef}>
        {lead('today')}
        <span className="git-body">
          {when('today')}
          <span className="git-ref">(HEAD)</span>
        </span>
      </div>
    );

  if (row.kind === 'root')
    return (
      <div className="git-commit is-note is-life" ref={rowRef}>
        {lead(row.born)}
        <span className="git-body">
          {when(row.born)}
          <span className="git-note-text">init — born</span>
        </span>
      </div>
    );

  if (row.kind === 'merge')
    return (
      <div className={`git-commit is-note ${tone}${dim ? ' is-dim' : ''}`} ref={rowRef} {...lift}>
        {lead(row.lane.branch.end)}
        <span className="git-body">
          {when(row.lane.branch.end)}
          <span className="git-note-text">
            Merge <span className="git-ref is-branch">({row.lane.branch.name})</span> into life
          </span>
        </span>
      </div>
    );

  // A commit is a section of the branch — a role, a campus — written as a
  // subject line with the work itself as the message body underneath. The
  // oldest one also creates the branch, so it carries its name and place.
  const { commit, lane } = row;
  const opens = row.seq === 0;

  return (
    <div
      className={`git-commit ${opens ? 'is-open ' : ''}${tone}${dim ? ' is-dim' : ''}`}
      ref={rowRef}
      {...lift}
    >
      {lead(commit.date)}
      <span className="git-body">
        {opens && (
          <span className="git-subject">
            <span className="git-ref is-branch">({lane.branch.name})</span>
            {!narrow && lane.branch.location && (
              <span className="git-where">{lane.branch.location}</span>
            )}
          </span>
        )}
        {when(commit.date, opens ? lane.branch.location : null)}
        <span className={`git-text${commit.milestone || opens ? ' is-milestone' : ''}`}>
          {commit.text}
        </span>
        {commit.body?.length > 0 && (
          <span className="git-msg">
            {commit.body.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
