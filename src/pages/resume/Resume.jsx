// Resume.jsx — printable CV, integrated into the SPA router
const { useState, useEffect } = React;

function ResumeSectionLabel({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
      <span style={{
        fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--foreground-subtle)', whiteSpace: 'nowrap',
      }}>{text}</span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

function ResumeEntry({ role, degree, company, school, location, start, end, description, employment }) {
  const title    = role || degree;
  const org      = company || school;
  const isActive = end === 'present';

  return (
    <div style={{ marginBottom: '22px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: '16px', marginBottom: '4px',
      }}>
        <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--foreground)' }}>
          {title}
        </span>
        <span style={{
          fontSize: '11px', color: 'var(--foreground-muted)',
          fontVariantNumeric: 'tabular-nums', flexShrink: 0,
        }}>
          {start}<span style={{ margin: '0 2px' }}>–</span>
          <span style={{ color: isActive ? 'var(--primary)' : 'var(--foreground-muted)' }}>{end}</span>
        </span>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        marginBottom: description ? '8px' : 0,
      }}>
        <span style={{ fontSize: '12px', color: isActive ? 'var(--primary)' : 'var(--foreground-muted)' }}>
          {org}
        </span>
        {location && (
          <span style={{ fontSize: '11px', color: 'var(--foreground-subtle)' }}>· {location}</span>
        )}
        {employment && (
          <span style={{
            fontSize: '10px', color: 'var(--foreground-subtle)',
            border: '1px solid var(--border)', borderRadius: '3px', padding: '0 5px',
          }}>{employment}</span>
        )}
      </div>

      {description && (
        <div>
          {Array.isArray(description)
            ? description.map((d, i) => (
                <div key={i} style={{
                  fontSize: '12px', color: 'var(--foreground-muted)',
                  paddingLeft: '12px', position: 'relative', lineHeight: '1.75',
                }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--foreground-subtle)' }}>·</span>
                  {d}
                </div>
              ))
            : <p style={{ fontSize: '12px', color: 'var(--foreground-muted)', lineHeight: '1.75', margin: 0 }}>{description}</p>
          }
        </div>
      )}
    </div>
  );
}

function Resume() {
  const [resume,   setResume]   = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [links,    setLinks]    = useState(null);
  const [btnHover, setBtnHover] = useState(false);

  useEffect(() => {
    window.PortfolioData.getResume().then(setResume).catch(() => {});
    window.PortfolioData.getProfile().then(setProfile).catch(() => {});
    window.PortfolioData.getLinks().then(setLinks).catch(() => {});

    // Inject print styles — hide nav & button, force white page
    const s = document.createElement('style');
    s.id = 'resume-print-css';
    s.textContent = `
      @media print {
        nav                { display: none !important; }
        .resume-print-btn  { display: none !important; }
        body               { background: #fff !important; color: #0a0a0b !important; }
      }
      @page { margin: 1cm 1.5cm; }
    `;
    document.head.appendChild(s);
    return () => document.getElementById('resume-print-css')?.remove();
  }, []);

  const experience = resume?.items?.filter(i => i.type === 'work') || [];
  const education  = resume?.items?.filter(i => i.type === 'education') || [];
  const skills     = resume?.skills || [];

  const contactItems = [
    links?.github   && { label: 'github',   href: links.github.url,   text: 'github.com/' + (links.github.username || '') },
    links?.x        && { label: 'x',        href: links.x.url,        text: 'x.com/' + (links.x.handle || '') },
    links?.telegram && { label: 'telegram', href: links.telegram.url, text: 't.me/' + (links.telegram.handle || '') },
    links?.linkedin && { label: 'linkedin', href: links.linkedin.url, text: 'linkedin.com/in/' + (links.linkedin.handle || '') },
  ].filter(Boolean);

  return (
    <main style={{
      maxWidth: '760px', margin: '0 auto',
      padding: '96px 24px 80px',
      fontFamily: 'var(--font-mono)',
    }}>

      {/* ── Print / Save PDF — pinned below the nav bar ── */}
      <button
        className="resume-print-btn"
        onClick={() => window.print()}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        style={{
          position: 'fixed', top: '68px', right: '20px',
          background: 'transparent',
          border: '1px solid ' + (btnHover ? 'var(--primary)' : 'var(--border)'),
          color: btnHover ? 'var(--primary)' : 'var(--foreground-muted)',
          borderRadius: '4px', padding: '5px 12px',
          fontSize: '11px', cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          transition: 'border-color 150ms, color 150ms',
          zIndex: 40,
        }}
      >
        print / save pdf
      </button>

      {/* ── Header ── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '36px', gap: '24px',
      }}>
        <div>
          <h1 style={{
            fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em',
            marginBottom: '4px', lineHeight: 1.2,
            color: 'var(--foreground)', margin: '0 0 4px',
          }}>
            {profile?.name || 'hamed ghasempour'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--foreground-muted)', margin: 0 }}>
            {profile?.title || 'devops engineer'}
          </p>
        </div>

        {contactItems.length > 0 && (
          <div style={{
            textAlign: 'right', fontSize: '11px',
            color: 'var(--foreground-subtle)', lineHeight: '1.9', flexShrink: 0,
          }}>
            {contactItems.map(({ label, href, text }) => (
              <div key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'none' }}
                >
                  {text}
                </a>
              </div>
            ))}
          </div>
        )}
      </header>

      {profile?.bio && (
        <p style={{
          fontSize: '12px', color: 'var(--foreground-muted)',
          lineHeight: '1.75', marginBottom: '32px', maxWidth: '520px',
        }}>
          {profile.bio}
        </p>
      )}

      <div style={{ height: '1px', background: 'var(--border)', marginBottom: '32px' }} />

      {/* ── Experience ── */}
      {experience.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <ResumeSectionLabel text="experience" />
          {experience.map((item, i) => <ResumeEntry key={i} {...item} />)}
          <div style={{ height: '1px', background: 'var(--border)', marginTop: '4px' }} />
        </section>
      )}

      {/* ── Education ── */}
      {education.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <ResumeSectionLabel text="education" />
          {education.map((item, i) => <ResumeEntry key={i} {...item} />)}
          <div style={{ height: '1px', background: 'var(--border)', marginTop: '4px' }} />
        </section>
      )}

      {/* ── Skills ── */}
      {skills.length > 0 && (
        <section>
          <ResumeSectionLabel text="skills" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {skills.map(s => (
              <span key={s} style={{
                fontSize: '11px', color: 'var(--foreground-muted)',
                border: '1px solid var(--border)', borderRadius: '3px',
                padding: '2px 8px',
              }}>{s}</span>
            ))}
          </div>
        </section>
      )}

    </main>
  );
}

Object.assign(window, { Resume });
