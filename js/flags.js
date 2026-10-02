// Small inline-SVG flags (3:2), so they render the same on every device
// (emoji flags don't show on Windows and there is no USSR emoji).

const h3 = (a, b, c) => `<rect width="30" height="7" fill="${a}"/><rect y="6.67" width="30" height="6.67" fill="${b}"/><rect y="13.33" width="30" height="6.67" fill="${c}"/>`;
const v3 = (a, b, c) => `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
const nordic = (bg, cross) => `<rect width="30" height="20" fill="${bg}"/><rect x="8" width="4" height="20" fill="${cross}"/><rect y="8" width="30" height="4" fill="${cross}"/>`;
const star = (cx, cy, r, fill, rot = 0) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2 + rot, rr = i % 2 ? r * 0.4 : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
};

const FLAGS = {
  India: `${h3('#FF9933', '#FFFFFF', '#138808')}<circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".7"/><circle cx="15" cy="10" r=".6" fill="#000080"/>`,
  USA: (() => {
    let s = '<rect width="30" height="20" fill="#fff"/>';
    for (let i = 0; i < 7; i++) s += `<rect y="${(i * 20) / 6.5}" width="30" height="${20 / 13}" fill="#B22234"/>`;
    s += '<rect width="13" height="10.8" fill="#3C3B6E"/>';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) s += `<circle cx="${1.6 + c * 2.5 + (r % 2) * 1.2}" cy="${1.5 + r * 2.5}" r=".5" fill="#fff"/>`;
    return s;
  })(),
  'United Kingdom': `<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.4"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#C8102E" stroke-width="3.4"/>`,
  Germany: h3('#000000', '#DD0000', '#FFCE00'),
  'West Germany': h3('#000000', '#DD0000', '#FFCE00'),
  USSR: `<rect width="30" height="20" fill="#CC0000"/>${star(5.5, 3.2, 1.2, 'none')}<path d="M4.4 2.2l1.1-.8 1.1.8-.4-1.3" fill="none" stroke="#FFD700" stroke-width=".5"/><path d="M3.4 7.6c1.2 1.3 3.3 1.3 4.4-.2M4 5.2l3.4 3.2" fill="none" stroke="#FFD700" stroke-width=".8"/>`,
  Russia: h3('#FFFFFF', '#0039A6', '#D52B1E'),
  China: `<rect width="30" height="20" fill="#DE2910"/>${star(5, 5, 3, '#FFDE00')}${star(10, 2, 1, '#FFDE00', 0.5)}${star(12, 4, 1, '#FFDE00', 0.9)}${star(12, 7, 1, '#FFDE00', 0)}${star(10, 9, 1, '#FFDE00', 0.5)}`,
  Israel: `<rect width="30" height="20" fill="#fff"/><rect y="2" width="30" height="3" fill="#0038B8"/><rect y="15" width="30" height="3" fill="#0038B8"/><path d="M15 6.3l3.2 5.5h-6.4zM15 13.7l-3.2-5.5h6.4z" fill="none" stroke="#0038B8" stroke-width=".9"/>`,
  Belgium: v3('#000000', '#FDDA24', '#EF3340'),
  Austria: h3('#ED2939', '#FFFFFF', '#ED2939'),
  France: v3('#002395', '#FFFFFF', '#ED2939'),
  Italy: v3('#009246', '#FFFFFF', '#CE2B37'),
  'Czech Republic': `<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#D7141A"/><path d="M0 0L15 10L0 20Z" fill="#11457E"/>`,
  Switzerland: `<rect width="30" height="20" fill="#D52B1E"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>`,
  Finland: nordic('#fff', '#002F6C'),
  Sweden: nordic('#006AA7', '#FECC00'),
  Japan: `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>`,
  'South Korea': `<rect width="30" height="20" fill="#fff"/><path d="M15 5a5 5 0 010 10a2.5 2.5 0 010-5a2.5 2.5 0 000-5z" fill="#0047A0"/><path d="M15 5a5 5 0 000 10a2.5 2.5 0 000-5a2.5 2.5 0 010-5z" fill="#CD2E3A" transform="rotate(180 15 10)"/><path d="M4 4l3 -2M5 5l3-2M6 6l3-2M21 14l3 2M22 13l3 2M23 12l3 2M4 16l3 2M5 15l3 2M21 6l3-2M22 7l3-2" stroke="#000" stroke-width=".8"/>`,
};

export const REGIONS = [
  { id: 'all', label: 'All origins' },
  { id: 'india', label: 'India', flag: 'India' },
  { id: 'usa', label: 'USA', flag: 'USA' },
  { id: 'russia', label: 'Russia / USSR', flag: 'Russia' },
  { id: 'china', label: 'China', flag: 'China' },
  { id: 'europe', label: 'Europe', flag: 'EU' },
  { id: 'israel', label: 'Israel', flag: 'Israel' },
  { id: 'asia', label: 'Japan & Korea', flag: 'Japan' },
];
const REGION_OF = {
  India: 'india', USA: 'usa', USSR: 'russia', Russia: 'russia', China: 'china', Israel: 'israel', Japan: 'asia', 'South Korea': 'asia',
  'United Kingdom': 'europe', Germany: 'europe', 'West Germany': 'europe', Belgium: 'europe', Austria: 'europe', France: 'europe', Italy: 'europe',
  'Czech Republic': 'europe', Switzerland: 'europe', Finland: 'europe', Sweden: 'europe',
};
FLAGS.EU = `<rect width="30" height="20" fill="#003399"/>${Array.from({ length: 12 }, (_, i) => star(15 + Math.cos((i / 12) * Math.PI * 2) * 6, 10 + Math.sin((i / 12) * Math.PI * 2) * 6, 1, '#FFCC00')).join('')}`;

export const countries = (s) => s.split(' / ').map((c) => (c === 'Russia / USSR' ? 'USSR' : c.trim()));
export const regionsOf = (country) => countries(country).map((c) => REGION_OF[c]).filter(Boolean);

/** One flag as inline SVG. */
export function flag(name, title = name) {
  const body = FLAGS[name] || FLAGS[name?.split(' ')[0]];
  if (!body) return '';
  return `<svg class="flag" viewBox="0 0 30 20" role="img" aria-label="${title}"><title>${title}</title>${body}<rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".6"/></svg>`;
}
/** Flags for "India / Russia" style strings. */
export const flags = (country) => countries(country).map((c) => flag(c)).join('');
