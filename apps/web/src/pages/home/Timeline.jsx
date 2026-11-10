import React from 'react';
import { followRoute, routeHref } from '../../lib/router.js';
import Icon from '../../components/Icon.jsx';
import GitLog from './GitLog.jsx';
import SectionHead from './SectionHead.jsx';

// Work & education, drawn as a git history; resume.json branches[] drives it.
export default function Timeline({ resume }) {
  if (!resume?.branches?.length) return null;

  const fullResume = (
    <a href={routeHref('resume')} onClick={followRoute('resume')} className="link-quiet">
      full resume
      <Icon name="arrow-right" className="icon-nudge" />
    </a>
  );

  return (
    <div className="home-section">
      <SectionHead command="history --graph" action={fullResume} gap="18px">
        <span className="sr-only"> work &amp; education</span>
      </SectionHead>
      <GitLog branches={resume.branches} born={resume.born} />
    </div>
  );
}
