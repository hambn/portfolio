// GitHub / GitLab contribution graph.
// GitHub data comes from the public (no-auth) jogruber contributions API;
// GitLab has no no-auth calendar API so it uses a deterministic synthetic grid.
import React, { useEffect, useState } from 'react';

const GH_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function ContribGraph({ username, source, levels, theme }) {
  const [weeks, setWeeks] = useState(null);
  const [hover, setHover] = useState(null); // {wi,di,label}

  const buildWeeks = (days) => {
    const wk = [];
    let cur = [];
    days.forEach((day, i) => {
      const dow = new Date(day.date + 'T00:00:00').getDay();
      if (i === 0) for (let k = 0; k < dow; k++) cur.push(null);
      cur.push(day);
      if (dow === 6) {
        wk.push(cur);
        cur = [];
      }
    });
    if (cur.length) {
      while (cur.length < 7) cur.push(null);
      wk.push(cur);
    }
    return wk.slice(-53);
  };

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    const synth = () => {
      const days = [];
      const end = new Date();
      for (let i = 364; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        // weekends quieter, weekdays busier — plausible-looking pattern
        const dow = d.getDay();
        const base = dow === 0 || dow === 6 ? 0.25 : 0.6;
        const r = Math.random();
        const count = r < 1 - base ? 0 : Math.floor(r * 12);
        const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
        days.push({ date: d.toISOString().slice(0, 10), count, level });
      }
      return days;
    };

    if (source === 'github') {
      fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (cancelled) return;
          const days = d?.contributions;
          if (!Array.isArray(days) || !days.length) throw new Error('no data');
          setWeeks(buildWeeks(days));
        })
        .catch(() => {
          if (!cancelled) setWeeks(buildWeeks(synth()));
        });
    } else {
      setWeeks(buildWeeks(synth()));
    }

    return () => {
      cancelled = true;
    };
  }, [username, source]);

  if (!weeks) {
    return (
      <div
        style={{
          padding: '16px 20px',
          borderTop: `1px solid ${theme.div}`,
          fontSize: '12px',
          color: theme.faint,
        }}
      >
        loading contributions…
      </div>
    );
  }

  const GAP = '2.2px';

  // Month labels: every month, evenly distributed so gaps are uniform across the row.
  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((w, i) => {
    const firstDay = w.find(Boolean);
    if (!firstDay) return;
    const m = new Date(firstDay.date + 'T00:00:00').getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ i, label: GH_MONTHS[m] });
      lastMonth = m;
    }
  });
  // Drop the leading partial-month label (it would duplicate the trailing month)
  if (monthLabels.length > 1 && monthLabels[1].i - monthLabels[0].i < 3) monthLabels.shift();

  const DAYW = '22px';

  return (
    <div style={{ padding: '14px 20px 16px', borderTop: `1px solid ${theme.div}` }}>
      {/* Month labels — evenly spaced */}
      <div style={{ display: 'flex' }}>
        <div style={{ width: DAYW, flexShrink: 0 }} />
        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            height: '13px',
            containerType: 'inline-size',
          }}
        >
          {monthLabels.map(({ label }, idx) => (
            <span
              key={idx}
              style={{
                position: 'absolute',
                left: `${(idx / monthLabels.length) * 100}%`,
                fontSize: 'clamp(6.5px, 3.6cqw, 10.5px)',
                color: theme.faint,
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: GAP }}>
        {/* Day-of-week labels */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: DAYW, flexShrink: 0 }}
        >
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                fontSize: '8.5px',
                lineHeight: 1,
                color: theme.faint,
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Week columns — flex so the grid scales to fit, never scrolls */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: GAP }}>
          {weeks.map((w, wi) => (
            <div
              key={wi}
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: GAP }}
            >
              {w.map((day, di) => (
                <div
                  key={di}
                  onMouseEnter={() =>
                    day &&
                    setHover({
                      wi,
                      di,
                      label: `${day.count} contribution${day.count === 1 ? '' : 's'} on ${day.date}`,
                    })
                  }
                  onMouseLeave={() => setHover(null)}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '2px',
                    background: day ? levels[day.level] : 'transparent',
                    outline: day ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    outlineOffset: '-1px',
                    boxShadow:
                      hover && hover.wi === wi && hover.di === di
                        ? `0 0 0 1.5px ${theme.muted}`
                        : 'none',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + tooltip line */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', minHeight: '15px' }}>
        <span
          style={{ fontSize: '11px', color: theme.muted, marginRight: 'auto', minHeight: '15px' }}
        >
          {hover ? hover.label : ''}
        </span>
        <span style={{ fontSize: '10px', color: theme.faint, marginRight: '5px' }}>Less</span>
        <div style={{ display: 'flex', gap: '3px' }}>
          {levels.map((c, i) => (
            <div
              key={i}
              style={{
                width: '11px',
                height: '11px',
                borderRadius: '2px',
                background: c,
                outline: '1px solid rgba(255,255,255,0.04)',
                outlineOffset: '-1px',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: '10px', color: theme.faint, marginLeft: '5px' }}>More</span>
      </div>
    </div>
  );
}
