// GitHub / GitLab contribution graph: a year of days as week columns.
// Presentational only. The data comes from useContributions (below), which a
// card calls so it can decide what to render around the graph. A source with
// nothing to show renders nothing: the graph never draws invented activity.
import React, { useMemo, useState } from 'react';
import { apiUrl } from '../../lib/api.js';
import { useCardSource } from '../../hooks/useCardSource.js';
import { useCardFeed } from '../../pages/links/LinksFeed.jsx';
import { EXTERNAL } from '../../lib/external.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const hasDays = (data) => Array.isArray(data?.contributions) && data.contributions.length > 0;

async function getJSON(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`contributions ${response.status}`);
  return response.json();
}

// Where a host's calendar can be read from the visitor's browser. GitHub's
// goes through a public calendar service. GitLab serves its own without CORS
// headers, so only this site's API can read it; without the API the GitLab
// graph is left out.
const DIRECT = {
  github: (username) => (signal) =>
    getJSON(
      `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`,
      signal,
    ),
};

/**
 * A year of contributions for `host` ('github' | 'gitlab'): `{ data, loading }`
 * where data is `{ contributions: [{ date, count, level }], total? }` or null.
 * `api` says whether the card is configured to read this site's API.
 */
export function useContributions({ host, username, api, enabled = true }) {
  const seed = useCardFeed(`${host}Contributions`);
  const direct = useMemo(
    () => (username && DIRECT[host] ? DIRECT[host](username) : null),
    [host, username],
  );
  return useCardSource({
    api:
      api && username
        ? apiUrl(`/${host}/contributions?username=${encodeURIComponent(username)}`)
        : null,
    seed,
    direct,
    enabled,
    cacheKey: username ? `contrib:v1:${host}:${username}` : null,
    valid: hasDays,
  });
}

// The year's total: the source's own figure when it sends one, else the sum.
const yearTotal = (data) =>
  typeof data?.total?.lastYear === 'number'
    ? data.total.lastYear
    : data.contributions.reduce((sum, day) => sum + (day.count || 0), 0);

const dayOfWeek = (date) => new Date(`${date}T00:00:00`).getDay();

function weeksOf(days) {
  const weeks = [];
  let week = Array(dayOfWeek(days[0].date)).fill(null);
  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) weeks.push([...week, ...Array(7 - week.length).fill(null)]);
  return weeks.slice(-53);
}

// A label over the first week of each month, as GitHub places them. A month
// with too few weeks before the next label (the partial one the year opens
// with) is left unlabelled rather than crowded.
function monthLabels(weeks) {
  const labels = [];
  let last = -1;
  weeks.forEach((week, i) => {
    const first = week.find(Boolean);
    if (!first) return;
    const month = new Date(`${first.date}T00:00:00`).getMonth();
    if (month !== last) labels.push({ i, label: MONTHS[month] });
    last = month;
  });
  return labels.filter(
    (label, n) => (labels[n + 1]?.i ?? weeks.length) - label.i >= 3 || n === labels.length - 1,
  );
}

/**
 * `boxed` draws the graph as github.com does: a "N contributions in the last
 * year" heading over a rounded box, instead of a full-bleed band under a rule.
 * Colours come from the card's CSS: --cg-level-0…4, --cg-rule, --cg-faint,
 * --cg-ring and --cg-accent (cards.css).
 */
export function ContribGraph({
  data,
  loading = false,
  boxed = false,
  help,
  noun = 'contribution',
}) {
  const [hover, setHover] = useState(null); // tooltip line
  const weeks = useMemo(() => (hasDays(data) ? weeksOf(data.contributions) : null), [data]);
  const labels = useMemo(() => (weeks ? monthLabels(weeks) : []), [weeks]);

  // The ~371 cells only change with the data; hovering updates the tooltip
  // line alone, and the ring is a CSS :hover (.cg-day in cards.css).
  const grid = useMemo(
    () =>
      weeks?.map((week, wi) => (
        <div key={wi} className="cg-week">
          {week.map((day, di) =>
            day ? (
              <i
                key={di}
                className={`cg-day cg-l${day.level}`}
                data-day={`${day.count} ${day.date}`}
              />
            ) : (
              <i key={di} className="cg-day cg-day--none" />
            ),
          )}
        </div>
      )),
    [weeks],
  );

  if (!weeks && !loading) return null;

  // One listener for the whole grid instead of two per cell.
  const onOver = (event) => {
    const [count, date] = event.target.dataset?.day?.split(' ') || [];
    setHover(date ? `${count} ${noun}${count === '1' ? '' : 's'} on ${date}` : null);
  };
  const total = weeks ? yearTotal(data) : null;
  const frame = boxed ? 'cg cg--boxed' : 'cg cg--band';

  const body = weeks ? (
    <div className={frame}>
      <div className="cg-months">
        {labels.map(({ i, label }) => (
          <span key={i} style={{ left: `${(i / weeks.length) * 100}%` }}>
            {label}
          </span>
        ))}
      </div>

      <div className="cg-body">
        <div className="cg-days" aria-hidden="true">
          {DAY_LABELS.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
        {/* Week columns flex, so the grid scales to fit and never scrolls. */}
        <div
          className="cg-weeks"
          role="img"
          aria-label={`${total.toLocaleString()} ${noun}s in the last year`}
          onMouseOver={onOver}
          onMouseLeave={() => setHover(null)}
        >
          {grid}
        </div>
      </div>

      <div className="cg-foot">
        <span className="cg-note">
          {hover ||
            (help ? (
              <a href={help} {...EXTERNAL}>
                Learn how we count contributions
              </a>
            ) : (
              !boxed &&
              `${total.toLocaleString()} ${noun}${total === 1 ? '' : 's'} in the last year`
            ))}
        </span>
        <span>Less</span>
        <div className="cg-legend">
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={`cg-day cg-l${level}`} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  ) : (
    <div className={`${frame} cg-loading`}>loading contributions…</div>
  );

  if (!boxed) return body;
  return (
    <section className="cg-section" aria-label="Contributions">
      <h3 className="cg-heading">
        {total != null
          ? `${total.toLocaleString()} ${noun}${total === 1 ? '' : 's'} in the last year`
          : 'Contributions'}
      </h3>
      {body}
    </section>
  );
}
