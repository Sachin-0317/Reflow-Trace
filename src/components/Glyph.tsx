import type { Confidence } from '../types';

const P: Record<string, string> = {
  point: 'M9 9h6v6H9zM12 3v4M12 17v4M3 12h4M17 12h4',
  bin: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  collector: 'M12 4a3.2 3.2 0 1 0 0 6.4A3.2 3.2 0 0 0 12 4zM5 20c0-3.6 3-5.6 7-5.6s7 2 7 5.6',
  truck: 'M2 7h12v9H2zM14 10h4l4 3.5V16h-8zM6 19a1.7 1.7 0 1 0 0-.01M17 19a1.7 1.7 0 1 0 0-.01',
  plant: 'M3 20V11l6 3v-3l6 3V6h4v14zM7 17h2M12 17h2',
  scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16',
  scale: 'M4 19h16M12 19V7M6 7h12M6 7l-2.5 6h5zM18 7l-2.5 6h5z',
  camera: 'M3 8h4l2-3h6l2 3h4v11H3zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z',
  sensor: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  signal: 'M5 20v-3M10 20v-7M15 20v-11M20 20V4',
  battery: 'M3 8h16v8H3zM19 11h2v2h-2zM6 11v2M9 11v2M12 11v2',
  clock: 'M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16zM12 8v4.5l3 2',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3M12 14.5v2',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10c-4-2-7-5-7-10V6zM9 12l2.2 2.2L15 10',
  route: 'M6 5a1.8 1.8 0 1 0 0 .01M18 19a1.8 1.8 0 1 0 0 .01M7.8 5H13a3.5 3.5 0 0 1 0 7h-2a3.5 3.5 0 0 0 0 7h5.2',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  refresh: 'M20 5v5h-5M4 19v-5h5M5.5 9A7.5 7.5 0 0 1 19 10M18.5 15A7.5 7.5 0 0 1 5 14',
  close: 'M5 5l14 14M19 5L5 19',
  check: 'M5 12.5l4.5 4.5L19 7',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM16 16l5 5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  logout: 'M10 4H4v16h6M14 8l4 4-4 4M18 12H9',
  back: 'M15 5l-7 7 7 7',
  offline: 'M3 3l18 18M8.5 8.5A8 8 0 0 0 5 11M12 6a12 12 0 0 1 7 3M9 14a5 5 0 0 1 3-1.2M12 19.5h.01',
  play: 'M7 4l13 8-13 8z',
  nav: 'M4 12h6l2-6 3 12 2-6h3',
};

export function Glyph({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <path d={P[name] ?? P.point} />
    </svg>
  );
}

export const CONF_GLYPH: Record<Confidence, string> = {
  verified: '●', attested: '▲', discrepancy: '◆', pending: '◌', unknown: '⊘',
};
