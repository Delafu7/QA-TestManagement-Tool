const base = (size, extra) => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  ...extra,
});

export function IconHome({ size = 18, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M3 9.5L10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5a.5.5 0 0 1-.5-.5V13a2 2 0 0 0-4 0v3.5a.5.5 0 0 1-.5.5H4a1 1 0 0 1-1-1V9.5Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconList({ size = 18, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="4" cy="5.5" r="1.1" fill={color} />
      <circle cx="4" cy="10" r="1.1" fill={color} />
      <circle cx="4" cy="14.5" r="1.1" fill={color} />
    </svg>
  );
}

export function IconLayers({ size = 18, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M10 3.5l7 3.5-7 3.5-7-3.5 7-3.5Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 10.5l7 3.5 7-3.5" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 13.5l7 3.5 7-3.5" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconDownload({ size = 18, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M10 3.5v9M6.5 9l3.5 3.5L13.5 9" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15h12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ size = 14, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg {...base(size)}>
      <path d="M4 10.5l4 4 8-9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCross({ size = 14, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg {...base(size)}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function IconBlock({ size = 14, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg {...base(size)}>
      <circle cx="10" cy="10" r="7" stroke={color} strokeWidth={strokeWidth} />
      <path d="M5.5 14.5l9-9" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

export function IconSkip({ size = 14, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg {...base(size)}>
      <path d="M5 7.5h6a3 3 0 0 1 0 6H8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 10.7L7 13.5l2.5 2.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClock({ size = 14, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg {...base(size)}>
      <circle cx="10" cy="10" r="7" stroke={color} strokeWidth={strokeWidth} />
      <path d="M10 6.5V10l2.6 1.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function IconCircle({ size = 14, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg {...base(size)}>
      <circle cx="10" cy="10" r="7" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

export function IconPlus({ size = 15, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M10 4.5v11M4.5 10h11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearch({ size = 15, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="9" r="5.5" stroke={color} strokeWidth="1.6" />
      <path d="M17 17l-4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronDown({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowLeft({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M12.5 5l-5 5 5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBug({ size = 15, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M10 6.5a3 3 0 0 1 3 3v3a3 3 0 1 1-6 0v-3a3 3 0 0 1 3-3Z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 6.5V5M7 8L5 6.5M13 8l2-1.5M7 12H4M16 12h-3M7.5 15l-2 1.5M12.5 15l2 1.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrend({ size = 15, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M3.5 13l4.5-4.5 3 3 5.5-5.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 6h4v4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFileJson({ size = 18, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M6 4.5h5l3 3v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 11.5l1.3 1.6L11.8 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFileMd({ size = 18, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M4.5 5.5h11M4.5 10h11M4.5 14.5h6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconNotion({ size = 18, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <rect x="4.5" y="3.5" width="11" height="13" rx="1.5" stroke={color} strokeWidth="1.6" />
      <path d="M7.5 7.5h5M7.5 10.5h5M7.5 13.5h3" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconWarning({ size = 15, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M10 6.5v4.5M10 13.8v.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.7 3.9a1.5 1.5 0 0 1 2.6 0l6.6 11.4a1.5 1.5 0 0 1-1.3 2.2H3.4a1.5 1.5 0 0 1-1.3-2.2L8.7 3.9Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClose({ size = 16, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconSettings({ size = 15, color = 'currentColor' }) {
  return (
    <svg {...base(size)}>
      <circle cx="10" cy="10" r="2.6" stroke={color} strokeWidth="1.6" />
      <path
        d="M10 3.2v1.7M10 15.1v1.7M16.8 10h-1.7M4.9 10H3.2M14.8 5.2l-1.2 1.2M6.4 13.4l-1.2 1.2M14.8 14.8l-1.2-1.2M6.4 6.6 5.2 5.4"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
