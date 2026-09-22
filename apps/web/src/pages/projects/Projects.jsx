// Projects.jsx — GitHub public repos
// GitHub username is read from contents/links/links.json (github.username)
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import { apiUrl } from '../../lib/api.js';
import ErrorState from '../../components/ErrorState.jsx';
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

function RepoCard({ repo }) {
  const pushed = new Date(repo.pushed_at).toLocaleDateString('en', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="repo-card">
      <div className="repo-card-head">
        <span className="repo-card-name">{repo.name}</span>
        {repo.stargazers_count > 0 && (
          <span className="repo-card-stars">★ {repo.stargazers_count}</span>
        )}
      </div>

      {repo.description && <p className="repo-card-desc">{repo.description}</p>}

      <div className="repo-card-foot">
        {repo.language && (
          <span className="repo-card-lang">
            <span
              className="repo-card-dot"
              style={{ background: LANG_COLORS[repo.language] || '#888' }}
            />
            {repo.language}
          </span>
        )}
        <span className="repo-card-pushed">{pushed}</span>
      </div>
    </a>
  );
}

export default function Projects() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const config = await PortfolioData.getLinks();
        const username = config?.github?.username;
        if (!username) throw new Error('no github username in links.json');
        const r = await fetch(apiUrl(`/github/repos?username=${encodeURIComponent(username)}`), {
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(`GitHub API: ${r.statusText}`);
        const data = await r.json();
        if (ctrl.signal.aborted) return;
        setRepos(
          data.sort(
            (a, b) =>
              b.stargazers_count - a.stargazers_count ||
              new Date(b.pushed_at) - new Date(a.pushed_at),
          ),
        );
        setLoading(false);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(e.message);
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [attempt]);

  if (loading) {
    const githubUrl = PortfolioData.peek('links')?.github?.url;
    return (
      <main className="projects-page">
        <h1 className="projects-title">projects</h1>
        {githubUrl && (
          <p className="projects-github">
            <a href={githubUrl}>view repositories on github ↗</a>
          </p>
        )}
        <span role="status" className="projects-status">
          fetching repos...
        </span>
      </main>
    );
  }

  if (error)
    return (
      <main className="projects-page">
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      </main>
    );

  return (
    <main className="projects-page">
      <div className="projects-head">
        <h1 className="projects-title">projects</h1>
        <p className="projects-status">{repos.length} public repositories on github</p>
      </div>
      <div className="repo-grid">
        {repos.map((r) => (
          <RepoCard key={r.id} repo={r} />
        ))}
      </div>
    </main>
  );
}
