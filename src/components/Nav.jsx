// App.jsx — Nav + theme toggle
const { useState, useEffect } = React;

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

function Nav({ page }) {
  const [theme,   setTheme]   = useState(() => localStorage.getItem('hambn-theme') || 'dark');
  const [profile, setProfile] = useState(null);
  const width    = useWindowWidth();
  const isMobile = width < 640;
  const isHome   = page === 'home';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hambn-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.PortfolioData.getProfile().then(setProfile).catch(() => {});
  }, []);

  const handle = profile?.handle || 'hambn';

  const navItems = [
    { key: 'projects', label: 'projects' },
    { key: 'blog',     label: 'blog'     },
    { key: 'links',    label: 'links'    },
  ];

  const go = (key) => (e) => {
    e.preventDefault();
    window.navigate && window.navigate(key);
  };

  const goHome = (e) => {
    e.preventDefault();
    window.navigate && window.navigate('home');
  };

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  /* ── Mobile layout: single top bar ── */
  if (isMobile) {
    return (
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '52px',
        background: 'var(--background)', borderBottom: '1px solid var(--border)',
        zIndex: 50, display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: '2px',
      }}>
        {/* Brand */}
        <a href="/" onClick={goHome} style={{
          fontFamily: 'var(--font-mono)', fontWeight: isHome ? 700 : 600, fontSize: isHome ? '13px' : '12px',
          textDecoration: 'none', letterSpacing: '-0.01em',
          display: 'inline-flex', alignItems: 'baseline',
          padding: '5px 6px', borderRadius: 'var(--radius-md)',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <span style={{ color: isHome ? 'var(--primary)' : 'var(--foreground-faint)', fontWeight: 400 }}>~/</span>
          <span style={{ color: 'var(--foreground-faint)', fontWeight: 400 }}>..</span>
          <span style={{ color: isHome ? 'var(--primary)' : 'var(--foreground-faint)', fontWeight: 400 }}>/</span>
          <span style={{ color: isHome ? 'var(--foreground)' : 'var(--foreground-muted)', transition: 'color 150ms' }}>{handle}</span>
        </a>

        {/* Nav links */}
        {navItems.map(({ key, label }) => {
          const active = page === key;
          return (
            <a key={key} href={'/' + key} onClick={go(key)} style={{
              fontSize: active ? '13px' : '12px', padding: '5px 6px', borderRadius: 'var(--radius-md)',
              color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
              fontWeight: active ? '700' : '500',
              transition: 'color 150ms', fontFamily: 'var(--font-mono)',
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span style={{ color: active ? 'var(--primary)' : 'var(--foreground-faint)', fontSize: '0.85em' }}>~/</span>{label}
            </a>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Theme toggle */}
        <button onClick={toggleTheme} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--foreground-muted)', padding: '6px 8px',
          borderRadius: 'var(--radius-md)', fontSize: '13px',
          fontFamily: 'var(--font-mono)', flexShrink: 0,
        }} aria-label="toggle theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </nav>
    );
  }

  /* ── Desktop layout: centered cluster, theme btn pinned right ── */
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
      background: 'var(--background)', borderBottom: '1px solid var(--border)',
      zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Centered group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {/* Brand */}
        <a href="/" onClick={goHome} style={{
          fontFamily: 'var(--font-mono)', fontWeight: isHome ? 700 : 600, fontSize: isHome ? '15px' : '14px',
          textDecoration: 'none', letterSpacing: '-0.01em',
          display: 'inline-flex', alignItems: 'baseline',
          padding: '6px 10px', borderRadius: 'var(--radius-md)',
        }}>
          <span style={{ color: isHome ? 'var(--primary)' : 'var(--foreground-faint)', fontWeight: 400 }}>~/</span>
          <span style={{ color: 'var(--foreground-faint)', fontWeight: 400 }}>..</span>
          <span style={{ color: isHome ? 'var(--primary)' : 'var(--foreground-faint)', fontWeight: 400 }}>/</span>
          <span style={{ color: isHome ? 'var(--foreground)' : 'var(--foreground-muted)', transition: 'color 150ms' }}>{handle}</span>
        </a>

        {navItems.map(({ key, label }) => {
          const active = page === key;
          return (
            <a key={key} href={'/' + key} onClick={go(key)} style={{
              fontSize: active ? '15px' : '14px', padding: '6px 10px', borderRadius: 'var(--radius-md)',
              color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
              fontWeight: active ? '700' : '500',
              transition: 'color 150ms', fontFamily: 'var(--font-mono)',
              textDecoration: 'none',
            }}>
              <span style={{ color: active ? 'var(--primary)' : 'var(--foreground-faint)', fontSize: '0.85em' }}>~/</span>{label}
            </a>
          );
        })}
      </div>

      {/* Theme toggle — pinned to the right */}
      <button onClick={toggleTheme} style={{
        position: 'absolute', right: '20px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--foreground-muted)', padding: '6px 8px',
        borderRadius: 'var(--radius-md)', fontSize: '14px',
        fontFamily: 'var(--font-mono)',
      }} aria-label="toggle theme">
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </nav>
  );
}

Object.assign(window, { Nav });
