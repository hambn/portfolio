// Projects.jsx — GitHub public repos
// GitHub username is read from contents/links/links.json (github.username)
const { useState, useEffect } = React;

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python:     '#3572A5',
  Nix:        '#7e7eff', Go:         '#00ADD8', Shell:      '#89e051',
  Rust:       '#dea584', YAML:       '#cb171e', HTML:       '#e34c26',
  CSS:        '#563d7c', Dockerfile: '#384d54', Lua:        '#000080',
  Ruby:       '#701516', 'C++':      '#f34b7d', C:          '#555555',
  Makefile:   '#427819',
};

function RepoCard({ repo }) {
  const [hov, setHov] = useState(false);
  const pushed = new Date(repo.pushed_at).toLocaleDateString('en', { month: 'short', year: 'numeric' });

  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block', textDecoration: 'none',
        background: 'var(--card)',
        border: `1px solid ${hov ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', padding: '16px 18px',
        transition: 'border-color 150ms',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontWeight: '600', fontSize: 'var(--text-sm)', color: hov ? 'var(--primary)' : 'var(--foreground)', transition: 'color 150ms', wordBreak: 'break-word' }}>
          {repo.name}
        </span>
        {repo.stargazers_count > 0 && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--foreground-subtle)', flexShrink: 0 }}>
            ★ {repo.stargazers_count}
          </span>
        )}
      </div>

      {repo.description && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--foreground-muted)', lineHeight: '1.55', marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {repo.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {repo.language && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: 'var(--text-xs)', color: 'var(--foreground-subtle)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: LANG_COLORS[repo.language] || '#888', flexShrink: 0 }}></span>
            {repo.language}
          </span>
        )}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--foreground-faint)', marginLeft: 'auto' }}>{pushed}</span>
      </div>
    </a>
  );
}

function Projects() {
  const [repos,   setRepos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const config   = await window.PortfolioData.getLinks();
        const username = config?.github?.username;
        if (!username) throw new Error('no github username in links.json');
        const r = await fetch(
          `https://api.github.com/users/${username}/repos?sort=updated&type=public&per_page=30`
        );
        if (!r.ok) throw new Error(`GitHub API: ${r.statusText}`);
        const data = await r.json();
        setRepos(data.sort(
          (a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at))
        ));
        setLoading(false);
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    })();
  }, []);

  const wrap = { maxWidth: '900px', margin: '0 auto', padding: '88px 24px 80px' };

  if (loading) return (
    <main style={wrap}>
      <span style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>fetching repos...</span>
    </main>
  );

  if (error) return (
    <main style={wrap}>
      <span style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)' }}>{error}</span>
    </main>
  );

  return (
    <main style={wrap}>
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', marginBottom: '6px' }}>projects</h2>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>
          {repos.length} public repositories on github
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
        {repos.map(r => <RepoCard key={r.id} repo={r} />)}
      </div>
    </main>
  );
}

Object.assign(window, { Projects });
