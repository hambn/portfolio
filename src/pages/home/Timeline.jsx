import React from 'react';
import { navigate } from '../../lib/router.js';
import GitLog from './GitLog.jsx';
import SectionHead from './SectionHead.jsx';

// Work & education, drawn as a git history; resume.json branches[] drives it.
export default function Timeline({ resume }) {
  if (!resume?.branches?.length) return null;

  const fullResume = (
    <a
      href={import.meta.env.BASE_URL + 'resume/'}
      onClick={(e) => {
        e.preventDefault();
        navigate('resume');
      }}
      className="link-quiet"
      style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}
    >
      full resume →
    </a>
  );

  return (
    <div style={{ marginBottom: '56px' }}>
      <SectionHead command="history --graph" action={fullResume} gap="18px">
        <span className="sr-only"> work &amp; education</span>
      </SectionHead>
      <GitLog branches={resume.branches} born={resume.born} />
    </div>
  );
}
