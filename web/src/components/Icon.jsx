import React from 'react';

const ICONS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>
  ),
  'arrow-up-right': (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  dish: (
    <>
      <path d="M3 16h18" />
      <path d="M5 16a7 7 0 0 1 14 0" />
      <path d="M12 7V5.5" />
      <path d="M10.5 5.5h3" />
      <path d="M4 19.5h16" />
    </>
  ),
  chef: (
    <>
      <path d="M7 14v6h10v-6" />
      <path d="M7 14a4 4 0 1 1 1.6-7.7 3.6 3.6 0 0 1 6.8 0A4 4 0 1 1 17 14" />
      <path d="M7 17h10" />
    </>
  ),
  box: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 17h.01" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  ),
  flame: (
    <>
      <path d="M12 22c4.1 0 7-2.8 7-7 0-3.9-2.6-6.4-4.2-9.2-.4 2.1-1.3 3.6-2.6 4.6C12 8 10.6 5.4 9 3c-.6 3.4-4 6.4-4 11.4C5 19 8 22 12 22Z" />
      <path d="M12 22c-1.7 0-3-1.3-3-3.2 0-1.9 1.6-3 3-4.8 1.4 1.8 3 2.9 3 4.8 0 1.9-1.3 3.2-3 3.2Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5.5-14 15-15-1 9.5-7 15-15 15Z" />
      <path d="M5 19 13 11" />
    </>
  ),
  bike: (
    <>
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M15 6h2l3 11" />
      <path d="M5.5 17 9 9h7l-4 8H5.5" />
      <path d="M9 9 7.5 6H5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5 12v8h14v-8" />
      <path d="M10 20v-4h4v4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </>
  ),
  drumstick: (
    <g transform="rotate(40 12 12)">
      <path d="M12 1.8c4.1 0 6.6 3.1 6.6 6.6 0 3.2-2.6 5.2-4.9 6.4v4.1" />
      <path d="M12 1.8c-4.1 0-6.6 3.1-6.6 6.6 0 3.2 2.6 5.2 4.9 6.4v4.1" />
      <path d="M10.3 18.9a1.7 1.7 0 1 0-1.4 2.6M13.7 18.9a1.7 1.7 0 1 1 1.4 2.6" />
    </g>
  ),
  pan: (
    <>
      <circle cx="9.75" cy="14.25" r="7" />
      <path d="M9.75 10a4.25 4.25 0 1 1 0 8.5a4.25 4.25 0 1 1 0-8.5m5-.75L16.5 7.5m1.13.63l3-3a1.25 1.25 0 0 0-1.76-1.76l-3 3a1.25 1.25 0 0 0 1.76 1.76" />
    </>
  ),
};

export default function Icon({ name, cls = 'w-5 h-5', sw = 1.8, filled = false }) {
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name] || null}
    </svg>
  );
}
