// Stage environments. Each scene sets the backdrop, the acoustics (audio env id),
// the ground spent cases land on, weather particles and how bright a flash looks.
// Backdrops are vector SVG (1600×900) so they stay crisp and weigh almost nothing.

const sky = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function stars(n, seed) {
  const r = rnd(seed); let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${(r() * 1600).toFixed(0)}" cy="${(r() * 480).toFixed(0)}" r="${(r() * 1.4 + 0.3).toFixed(2)}" fill="#fff" opacity="${(r() * 0.7 + 0.2).toFixed(2)}"/>`;
  return s;
}
function ridge(y, amp, step, seed, fill, extra = '') {
  const r = rnd(seed); let d = `M0 900 L0 ${y}`;
  for (let x = 0; x <= 1600; x += step) d += ` L${x} ${(y - r() * amp).toFixed(0)}`;
  return `<path d="${d} L1600 900 Z" fill="${fill}" ${extra}/>`;
}
function hills(y, amp, n, fill, phase = 0) {
  let d = `M0 900 L0 ${y}`;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 1600, cy = y - amp * (0.5 + 0.5 * Math.sin(i * 1.7 + phase));
    d += ` Q${x - 800 / n} ${cy - amp * 0.4} ${x} ${cy}`;
  }
  return `<path d="${d} L1600 900 Z" fill="${fill}"/>`;
}
function trees(y, n, h, seed, fill) {
  const r = rnd(seed); let s = '';
  for (let i = 0; i < n; i++) {
    const x = r() * 1600, hh = h * (0.6 + r() * 0.6), w = hh * 0.36;
    s += `<path d="M${x} ${y - hh} L${x + w} ${y} L${x - w} ${y} Z" fill="${fill}"/>`;
  }
  return s;
}
function perspGround(fill1, fill2, lines, vpY = 560) {
  let s = `<rect x="0" y="${vpY}" width="1600" height="${900 - vpY}" fill="url(#gnd)"/>`;
  s = `<defs>${sky('gnd', [[0, fill1], [1, fill2]])}</defs>` + s;
  if (lines) for (let i = -8; i <= 8; i++) s += `<path d="M800 ${vpY} L${800 + i * 260} 900" stroke="${lines}" stroke-width="2" opacity=".25"/>`;
  return s;
}

