// Projects.jsx — featured projects from content, then every public repository
// per git host.
//
// The featured cards render from content/projects/projects.json alone, so the
// page is complete in the prerendered HTML. The `projects` entry of the site's
// one API request (lib/siteFeed.js) then fills in what the hosts know (stars,
// language, homepage) and the per-host listings; the page makes a request of
// its own only when no other page has already. The API answers from its own
// hourly snapshot, and the last answer is kept in localStorage, so a slow or
// rate-limited git host is never something a visitor waits on. When the API
// itself cannot be reached, the visitor's browser lists the hosts directly
// (directProjects.js), so the page still fills in.
import React, { useEffect, useMemo, useState } from 'react';
import { GIT_HOSTS, featuredProjects, projectAccounts } from '@portfolio/shared/projects';
import { PortfolioData } from '../../lib/data.js';
import { ensureCards, useSiteCard } from '../../lib/siteFeed.js';
import { storage } from '../../lib/storage.js';
import Icon from '../../components/Icon.jsx';
import './projects.css';
import { loadProjectsDirect } from './directProjects.js';
import { LANG_COLORS } from '../../lib/languages.js';

const STORAGE_KEY = 'projects:v1';
const DIRECT_TTL_MS = 3600 * 1000;

const monthYear = new Intl.DateTimeFormat('en', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatted = (format, iso) => {
  const time = Date.parse(iso || '');
  return Number.isNaN(time) ? null : format.format(time);
};
const hostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

/** A stored API answer, or null. Anything not shaped like one is ignored. */
function stored() {
  try {
    const value = JSON.parse(storage.get(STORAGE_KEY) || 'null');
    return Array.isArray(value?.featured) && Array.isArray(value?.sections) ? value : null;
  } catch {
    return null;
  }
}

/**
 * What to show: content decides the featured cards and their order, and the
 * API answer (live or stored) only adds what the hosts report. A stored answer
 * from before a content edit therefore never brings an old card back.
 */
function view(content, answer) {
  if (!content) return answer;
  const known = new Map((answer?.featured || []).map((project) => [project.id, project]));
  for (const section of answer?.sections || [])
    for (const repo of section.repos) if (!known.has(repo.id)) known.set(repo.id, repo);
  return {
    updatedAt: answer?.updatedAt ?? null,
    featured: featuredProjects(content, (id) => known.get(id)),
    sections: answer?.sections || [],
    unavailable: answer?.unavailable || [],
  };
}

const HOST_ORDER = Object.keys(GIT_HOSTS);
const sameAccount = (a, b) => a.host === b.host && a.username === b.username;

/**
 * A new answer with some hosts still unavailable keeps those hosts' sections
 * from the last answer this browser saw, so a host that is briefly down does
 * not vanish from the page (or from what is stored for next time).
 */
function merge(data, last) {
  const unavailable = Array.isArray(data.unavailable) ? data.unavailable : [];
  const kept = (last?.sections || []).filter(
    (section) =>
      unavailable.some((account) => sameAccount(account, section)) &&
      !data.sections.some((fresh) => sameAccount(fresh, section)),
  );
  if (!kept.length) return { ...data, unavailable };
  return {
    ...data,
    sections: [...data.sections, ...kept].sort(
      (a, b) => HOST_ORDER.indexOf(a.host) - HOST_ORDER.indexOf(b.host),
    ),
    unavailable: unavailable.filter(
      (account) => !kept.some((section) => sameAccount(account, section)),
    ),
  };
}

function ProjectCard({ project, featured = false }) {
  const pushed = formatted(monthYear, project.pushedAt);
  const site = project.homepage && project.homepage !== project.repo ? project.homepage : null;
  // The title goes to the repository; a manual project without one goes to its site.
  const primary = project.repo || site;
  return (
    <li className={featured ? 'project-card project-card--featured' : 'project-card'}>
      <div className="project-card-head">
        <h3 className="project-card-name">
          {primary ? (
            <a href={primary} target="_blank" rel="noopener noreferrer">
              {project.name}
            </a>
          ) : (
            project.name
          )}
        </h3>
        {project.stars > 0 && (
          <span className="project-card-stars" title={`${project.stars} stars`}>
            <Icon name="star" />
            {project.stars}
            <span className="sr-only"> stars</span>
          </span>
        )}
      </div>

      {project.description && <p className="project-card-desc">{project.description}</p>}

      {featured && project.topics.length > 0 && (
        <ul className="project-card-topics" aria-label="topics">
          {project.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      )}

      <div className="project-card-foot">
        {project.language && (
          <span className="project-card-lang">
            <span
              className="project-card-dot"
              style={{ background: LANG_COLORS[project.language] || '#888' }}
            />
            {project.language}
          </span>
        )}
        {project.archived && <span className="project-card-flag">archived</span>}
        {project.fork && <span className="project-card-flag">fork</span>}
        {pushed && <span className="project-card-pushed">{pushed}</span>}
      </div>

      {(site || (featured && project.repo)) && (
        <div className="project-card-links">
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer">
              <Icon name="globe" />
              {hostname(site) || 'website'}
            </a>
          )}
          {featured && project.repo && project.host && (
            <a href={project.repo} target="_blank" rel="noopener noreferrer">
              <Icon name={project.host} />
              source on {GIT_HOSTS[project.host].label.toLowerCase()}
            </a>
          )}
        </div>
      )}
    </li>
  );
}

