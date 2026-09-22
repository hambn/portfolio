import React from 'react';
import SectionHead from './SectionHead.jsx';

// The tool chips, from resume.json skills[].
export default function Stack({ skills }) {
  if (!skills?.length) return null;

  return (
    <div className="home-section">
      <SectionHead command="stack --list" />
      <div className="stack-list">
        {skills.map((s) => (
          <span className="stack-chip" key={s}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
