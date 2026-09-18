import React from 'react';
import SectionHead from './SectionHead.jsx';

// The tool chips, from resume.json skills[].
export default function Stack({ skills }) {
  if (!skills?.length) return null;

  return (
    <div style={{ marginBottom: '56px' }}>
      <SectionHead command="stack --list" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {skills.map((s) => (
          <span className="stack-chip" key={s}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