export const SCENES = {
  range: {
    label: 'Firing range', sub: 'Outdoor · concrete', env: 'range', weather: null, smoke: '#d4d8dc', dust: '#b5a88e', night: 0,
    svg: () => `<defs>${sky('s', [[0, '#5d7486'], [0.55, '#9fb0b8'], [1, '#c9c4b4']])}</defs>
      <rect width="1600" height="900" fill="url(#s)"/>
      ${hills(470, 50, 6, '#6f7a6a', 1)}${hills(520, 40, 5, '#5f6a52', 3)}
      <rect x="0" y="500" width="1600" height="70" fill="#7a6650"/>
      <path d="M0 500 Q800 470 1600 500 L1600 520 L0 520Z" fill="#8c7558"/>
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => { const x = 320 + i * 160; return `<rect x="${x - 2}" y="470" width="4" height="40" fill="#3a3326"/><path d="M${x - 14} 440 Q${x} 425 ${x + 14} 440 L${x + 16} 492 L${x - 16} 492 Z" fill="#e8e1cf"/><circle cx="${x}" cy="462" r="6" fill="none" stroke="#b33" stroke-width="2"/>`; }).join('')}
      ${perspGround('#8b8a83', '#5d5d58', '#f4f1e6', 560)}
      ${[-3, -2, -1, 1, 2, 3].map((i) => `<path d="M${800 + i * 130} 560 L${800 + i * 420} 900 L${800 + i * 440} 900 L${800 + i * 136} 560Z" fill="#4e4e49" opacity=".55"/>`).join('')}
      <rect x="0" y="800" width="1600" height="100" fill="#3b2f22"/><rect x="0" y="796" width="1600" height="10" fill="#5a4630"/>`,
  },
  desert: {
    label: 'Desert', sub: 'Thar / Middle East · sand', env: 'desert', weather: 'sand', smoke: '#e3d6bd', dust: '#d8b67e', night: 0,
    svg: () => `<defs>${sky('s', [[0, '#3f7fb5'], [0.5, '#9cc3d8'], [0.72, '#f1d7a6'], [1, '#e9b874']])}
      <radialGradient id="sun" cx=".78" cy=".22" r=".35"><stop offset="0" stop-color="#fff8e1" stop-opacity=".95"/><stop offset=".15" stop-color="#ffe3a3" stop-opacity=".5"/><stop offset="1" stop-color="#ffe3a3" stop-opacity="0"/></radialGradient></defs>
      <rect width="1600" height="900" fill="url(#s)"/><rect width="1600" height="900" fill="url(#sun)"/>
      <path d="M980 520 L1040 430 L1150 428 L1190 520Z M200 530 L240 470 L330 466 L360 530Z" fill="#c08a5a" opacity=".7"/>
      ${hills(540, 30, 4, '#e2b077', 0.4)}${hills(600, 60, 3, '#d9a061', 2)}${hills(680, 70, 3, '#c98c4f', 4.1)}
      <rect x="0" y="740" width="1600" height="160" fill="#c58748"/>
      ${Array.from({ length: 14 }, (_, i) => `<path d="M${i * 120 - 40} ${770 + (i % 3) * 30} q60 -12 120 0" stroke="#a96f37" stroke-width="3" fill="none" opacity=".5"/>`).join('')}`,
  },
  mountain: {
    label: 'Himalayan snow', sub: 'High altitude · snow', env: 'mountain', weather: 'snow', smoke: '#eef3f7', dust: '#ffffff', night: 0,
    svg: () => `<defs>${sky('s', [[0, '#5b7fa6'], [0.6, '#b9cfe0'], [1, '#e9f1f7']])}</defs>
      <rect width="1600" height="900" fill="url(#s)"/>
      ${ridge(330, 160, 80, 7, '#8ea4bb')}
      ${ridge(330, 160, 80, 7, '#f4f8fb', 'clip-path="inset(0 0 72% 0)"')}
      <path d="M0 520 L180 300 L260 360 L420 210 L560 380 L700 260 L820 400 L980 240 L1120 380 L1260 280 L1420 420 L1600 330 L1600 900 L0 900Z" fill="#6f87a0"/>
      <path d="M180 300 L230 340 L210 345 L260 360 L230 330Z M420 210 L470 270 L440 262 L500 300 L455 250Z M980 240 L1030 300 L1000 292 L1060 330 L1010 280Z M1260 280 L1300 320 L1280 322 L1330 350Z" fill="#f2f6fa"/>
      ${trees(640, 40, 110, 3, '#2f4a45')}
      <rect x="0" y="640" width="1600" height="260" fill="#eef3f8"/>
      <path d="M0 700 Q400 660 800 700 T1600 690 L1600 900 L0 900Z" fill="#dfe8f1"/>
      <path d="M0 800 Q500 770 1000 810 T1600 800 L1600 900 L0 900Z" fill="#cdd9e6"/>`,
  },
  jungle: {
    label: 'Jungle', sub: 'Dense forest · mud', env: 'jungle', weather: 'rain', smoke: '#cfdad2', dust: '#6b5638', night: 0,
    svg: () => {
      const r = rnd(11); let leaves = '';
      for (let i = 0; i < 60; i++) leaves += `<ellipse cx="${(r() * 1600).toFixed(0)}" cy="${(r() * 520).toFixed(0)}" rx="${(60 + r() * 120).toFixed(0)}" ry="${(30 + r() * 60).toFixed(0)}" fill="${['#1d3a24', '#264a2c', '#173020', '#2f5733'][i % 4]}" opacity=".9"/>`;
      return `<defs>${sky('s', [[0, '#2a4a34'], [0.6, '#5d7f5a'], [1, '#3c4a30']])}
        <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ffd8" stop-opacity=".22"/><stop offset="1" stop-color="#f6ffd8" stop-opacity="0"/></linearGradient></defs>
        <rect width="1600" height="900" fill="url(#s)"/>
        ${[180, 420, 760, 1080, 1380].map((x, i) => `<rect x="${x}" y="0" width="${30 + i * 6}" height="700" fill="#2b2418" opacity=".85"/>`).join('')}
        ${leaves}
        <path d="M500 0 L640 0 L980 760 L700 760Z M1100 0 L1180 0 L1360 760 L1200 760Z" fill="url(#ray)"/>
        ${trees(700, 30, 140, 5, '#152a19')}
        <rect x="0" y="690" width="1600" height="210" fill="#3d3221"/>
        <path d="M0 720 Q300 700 700 730 T1600 715 L1600 900 L0 900Z" fill="#4a3c27"/>
        ${Array.from({ length: 40 }, (_, i) => `<ellipse cx="${(i * 41) % 1600}" cy="${760 + (i * 37) % 130}" rx="9" ry="4" fill="${i % 2 ? '#6b5a2a' : '#3f5a25'}" opacity=".8"/>`).join('')}`;
    },
  },
  urban: {
    label: 'Urban street', sub: 'City · asphalt', env: 'urban', weather: null, smoke: '#c9ccd2', dust: '#9a948a', night: 0.3,
    svg: () => {
      const r = rnd(23); let b = '', win = '';
      for (let x = 0; x < 1600;) {
        const w = 90 + r() * 140, h = 220 + r() * 300, y = 640 - h; b += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${r() > 0.5 ? '#2a2f3a' : '#323845'}"/>`;
        for (let wy = y + 20; wy < 620; wy += 34) for (let wx = x + 14; wx < x + w - 20; wx += 28) if (r() > 0.55) win += `<rect x="${wx}" y="${wy}" width="14" height="18" fill="${r() > 0.3 ? '#f7d58a' : '#9fd3ff'}" opacity="${(0.4 + r() * 0.5).toFixed(2)}"/>`;
        x += w + 6;
      }
      return `<defs>${sky('s', [[0, '#1f2a44'], [0.5, '#7a5a6e'], [0.8, '#e09a6a'], [1, '#2a2a2e']])}</defs>
        <rect width="1600" height="900" fill="url(#s)"/>${b}${win}
        <rect x="1240" y="380" width="8" height="300" fill="#15181d"/><path d="M1244 380 q30 -20 60 0" stroke="#15181d" stroke-width="8" fill="none"/><circle cx="1304" cy="386" r="40" fill="#ffd98a" opacity=".18"/>
        <rect x="0" y="640" width="1600" height="40" fill="#5a5c60"/>
        ${perspGround('#3a3c40', '#232427', null, 680)}
        ${[-1, 1].map((i) => `<path d="M${800 + i * 4} 680 L${800 + i * 30} 900" stroke="#e8e2c8" stroke-width="6" stroke-dasharray="40 50" opacity=".6"/>`).join('')}`;
    },
  },
  night: {
    label: 'Night ops', sub: 'Open field · grass', env: 'night', weather: 'fireflies', smoke: '#8d96a3', dust: '#5a5a4a', night: 1,
    svg: () => `<defs>${sky('s', [[0, '#04060d'], [0.6, '#0e1730'], [1, '#18223a']])}
      <radialGradient id="moon" cx=".2" cy=".18" r=".2"><stop offset="0" stop-color="#e9efff" stop-opacity=".35"/><stop offset="1" stop-color="#e9efff" stop-opacity="0"/></radialGradient></defs>
      <rect width="1600" height="900" fill="url(#s)"/>${stars(160, 9)}<rect width="1600" height="900" fill="url(#moon)"/>
      <circle cx="320" cy="160" r="34" fill="#eef2ff"/><circle cx="332" cy="152" r="30" fill="#0e1730" opacity=".25"/>
      ${trees(600, 70, 120, 13, '#060a10')}
      <rect x="0" y="590" width="1600" height="310" fill="#0b120d"/>
      <path d="M0 640 Q400 610 800 650 T1600 630 L1600 900 L0 900Z" fill="#101a12"/>`,
  },
  indoor: {
    label: 'Indoor range', sub: 'Lanes · concrete', env: 'indoor', weather: 'motes', smoke: '#d6d6d0', dust: '#a0a090', night: 0.15,
    svg: () => `<defs>${sky('s', [[0, '#1b1d20'], [1, '#2c2f33']])}
      <linearGradient id="lamp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4" stop-opacity=".25"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#s)"/>
      ${Array.from({ length: 12 }, (_, i) => Array.from({ length: 5 }, (_, j) => `<rect x="${380 + i * 70}" y="${300 + j * 55}" width="64" height="50" fill="#26292d" stroke="#1a1c1f"/>`).join('')).join('')}
      <rect x="370" y="290" width="860" height="290" fill="none" stroke="#111" stroke-width="10"/>
      ${[540, 800, 1060].map((x) => `<path d="M${x - 30} 0 L${x + 30} 0 L${x + 160} 600 L${x - 160} 600Z" fill="url(#lamp)"/><rect x="${x - 40}" y="40" width="80" height="10" fill="#ddd" opacity=".6"/>`).join('')}
      ${[600, 800, 1000].map((x) => `<path d="M${x - 22} 360 L${x + 22} 360 L${x + 24} 450 L${x - 24} 450Z" fill="#e7e2d0"/><circle cx="${x}" cy="395" r="10" fill="none" stroke="#c22" stroke-width="3"/><rect x="${x - 1}" y="60" width="2" height="300" fill="#333"/>`).join('')}
      <path d="M0 0 L370 290 L370 580 L0 900Z" fill="#202327"/><path d="M1600 0 L1230 290 L1230 580 L1600 900Z" fill="#202327"/>
      ${perspGround('#55565a', '#2e2f32', '#c8c8c0', 580)}
      <rect x="0" y="780" width="1600" height="120" fill="#3a3d42"/><rect x="0" y="776" width="1600" height="8" fill="#5b6067"/>`,
  },
};

export const SCENE_ORDER = ['range', 'desert', 'mountain', 'jungle', 'urban', 'night', 'indoor'];
export const SCENE_ENV_KEY = { range: null, desert: 'desert', mountain: 'snow', jungle: 'jungle', urban: null, night: null, indoor: null };

let seq = 0;
export function sceneSvg(id) {
  const s = SCENES[id] || SCENES.range, pre = `sc${++seq}-`;
  // ids must be unique per document (several scenes can be on screen in the picker)
  const body = s.svg().replace(/id="([^"]+)"/g, `id="${pre}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${pre}$1)`);
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}
