import React from 'react';
import { followRoute, routeHref } from '../../lib/router.js';
import SectionHead from './SectionHead.jsx';

// The tool chips, from resume.json skills[]. Skills that match a published blog
// tag link directly to the filtered blog list; the rest stay plain labels.
export default function Stack({ skills, blogTags }) {
  if (!skills?.length) return null;
  const tags = new Set((blogTags || []).map((t) => t.toLowerCase()));

  return (
    <div className="home-section">
      <SectionHead command="stack --list" />
      <div className="stack-list">
        {skills.map((s) => {
          const matched = tags.has(s.toLowerCase());
          if (!matched) {
            return (
              <span className="stack-chip" key={s}>
                {s}
              </span>
            );
          }
          const route = `blog?tag=${encodeURIComponent(s.toLowerCase())}`;
          return (
            <a
              key={s}
              href={routeHref(route)}
              onClick={followRoute(route)}
              className="stack-chip is-linked"
              title={`posts tagged “${s}”`}
            >
              {s}
            </a>
          );
        })}
      </div>
    </div>
  );
}
