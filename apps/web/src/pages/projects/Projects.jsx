// Projects.jsx — featured projects from content, then every public repository
// per git host.
//
// The featured cards render from content/projects/projects.json alone, so the
// page is complete in the prerendered HTML. One request to the API's /projects
// then fills in what the hosts know (stars, language, homepage) and the
// per-host listings. The API answers from its own hourly snapshot, and the
// last answer is kept in localStorage, so a slow or rate-limited git host is
// never something a visitor waits on.
import React, { useEffect, useState } from 'react';
import { GIT_HOSTS, featuredProjects, projectAccounts } from '@portfolio/shared/projects';
import { PortfolioData } from '../../lib/data.js';
import { apiUrl } from '../../lib/api.js';
import { storage } from '../../lib/storage.js';
import './projects.css';

const LANG_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Nix: '#7e7eff',
  Go: '#00ADD8',
  Shell: '#89e051',
  Rust: '#dea584',
  YAML: '#cb171e',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Dockerfile: '#384d54',
  Lua: '#000080',
  Ruby: '#701516',
  'C++': '#f34b7d',
  C: '#555555',
  Makefile: '#427819',
};

const STORAGE_KEY = 'projects:v1';
const TIMEOUT_MS = 10000;

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
            <span aria-hidden="true">★</span> {project.stars}
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
              {hostname(site) || 'website'} <span aria-hidden="true">↗</span>
            </a>
          )}
          {featured && project.repo && project.host && (
            <a href={project.repo} target="_blank" rel="noopener noreferrer">
              source on {GIT_HOSTS[project.host].label.toLowerCase()}{' '}
              <span aria-hidden="true">↗</span>
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
  // 'loading' until the API answers; 'failed' only matters when nothing is
  // stored either, because otherwise the page already shows the last answer.
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let alive = true;
    (async () => {
      try {
        setStatus('loading');
        // The last answer this browser saw, shown while the new one is on its
        // way. Read after hydration so the first render matches the HTML.
        const last = stored();
        if (last) setAnswer((current) => current || last);
        const response = await fetch(apiUrl('/projects'), { signal: ctrl.signal });
        if (!response.ok) throw new Error(`projects ${response.status}`);
        const data = await response.json();
        if (!alive) return;
        if (!Array.isArray(data?.featured) || !Array.isArray(data?.sections))
          throw new Error('projects: unexpected response');
        setAnswer(data);
        setStatus('ready');
        // Only an answer that carries host data is worth keeping for next time.
        if (data.updatedAt) storage.set(STORAGE_KEY, JSON.stringify(data));
      } catch {
        if (!alive) return;
        setStatus('failed');
        // Opened by in-app navigation with the API unreachable: the featured
        // cards and the account links can still come from content.
        PortfolioData.getProjects()
          .then((value) => alive && setContent(value))
          .catch(() => {});
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [attempt]);

  const shown = view(content, answer);
  const featured = shown?.featured || [];
  const sections = (shown?.sections || []).filter((section) => section.repos?.length);
  const accounts = projectAccounts(content);
  const pending = !sections.length && status === 'loading' && (accounts.length > 0 || !content);
  const unreachable = !sections.length && status === 'failed';

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
              @{section.username} <span aria-hidden="true">↗</span>
            </a>
          </div>
          <ul className="project-grid">
            {section.repos.map((repo) => (
              <ProjectCard key={repo.id} project={repo} />
            ))}
          </ul>
        </section>
      ))}

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
              {GIT_HOSTS[account.host].label.toLowerCase()} <span aria-hidden="true">↗</span>
            </a>
          ))}
          <button
            type="button"
            className="error-state-retry"
            onClick={() => setAttempt((value) => value + 1)}
          >
            retry
          </button>
        </p>
      )}
    </main>
  );
}
