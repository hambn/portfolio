// What the GitLab card reads from gitlab.com. The API uses this for its cached
// `/gitlab` routes; the site uses the same paths when it asks GitLab directly
// from the visitor's browser, so both sources hand the card the same shape.

export const GITLAB_ORIGIN = 'https://gitlab.com';

/** gitlab.com paths for one account's card. */
export const gitlabPaths = {
  /** The public profile, as a one-element list. Readable cross-origin. */
  users: (username: string) => `/api/v4/users?username=${encodeURIComponent(username)}`,
  /** A year of activity as `{ "YYYY-MM-DD": count }`. Not readable cross-origin. */
  calendar: (username: string) => `/users/${encodeURIComponent(username)}/calendar.json`,
};

export interface ContributionDay {
  date: string;
  count: number;
  /** 0 to 4, the shade the day is drawn in. */
  level: number;
}

/** GitLab's own shading steps for its activity calendar. */
const level = (count: number) =>
  count <= 0 ? 0 : count < 10 ? 1 : count < 20 ? 2 : count < 30 ? 3 : 4;

const DAY_MS = 86400 * 1000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * The calendar as one entry per day for the year ending on `now` (UTC), oldest
 * first, in the shape the contribution graph draws. Days GitLab leaves out had
 * no activity.
 */
export function calendarDays(calendar: Record<string, unknown>, now: number): ContributionDay[] {
  const end = Date.parse(`${isoDay(now)}T00:00:00Z`);
  const days: ContributionDay[] = [];
  for (let offset = 364; offset >= 0; offset--) {
    const date = isoDay(end - offset * DAY_MS);
    const value = calendar[date];
    const count = typeof value === 'number' && value > 0 ? Math.floor(value) : 0;
    days.push({ date, count, level: level(count) });
  }
  return days;
}