export default function Projects() {
  // First render is content only, exactly what the prerendered HTML holds.
  const [content, setContent] = useState(() => PortfolioData.peek('projects'));
  const [answer, setAnswer] = useState(null);
  // Fresh from the visit's one API request when another page already made it;
  // otherwise this asks for it now (during render, so the entry reads as
  // pending rather than missing on the way in).
  useMemo(() => ensureCards(['projects']), []);
  const feed = useSiteCard('projects');
  const body = feed.status === 'ready' ? feed.data : null;
  const usable = Array.isArray(body?.featured) && Array.isArray(body?.sections);

  // 'loading' | 'failed' | null: the git hosts asked directly, when the API
  // had no listing to give.
  const [direct, setDirect] = useState(null);

  useEffect(() => {
    if (feed.status === 'pending') {
      // The last answer this browser saw, shown while the new one is on its
      // way. Read after hydration so the first render matches the HTML.
      const last = stored();
      if (last) setAnswer((current) => current || last);
      return undefined;
    }
    if (usable) {
      const data = merge(body, stored());
      setDirect(null);
      setAnswer(data);
      // Only an answer that carries host data is worth keeping for next time.
      if (data.updatedAt) storage.set(STORAGE_KEY, JSON.stringify(data));
      return undefined;
    }
    // The API is unreachable. The featured cards and the account links come
    // from content, and the git hosts are asked for the listings themselves,
    // at most once an hour per browser (GitHub allows 60 anonymous requests).
    let alive = true;
    const last = stored();
    if (last) setAnswer((current) => current || last);
    if (last && Date.now() - Date.parse(last.updatedAt) < DIRECT_TTL_MS) return undefined;
    setDirect('loading');
    PortfolioData.getProjects()
      .then((loaded) => {
        if (alive) setContent(loaded);
        return loadProjectsDirect(loaded);
      })
      .then((data) => {
        if (!alive) return;
        const merged = merge(data, stored());
        setDirect(null);
        setAnswer(merged);
        storage.set(STORAGE_KEY, JSON.stringify(merged));
      })
      .catch(() => {
        if (alive) setDirect('failed');
      });
    return () => {
      alive = false;
    };
  }, [feed, body, usable]);

  // 'failed' only matters when nothing is stored either, because otherwise
  // the page already shows the last answer.
  const status =
    feed.status === 'pending' || direct === 'loading' ? 'loading' : usable ? 'ready' : 'failed';
  const shown = view(content, answer);
  const featured = shown?.featured || [];
  const sections = (shown?.sections || []).filter((section) => section.repos?.length);
  const accounts = projectAccounts(content);
  const pending = !sections.length && status === 'loading' && (accounts.length > 0 || !content);
  const unreachable = !sections.length && direct === 'failed';
  // Hosts the API has not heard from yet, while others are already listed.
  const waiting = sections.length ? shown?.unavailable || [] : [];

  return (
    <main className="projects-page">
      <h1 className="projects-title">projects</h1>

      {featured.length > 0 && (
        <section className="projects-section" aria-labelledby="projects-featured">
          <div className="projects-section-head">
            <h2 id="projects-featured" className="projects-heading">
              featured
            </h2>
          </div>
          <ul className="project-grid project-grid--featured">
            {featured.map((project) => (
              <ProjectCard key={project.id} project={project} featured />
            ))}
          </ul>
        </section>
      )}

      {sections.map((section) => (
        <section
          key={section.host}
          className="projects-section"
          aria-labelledby={`projects-${section.host}`}
        >
          <div className="projects-section-head">
            <h2 id={`projects-${section.host}`} className="projects-heading">
              {GIT_HOSTS[section.host]?.label.toLowerCase() || section.host}
            </h2>
            <span className="projects-count">
              {section.repos.length} {section.repos.length === 1 ? 'repository' : 'repositories'}
            </span>
            <a
              className="projects-account"
              href={section.url}
              target="_blank"
              rel="noopener noreferrer me"
            >
              <Icon name={section.host} />@{section.username}
              <Icon name="arrow-up-right" className="icon-nudge is-out" />
            </a>
          </div>
          <ul className="project-grid">
            {section.repos.map((repo) => (
              <ProjectCard key={repo.id} project={repo} />
            ))}
          </ul>
        </section>
      ))}

      {waiting.length > 0 && (
        <p role="status" className="projects-note">
          {waiting.map((account) => (
            <span key={account.host}>
              {GIT_HOSTS[account.host]?.label.toLowerCase() || account.host} is not answering right
              now —{' '}
              <a href={account.url} target="_blank" rel="noopener noreferrer me">
                @{account.username}
                <Icon name="arrow-up-right" className="icon-nudge is-out" />
              </a>
            </span>
          ))}
        </p>
      )}

      {pending && (
        <p role="status" className="projects-note">
          loading repositories…
        </p>
      )}

      {unreachable && (
        <p role="status" className="projects-note">
          the repository list is unavailable right now.{' '}
          {accounts.map((account) => (
            <a key={account.host} href={account.url} target="_blank" rel="noopener noreferrer me">
              {GIT_HOSTS[account.host].label.toLowerCase()}
              <Icon name="arrow-up-right" className="icon-nudge is-out" />
            </a>
          ))}
          <button
            type="button"
            className="error-state-retry"
            onClick={() => ensureCards(['projects'], { force: true })}
          >
            retry
          </button>
        </p>
      )}
    </main>
  );
}
