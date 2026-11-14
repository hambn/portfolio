// Resume.jsx — printable CV, integrated into the SPA router
import './resume.css';
import React from 'react';
import { useContent } from '../../hooks/useContent.js';
import ErrorState from '../../components/ErrorState.jsx';
import Icon from '../../components/Icon.jsx';
import { EXTERNAL } from '../../lib/external.js';

function ResumeSectionLabel({ text }) {
  return (
    <div className="resume-section-label">
      <h2>{text}</h2>
      <div className="resume-rule" />
    </div>
  );
}

function ResumeEntry({
  role,
  degree,
  company,
  school,
  location,
  start,
  end,
  description,
  employment,
}) {
  const active = end === 'present' ? ' is-active' : '';

  return (
    <div className="resume-entry">
      <div className="resume-entry-head">
        <span className="resume-entry-title">{role || degree}</span>
        <span className="resume-entry-dates">
          {start}
          <span className="resume-dash">–</span>
          <span className={active.trim() || undefined}>{end}</span>
        </span>
      </div>

      <div className="resume-entry-meta">
        <span className={`resume-entry-org${active}`}>{company || school}</span>
        {location && <span className="resume-entry-location">· {location}</span>}
        {employment && <span className="resume-entry-employment">{employment}</span>}
      </div>

      {description &&
        (Array.isArray(description) ? (
          <div>
            {description.map((d, i) => (
              <div key={i} className="resume-entry-text resume-entry-line">
                {d}
              </div>
            ))}
          </div>
        ) : (
          <p className="resume-entry-text">{description}</p>
        ))}
    </div>
  );
}

function ResumeSection({ label, items }) {
  if (!items.length) return null;
  return (
    <section className="resume-section">
      <ResumeSectionLabel text={label} />
      {items.map((item, i) => (
        <ResumeEntry key={i} {...item} />
      ))}
      <div className="resume-rule" />
    </section>
  );
}

export default function Resume() {
  const sources = [useContent('resume'), useContent('profile'), useContent('links')];
  const [resume, profile, links] = sources.map((source) => source.data);
  const error = sources.some((source) => source.error);
  // What already loaded answers from PortfolioData's cache, so only the
  // failed request goes out again.
  const retry = () => sources.forEach((source) => source.retry());

  const experience = resume?.items?.filter((i) => i.type === 'work') || [];
  const education = resume?.items?.filter((i) => i.type === 'education') || [];
  const skills = resume?.skills || [];

  const contactItems = [
    links?.email && {
      label: 'email',
      href: 'mailto:' + links.email.address,
      text: links.email.address,
    },
    links?.github && {
      label: 'github',
      href: links.github.url,
      text: 'github.com/' + (links.github.username || ''),
    },
    links?.telegram && {
      label: 'telegram',
      href: links.telegram.url,
      text: 't.me/' + (links.telegram.handle || ''),
    },
    links?.linkedin && {
      label: 'linkedin',
      href: links.linkedin.url,
      text: 'linkedin.com/in/' + (links.linkedin.handle || ''),
    },
  ].filter(Boolean);

  return (
    <main className="resume-main">
      <button type="button" className="resume-print-btn" onClick={() => window.print()}>
        <Icon name="printer" />
        print / save pdf
      </button>

      {error && (
        <div className="resume-error">
          <ErrorState message="failed to load resume data." onRetry={retry} />
        </div>
      )}
      <header className="resume-header">
        <div>
          <h1 className="resume-name">{profile?.name || ''}</h1>
          <p className="resume-role">{profile?.title || ''}</p>
        </div>

        {contactItems.length > 0 && (
          <div className="resume-contact">
            {contactItems.map(({ label, href, text }) => (
              <div key={label}>
                <a href={href} {...EXTERNAL}>
                  {text}
                </a>
              </div>
            ))}
          </div>
        )}
      </header>

      {profile?.bio && <p className="resume-bio">{profile.bio}</p>}

      <div className="resume-rule resume-divider" />

      <ResumeSection label="experience" items={experience} />
      <ResumeSection label="education" items={education} />

      {skills.length > 0 && (
        <section className="resume-section">
          <ResumeSectionLabel text="skills" />
          <div className="resume-skills">
            {skills.map((s) => (
              <span key={s} className="resume-skill">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
