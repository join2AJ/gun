// Procedural SVG weapon renderer.
// Every weapon is described by an `art` spec in data.js and assembled from
// parts (stock, receiver, grip, magazine, handguard, barrel, optic...).
// Coordinates: bore axis is y = 0, muzzle points right, up is negative.

const MATS = {
  blued:    ['#5a6067', '#2d3237', '#121518'],
  park:     ['#61645a', '#383a33', '#1b1c18'],
  poly:     ['#45484c', '#26282b', '#0f1011'],
  gunmetal: ['#a3a8ae', '#666b71', '#34383c'],
  steel:    ['#d5dade', '#959ba1', '#555a5f'],
  wood:     ['#b57a45', '#82502a', '#4a2a12'],
  woodred:  ['#c06a35', '#8a411b', '#4f200b'],
  wooddark: ['#8a5833', '#5a361b', '#2d1a0b'],
  olive:    ['#7a8258', '#525839', '#2c2f1e'],
  tan:      ['#d1ba92', '#a38c63', '#6b5b3d'],
  fde:      ['#b8a37a', '#857250', '#544731'],
  brass:    ['#ffe08a', '#d19c33', '#7a5414'],
  clear:    ['rgba(150,160,150,.55)', 'rgba(80,90,80,.55)', 'rgba(30,35,30,.7)'],
  dark:     ['#2a2c2f', '#17181a', '#08090a'],
  rubber:   ['#2b2b2b', '#1a1a1a', '#0a0a0a'],
};
const WOODS = new Set(['wood', 'woodred', 'wooddark']);

let uidSeq = 0;

class Builder {
  constructor(uid, k = 1) {
    this.uid = uid;
    this.k = k;
    this.out = [];
    this.used = new Set();
    this.x0 = Infinity; this.x1 = -Infinity; this.y0 = Infinity; this.y1 = -Infinity;
  }
  ext(x, y) {
    if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
  }
  extD(d) {
    const n = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    for (let i = 0; i + 1 < n.length; i += 2) this.ext(+n[i], +n[i + 1]);
  }
  // scale every y value of an absolute-coordinate path (M/L/Q/C/Z only)
  sd(d) {
    let i = 0;
    return d.replace(/-?\d*\.?\d+(?:e-?\d+)?/g, (n) => (i++ % 2 ? +(+n * this.k).toFixed(2) : n));
  }
  sp(d, color, width, extra = '') {
    d = this.sd(d); this.extD(d);
    this.out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`);
  }
  fill(m) { this.used.add(m); return `url(#${this.uid}-${m})`; }
  stroke(m) { return (MATS[m] || MATS.dark)[2]; }
  path(d, m, extra = '') {
    d = this.sd(d);
    this.extD(d);
    this.out.push(`<path d="${d}" fill="${this.fill(m)}" stroke="${this.stroke(m)}" stroke-width="1.4" stroke-linejoin="round" ${extra}/>`);
    if (WOODS.has(m)) this.out.push(`<path d="${d}" fill="url(#${this.uid}-grain)" opacity=".5" pointer-events="none"/>`), this.used.add('grain');
  }
  rect(x, y, w, h, m, r = 0, extra = '') {
    y *= this.k; h *= this.k;
    this.ext(x, y); this.ext(x + w, y + h);
    this.out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${this.fill(m)}" stroke="${this.stroke(m)}" stroke-width="1.4" ${extra}/>`);
    if (WOODS.has(m)) this.out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${this.uid}-grain)" opacity=".5"/>`), this.used.add('grain');
  }
  circle(cx, cy, r, m, extra = '') {
    cy *= this.k; r *= this.k;
    this.ext(cx - r, cy - r); this.ext(cx + r, cy + r);
    this.out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${this.fill(m)}" stroke="${this.stroke(m)}" stroke-width="1.4" ${extra}/>`);
  }
  line(x1, y1, x2, y2, color = 'rgba(0,0,0,.55)', w = 1.2) {
    y1 *= this.k; y2 *= this.k;
    this.out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`);
  }
  raw(s) { this.out.push(s); }
  hole(cx, cy, rx, ry) { this.out.push(`<ellipse cx="${cx}" cy="${cy * this.k}" rx="${rx}" ry="${ry * this.k}" fill="#06080a" opacity=".92"/>`); }
  defs(fc = ['#ffffff', '#fff6c8', '#ffb43a', '#ff5a00']) {
    let s = '';
    for (const m of this.used) {
      if (m === 'grain') continue;
      const c = MATS[m] || MATS.dark;
      s += `<linearGradient id="${this.uid}-${m}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c[0]}"/><stop offset=".22" stop-color="${c[1]}"/>
        <stop offset=".7" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>`;
    }
    if (this.used.has('grain')) {
      s += `<pattern id="${this.uid}-grain" width="90" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-3)">
        <path d="M0 3 Q22 1 45 4 T90 3 M0 9 Q30 11 60 8 T90 10" fill="none" stroke="#2a1505" stroke-width=".8" opacity=".55"/></pattern>`;
    }
    s += `<radialGradient id="${this.uid}-flash" cx="0" cy=".5" r="1">
        <stop offset="0" stop-color="${fc[0]}" stop-opacity="1"/><stop offset=".22" stop-color="${fc[1]}"/>
        <stop offset=".5" stop-color="${fc[2]}" stop-opacity=".85"/><stop offset="1" stop-color="${fc[2]}" stop-opacity="0"/></radialGradient>`;
    return `<defs>${s}</defs>`;
  }
}

// ---------- part painters ----------

function rail(b, x0, x1, y, m = 'blued') {
  b.rect(x0, y - 6, x1 - x0, 6, m, 1);
  for (let x = x0 + 4; x < x1 - 4; x += 9) b.rect(x, y - 9, 5, 3.5, m, 0.5);
}

function drawStock(b, s, rec) {
  const m = s.mat;
  const x0 = s.x0, x1 = s.x1 ?? rec.x0;
  switch (s.style) {
    case 'fixed': {
      const t = s.top, bo = s.bot;
      b.path(`M${x0} ${t} L${x1} ${rec.top + (s.joinT ?? 6)} L${x1} ${rec.bot - 2} L${x0 + 30} ${bo - 4} Q${x0 + 8} ${bo + 1} ${x0} ${bo} Z`, m);
      b.rect(x0 - 8, t - 1, 9, bo - t + 1, 'rubber', 3);
      if (s.cheek) b.path(`M${x0 + 25} ${t} L${x0 + 140} ${t + 3} L${x0 + 140} ${t - 10} L${x0 + 30} ${t - 14} Z`, m);
      break;
    }
    case 'ak': {
      const t = s.top, bo = s.bot;
      b.path(`M${x0} ${t} L${x1} ${rec.top + 12} L${x1} ${rec.bot} L${x1 - 20} ${rec.bot + 4} L${x0 + 20} ${bo - 2} Q${x0 + 5} ${bo + 2} ${x0} ${bo} Z`, m);
      b.rect(x0 - 6, t - 1, 7, bo - t + 1, 'blued', 2);
      break;
    }
    case 'classic': {
      // full-length wooden rifle stock incl. forend running under barrel
      const t = s.top, bo = s.bot, w = s.wrist, fx = s.fore, g = s.guard;
      const grip = s.semiGrip
        ? `L${g - 30} 26 Q${w + 15} 30 ${w + 2} 52 L${w - 10} 56 Q${w - 30} 40 ${w - 70} 46`
        : `L${g - 30} 24 Q${w + 10} 24 ${w - 30} 36`;
      b.path(`M${x0} ${t} Q${w - 60} ${t + 10} ${w} 6 L${rec.x0} 4 L${fx} 2 Q${fx + 7} 2 ${fx + 6} 8 L${fx - 2} 12 L${g + 120} 14 L${g + 70} 22 L${g + 30} 22 L${g - 10} 24 ${grip} L${x0 + 14} ${bo} L${x0} ${bo - 4} Z`, m);
      b.rect(x0 - 6, t - 1, 7, bo - t - 2, 'blued', 2);
      if (s.upper) b.path(`M${s.upper[0]} -5 L${s.upper[1]} -5 Q${s.upper[1] + 6} -2 ${s.upper[1]} 2 L${s.upper[0]} 2 Z`, m);
      (s.bands || []).forEach((x) => b.rect(x, -8, 9, 22, 'blued', 1.5));
      break;
    }
    case 'skeleton': {
      // Barrett-style: butt pad + top + lower monopod spine
      const t = s.top, bo = s.bot;
      b.path(`M${x0} ${t} L${x1} ${t + 2} L${x1} ${rec.bot} L${x1 - 30} ${rec.bot} L${x0 + 70} ${bo - 14} L${x0 + 70} ${bo} L${x0} ${bo} Z`, m);
      b.path(`M${x0 + 34} ${t + 14} L${x1 - 26} ${t + 16} L${x1 - 26} ${rec.bot - 8} L${x0 + 70} ${bo - 30} L${x0 + 34} ${bo - 30} Z`, 'dark');
      b.rect(x0 - 12, t - 4, 14, bo - t + 8, 'rubber', 4);
      if (s.cheek) b.rect(x0 + 30, t - 12, 90, 12, m, 3);
      break;
    }
    case 'wire': {
      // folding wire / tube stock (MP40, PPS, Uzi)
      const t = s.top, bo = s.bot;
      b.rect(x0, t, x1 - x0, 7, m, 3);
      b.path(`M${x0 + 4} ${t + 4} L${x1} ${bo - 18} L${x1} ${bo - 10} L${x0 + 8} ${t + 12} Z`, m);
      b.rect(x0 - 6, t - 4, 12, bo - t, m, 3);
      break;
    }
    case 'tube': {
      // M4 buffer tube + collapsible stock
      b.rect(x1 - 150, -12, 150, 20, 'blued', 3);
      b.path(`M${x0} ${s.top} L${x0 + 110} ${s.top + 2} L${x0 + 110} -12 L${x0 + 125} -12 L${x0 + 125} 10 L${x0 + 90} 14 L${x0 + 15} ${s.bot} L${x0} ${s.bot} Z`, m);
      b.rect(x0 - 6, s.top - 1, 8, s.bot - s.top + 1, 'rubber', 2);
      break;
    }
    case 'thumbhole': {
      const t = s.top, bo = s.bot;
      b.path(`M${x0} ${t} L${x1} ${rec.top + 8} L${x1} ${rec.bot} L${x0 + 150} ${bo - 6} L${x0 + 18} ${bo} L${x0} ${bo - 2} Z`, m);
      b.path(`M${x0 + 75} ${t + 22} L${x1 - 60} ${rec.top + 26} Q${x1 - 50} ${rec.bot + 10} ${x1 - 70} ${rec.bot + 18} L${x0 + 95} ${bo - 24} Q${x0 + 70} ${bo - 26} ${x0 + 75} ${t + 22} Z`, 'dark');
      b.rect(x0 - 7, t - 1, 8, bo - t, 'rubber', 2);
      if (s.cheek) b.path(`M${x0 + 20} ${t} L${x0 + 110} ${t + 2} L${x0 + 110} ${t - 9} Q${x0 + 60} ${t - 16} ${x0 + 20} ${t - 10} Z`, 'dark');
      break;
    }
    case 'mg': {
      // MG42 / M60 style butt
      const t = s.top, bo = s.bot;
      b.path(`M${x0} ${t} L${x1} ${rec.top + 6} L${x1} ${rec.bot} L${x0 + 40} ${bo} L${x0} ${bo + 2} Z`, m);
      b.rect(x0 - 8, t - 2, 9, bo - t + 6, 'blued', 3);
      break;
    }
    case 'thompson': {
      const t = s.top, bo = s.bot;
      b.path(`M${x0} ${t} Q${x1 - 90} ${t + 4} ${x1} ${rec.top + 18} L${x1} ${rec.bot} Q${x1 - 30} ${rec.bot + 6} ${x0 + 120} ${bo - 18} Q${x0 + 40} ${bo} ${x0} ${bo} Z`, m);
      b.rect(x0 - 6, t - 1, 7, bo - t + 1, 'blued', 2);
      break;
    }
  }
}

function drawGrip(b, g, rec) {
  if (!g || g.style === 'none') return;
  const top = rec.bot - 2, x = g.x, w = g.w ?? 30, L = (g.len ?? 78) * (b.k > 1 ? 0.82 : 1), a = (g.ang ?? 18) * Math.PI / 180;
  const dx = Math.tan(a) * L;
  b.path(`M${x} ${top} L${x - w} ${top} L${x - w - dx} ${top + L - 4} Q${x - w - dx} ${top + L + 3} ${x - w - dx + 8} ${top + L + 3} L${x - dx} ${top + L} Q${x - dx + 4} ${top + L - 3} ${x - dx + 2} ${top + L - 8} Z`, g.mat ?? 'poly');
  for (let i = 1; i < 6; i++) {
    const y = top + i * (L / 6.5);
    const xo = Math.tan(a) * (y - top);
    b.line(x - w - xo + 6, y, x - xo - 4, y, 'rgba(0,0,0,.25)', 1);
  }
}

function drawGuard(b, t, rec) {
  if (!t) return;
  const y = (t.y ?? rec.bot) - 1, x = t.x, w = t.w ?? 60, d = t.d ?? 26;
  b.sp(`M${x} ${y} Q${x - 4} ${y + d} ${x - 20} ${y + d} L${x - w + 6} ${y + d} Q${x - w} ${y + d} ${x - w} ${y + d - 6}`, MATS[t.mat ?? 'blued'][2], 5 * Math.min(b.k, 1.3));
  // trigger blade
  b.sp(`M${x - w * 0.5} ${y} Q${x - w * 0.42} ${y + d * 0.55} ${x - w * 0.62} ${y + d * 0.8}`, '#111', 4 * Math.min(b.k, 1.3));
}

function drawMag(b, m, rec) {
  if (!m) return;
  const top = m.y ?? (rec.bot - 4);
  const x = m.x, w = m.w ?? 40, mat = m.mat ?? 'blued';
  const L = (m.len ?? 100) * (b.k > 1 && m.style !== 'tube' && m.style !== 'belt' ? 0.74 : 1);
  const a = (m.ang ?? 0) * Math.PI / 180, dx = Math.tan(a) * L;
  switch (m.style) {
    case 'box': {
      b.path(`M${x} ${top} L${x + w} ${top} L${x + w + dx} ${top + L} L${x + dx} ${top + L} Z`, mat);
      b.rect(x + dx - 3, top + L - 2, w + 6, 8, mat, 2);
      for (let i = 1; i < 4; i++) b.line(x + dx * (i / 4) + 6, top + (L * i) / 4, x + w + dx * (i / 4) - 6, top + (L * i) / 4, 'rgba(255,255,255,.08)', 2);
      break;
    }
    case 'curved': {
      const c = m.curve ?? 40;
      b.path(`M${x} ${top} L${x + w} ${top} Q${x + w + c * 0.25} ${top + L * 0.6} ${x + w + c} ${top + L} L${x + c - 4} ${top + L + 6} Q${x + c * 0.15} ${top + L * 0.6} ${x} ${top} Z`, mat);
      for (let i = 1; i < 5; i++) {
        const tt = i / 5, xx = x + c * tt * tt * 0.9;
        b.line(xx + 4, top + L * tt, xx + w - 2, top + L * tt - 2, 'rgba(255,255,255,.09)', 2);
      }
      break;
    }
    case 'drum': {
      const r = (m.r ?? 55) * (b.k > 1 ? 0.78 : 1);
      b.rect(x, top, w, 22, mat, 2);
      b.circle(x + w / 2, top + 18 + r, r, mat);
      b.circle(x + w / 2, top + 18 + r, r * 0.72, mat, 'opacity=".9"');
      b.circle(x + w / 2, top + 18 + r, r * 0.15, 'blued');
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * Math.PI * 2;
        b.line(x + w / 2 + Math.cos(an) * r * 0.78, top + 18 + r + Math.sin(an) * r * 0.78, x + w / 2 + Math.cos(an) * r * 0.92, top + 18 + r + Math.sin(an) * r * 0.92, 'rgba(0,0,0,.45)', 2);
      }
      break;
    }
    case 'internal': {
      b.path(`M${x} ${top} L${x + w} ${top} Q${x + w + 2} ${top + 12} ${x + w - 6} ${top + 14} L${x + 6} ${top + 14} Q${x - 2} ${top + 12} ${x} ${top} Z`, mat);
      break;
    }
    case 'belt': {
      // belt of cartridges hanging from the left side of the feed tray
      const n = m.n ?? 9;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const cx = x - t * (m.sweep ?? 60) + Math.sin(t * 2.4) * 10;
        const cy = top + t * L;
        b.raw(`<g transform="translate(${cx} ${cy * b.k}) rotate(${-8 - t * 25}) scale(${b.k})">
          <rect x="-4" y="-5" width="30" height="10" rx="4" fill="url(#${b.fill('brass').slice(5, -1)})" stroke="#6b4a10" stroke-width="1"/>
          <path d="M26 -4 L36 0 L26 4 Z" fill="#b87333"/><rect x="2" y="-6" width="10" height="12" fill="#2a2c2e" opacity=".85"/></g>`);
        b.ext(cx - 10, (cy - 10) * b.k); b.ext(cx + 40, (cy + 10) * b.k);
      }
      break;
    }
    case 'tube': {
      b.rect(x, top, L, w, mat, w / 2);
      break;
    }
    case 'top': { // Bren: curved magazine standing up out of the receiver
      const c = m.curve ?? 40, y = rec.top + 4;
      b.path(`M${x} ${y} L${x + w} ${y} Q${x + w + c * 0.3} ${y - L * 0.6} ${x + w + c} ${y - L} L${x + c - 6} ${y - L - 4} Q${x + c * 0.2} ${y - L * 0.6} ${x} ${y} Z`, mat);
      for (let i = 1; i < 4; i++) { const t = i / 4, xx = x + c * t * t; b.line(xx + 4, y - L * t, xx + w - 2, y - L * t, 'rgba(255,255,255,.1)', 2); }
      break;
    }
    case 'p90': { // P90: translucent magazine lying along the top
      const y = rec.top;
      b.path(`M${x} ${y} L${x + 10} ${y - 26} L${x + w - 10} ${y - 26} L${x + w} ${y} Z`, 'clear');
      for (let xx = x + 22; xx < x + w - 20; xx += 15) b.rect(xx, y - 20, 9, 14, 'brass', 2, 'opacity=".55"');
      break;
    }
    case 'gripmag': {
      b.rect(x, top, w, 10, mat, 2);
      break;
    }
  }
}

function drawFore(b, f, rec) {
  if (!f) return;
  const { x0, x1 } = f, t = f.top ?? -14, bo = f.bot ?? 14, m = f.mat ?? 'poly';
  switch (f.style) {
    case 'ribbed': {
      b.path(`M${x0} ${t - 2} L${x1} ${t + 2} L${x1} ${bo - 2} L${x0} ${bo + 2} Z`, m);
      for (let x = x0 + 12; x < x1 - 8; x += 13) b.line(x, t + 2, x, bo - 2, 'rgba(0,0,0,.45)', 3);
      b.rect(x0 - 4, t - 4, 8, bo - t + 8, 'blued', 2);
      break;
    }
    case 'rail': {
      b.rect(x0, t, x1 - x0, bo - t, m, 3);
      rail(b, x0, x1, t, m);
      for (let x = x0 + 14; x < x1 - 12; x += 26) b.rect(x, t + 7, 14, bo - t - 14, 'dark', 3);
      break;
    }
    case 'mlok': {
      b.rect(x0, t, x1 - x0, bo - t, m, 4);
      rail(b, x0, x1, t, m);
      for (let x = x0 + 14; x < x1 - 20; x += 30) b.rect(x, t + 9, 20, 7, 'dark', 3);
      break;
    }
    case 'jacket': {
      // perforated barrel jacket (MG42, PPSh, Thompson-cooling)
      b.rect(x0, t, x1 - x0, bo - t, m, 3);
      const holeW = f.hole ?? 18;
      for (let x = x0 + 10; x < x1 - holeW; x += holeW + 9) b.rect(x, t + 5, holeW, bo - t - 10, 'dark', (bo - t - 10) / 2);
      break;
    }
    case 'wood': {
      b.path(`M${x0} ${t} L${x1 - 8} ${t + 2} Q${x1} ${t + 3} ${x1} ${t + 10} L${x1} ${bo - 6} Q${x1} ${bo} ${x1 - 10} ${bo} L${x0} ${bo} Z`, m);
      break;
    }
    case 'ak': {
      b.path(`M${x0} ${t} L${x1 - 10} ${t} Q${x1} ${t} ${x1} ${t + 8} L${x1 - 4} ${bo - 4} Q${x1 - 8} ${bo + 2} ${x1 - 18} ${bo + 2} L${x0 + 6} ${bo + 6} Z`, m);
      b.path(`M${x0 + 4} ${f.ut ?? -26} L${f.ux ?? x1 - 20} ${f.ut ?? -26} Q${(f.ux ?? x1 - 20) + 8} ${(f.ut ?? -26) + 2} ${(f.ux ?? x1 - 20) + 6} -8 L${x0 + 4} -8 Z`, m);
      b.rect(x0 - 4, t - 4, 10, bo - t + 6, 'blued', 2);
      b.rect(x1 - 2, t + 2, 8, bo - t - 4, 'blued', 2);
      break;
    }
    case 'pump': {
      b.rect(x0, t, x1 - x0, bo - t, m, 6);
      for (let x = x0 + 10; x < x1 - 6; x += 9) b.line(x, t + 3, x, bo - 3, 'rgba(0,0,0,.4)', 3);
      break;
    }
    case 'plain': {
      b.rect(x0, t, x1 - x0, bo - t, m, f.r ?? 3);
      break;
    }
  }
}

function drawMuzzle(b, mz, x, r) {
  if (!mz || mz.style === 'none') return x;
  const L = mz.len ?? 30, R = mz.r ?? r + 3, m = mz.mat ?? 'blued';
  switch (mz.style) {
    case 'flash': // birdcage
      b.rect(x, -R, L, R * 2, m, 2);
      for (let i = 1; i < 4; i++) b.rect(x + (L / 4) * i - 2, -R + 2, 4, R * 2 - 4, 'dark', 1);
      break;
    case 'ak':
      b.path(`M${x} ${-R} L${x + L} ${-R + 2} L${x + L} ${R} L${x} ${R} Z`, m);
      break;
    case 'brake': // big Barrett-style arrowhead brake
      b.path(`M${x} ${-R} L${x + L * 0.2} ${-R - 8} L${x + L} ${-R - 8} L${x + L + 8} 0 L${x + L} ${R + 8} L${x + L * 0.2} ${R + 8} L${x} ${R} Z`, m);
      b.rect(x + L * 0.3, -R - 4, L * 0.22, R * 2 + 8, 'dark', 2);
      b.rect(x + L * 0.65, -R - 4, L * 0.22, R * 2 + 8, 'dark', 2);
      return x + L + 8;
    case 'comp':
      b.rect(x, -R, L, R * 2, m, 3);
      for (let i = 0; i < 3; i++) b.rect(x + 6 + i * (L / 3.4), -R, 4, R - 1, 'dark', 1);
      break;
    case 'cone': // MG42 recoil booster
      b.path(`M${x} ${-R} L${x + L * 0.6} ${-R} L${x + L} ${-R * 0.6} L${x + L} ${R * 0.6} L${x + L * 0.6} ${R} L${x} ${R} Z`, m);
      break;
    case 'cutts': // Thompson compensator
      b.rect(x, -R, L, R * 2, m, 2);
      for (let i = 0; i < 4; i++) b.rect(x + 6 + i * 7, -R - 1, 3, R, 'dark', 1);
      break;
    case 'bayonetlug':
      b.rect(x, -r - 1, L, r * 2 + 2, m, 1);
      break;
  }
  return x + L;
}

function drawOptic(b, o) {
  if (!o) return;
  const m = o.mat ?? 'dark';
  switch (o.style) {
    case 'scope': {
      const { x0, x1 } = o, y = o.y ?? -50, r = o.r ?? 10, eb = o.eb ?? 18, ob = o.ob ?? 20;
      b.path(`M${x0} ${y - eb} L${x0 + 45} ${y - eb} L${x0 + 70} ${y - r} L${x1 - 85} ${y - r} L${x1 - 55} ${y - ob} L${x1} ${y - ob} L${x1} ${y + ob} L${x1 - 55} ${y + ob} L${x1 - 85} ${y + r} L${x0 + 70} ${y + r} L${x0 + 45} ${y + eb} L${x0} ${y + eb} Z`, m);
      const tx = (x0 + x1) / 2 - 20;
      b.rect(tx, y - r - 12, 30, 12, m, 3); // elevation turret
      b.circle(tx + 15, y + 2, r * 0.9, m);
      b.rect(x1 - 6, y - ob + 2, 6, ob * 2 - 4, 'blued', 1);
      b.raw(`<rect x="${x1 - 4}" y="${(y - ob + 4) * b.k}" width="3" height="${(ob * 2 - 8) * b.k}" fill="#3aa0ff" opacity=".35"/>`);
      (o.rings ?? [x0 + 90, x1 - 110]).forEach((rx) => {
        b.rect(rx, y - r - 3, 18, r * 2 + 6, 'blued', 2);
        b.rect(rx - 4, y + r, 26, (o.base ?? -20) - (y + r), 'blued', 2);
      });
      break;
    }
    case 'carry': { // M16 carry handle
      const { x0, x1 } = o, y = o.y ?? -24;
      b.path(`M${x0} ${y} L${x0 + 8} ${y - 34} L${x1 - 10} ${y - 34} L${x1} ${y} L${x1 - 18} ${y} L${x1 - 22} ${y - 22} L${x0 + 32} ${y - 22} L${x0 + 26} ${y} Z`, 'blued');
      b.rect(x0 + 2, y - 46, 16, 14, 'blued', 2);
      break;
    }
    case 'reddot': {
      const { x0 } = o, y = o.y ?? -30;
      b.rect(x0, y - 8, 70, 8, 'blued', 2);
      b.rect(x0 + 8, y - 44, 56, 36, m, 10);
      b.raw(`<circle cx="${x0 + 64}" cy="${(y - 26) * b.k}" r="${10 * b.k}" fill="#7a1f1f" opacity=".75"/><circle cx="${x0 + 64}" cy="${(y - 26) * b.k}" r="${2.4 * b.k}" fill="#ff3b3b"/>`);
      b.rect(x0 + 24, y - 52, 22, 10, m, 3);
      break;
    }
    case 'pso': { // SVD PSO-1 with side mount and rubber eyecup
      const { x0, x1 } = o, y = o.y ?? -46;
      b.rect(x0 - 26, y - 12, 32, 24, 'rubber', 6);
      b.path(`M${x0} ${y - 10} L${x1 - 40} ${y - 10} L${x1 - 20} ${y - 15} L${x1} ${y - 15} L${x1} ${y + 15} L${x1 - 20} ${y + 15} L${x1 - 40} ${y + 10} L${x0} ${y + 10} Z`, m);
      b.rect((x0 + x1) / 2 - 30, y - 26, 24, 16, m, 3);
      b.rect((x0 + x1) / 2 + 2, y - 26, 20, 16, m, 3);
      b.rect(x0 + 20, y + 10, x1 - x0 - 60, (o.base ?? -18) - y - 10, 'blued', 2);
      break;
    }
    case 'f2000': {
      const { x0, x1 } = o;
      b.path(`M${x0} -32 Q${x0 + 10} -58 ${x0 + 50} -60 L${x1 - 30} -60 Q${x1} -58 ${x1} -32 Z`, 'poly');
      b.rect(x1 - 70, -52, 60, 14, 'dark', 6);
      break;
    }
    case 'aug': { // integral 1.5x optic / carry handle
      const { x0, x1 } = o, y = o.y ?? -26;
      b.path(`M${x0} ${y} L${x0 + 18} ${y - 22} L${x1 - 18} ${y - 22} L${x1} ${y} L${x1 - 26} ${y} L${x1 - 32} ${y - 10} L${x0 + 32} ${y - 10} L${x0 + 26} ${y} Z`, o.mat ?? 'olive');
      b.path(`M${x0 + 10} ${y - 22} L${x0 + 30} ${y - 40} L${x1 - 30} ${y - 40} L${x1 - 14} ${y - 22} Z`, 'dark');
      break;
    }
  }
}

function drawBipod(b, bp) {
  if (!bp) return;
  const x = bp.x, L = bp.len ?? 120, y = bp.y ?? 8;
  const leg = (dx, op) => {
    b.sp(`M${x} ${y} L${x + dx} ${y + L}`, '#1b1d20', 10, `opacity="${op}"`);
    b.sp(`M${x} ${y} L${x + dx} ${y + L}`, '#4b5056', 5, `opacity="${op}"`);
    b.rect(x + dx - 10, y + L - 2, 20, 6, 'rubber', 3, `opacity="${op}"`);
  };
  leg(-(bp.splay ?? 16), 0.65);
  leg(bp.splay ?? 16, 1);
  b.rect(x - 9, y - 6, 18, 14, 'blued', 3);

}

function drawLong(b, a) {
  const rec = a.rec;
  drawBipod(b, a.bipod && a.bipod.behind !== false ? a.bipod : null);
  if (a.mag && a.mag.behind) drawMag(b, a.mag, rec);
  if (a.stock) drawStock(b, a.stock, rec);
  if (a.tube) drawMag(b, { style: 'tube', ...a.tube }, rec);
  // barrel
  const br = a.barrel;
  b.rect(br.x0, -br.r, br.x1 - br.x0, br.r * 2, br.mat ?? 'blued', 1);
  if (a.gasTube) b.rect(a.gasTube.x0, -br.r - (a.gasTube.h ?? 8) - 2, a.gasTube.x1 - a.gasTube.x0, a.gasTube.h ?? 8, 'blued', 3);
  if (a.fore && !a.fore.over) drawFore(b, a.fore, rec);
  if (a.mag && !a.mag.behind && a.mag.style !== 'belt') drawMag(b, a.mag, rec);
  drawGrip(b, a.grip, rec);
  drawGuard(b, a.guard, rec);
  // receiver
  if (rec.shape) b.path(rec.shape, rec.mat ?? 'blued');
  else b.rect(rec.x0, rec.top, rec.x1 - rec.x0, rec.bot - rec.top, rec.mat ?? 'blued', rec.r ?? 3);
  if (rec.lower) b.path(rec.lower, rec.lowerMat ?? rec.mat ?? 'blued');
  if (rec.rail) rail(b, rec.rail[0], rec.rail[1], rec.top);
  if (rec.port) b.rect(rec.port[0], rec.port[1], rec.port[2], rec.port[3], 'dark', 2);
  (rec.lines || []).forEach((l) => b.line(l[0], l[1], l[2], l[3], 'rgba(0,0,0,.5)', 1.4));
  if (a.fore && a.fore.over) drawFore(b, a.fore, rec);
  if (a.mag && a.mag.style === 'belt') drawMag(b, a.mag, rec);
  // bolt handles / charging handles
  if (a.bolt) {
    const { x, style } = a.bolt;
    if (style === 'knob') {
      b.sp(`M${x} -4 L${x - 14} ${a.bolt.drop ?? 26}`, '#2a2e33', 7);
      b.circle(x - 15, (a.bolt.drop ?? 26) + 3, 6, 'blued');
    } else if (style === 'straight') {
      b.sp(`M${x} -2 L${x + 2} ${a.bolt.drop ?? 24}`, '#2a2e33', 7);
      b.circle(x + 2, (a.bolt.drop ?? 24) + 4, 6.5, 'blued');
    } else if (style === 'tab') {
      b.rect(x, a.bolt.y ?? -6, a.bolt.w ?? 18, a.bolt.h ?? 8, 'blued', 2);
    }
  }
  // sights
  if (a.fsight) {
    const { x, h } = a.fsight;
    b.path(`M${x - 10} ${-br.r} L${x - 4} ${-h} L${x + 4} ${-h} L${x + 10} ${-br.r} Z`, 'blued');
  }
  if (a.rsight) b.rect(a.rsight.x, -(a.rsight.h ?? 26), a.rsight.w ?? 20, (a.rsight.h ?? 26) + (a.rsight.y ?? -14), 'blued', 2);
  if (a.vgrip) {
    const { x, len } = a.vgrip;
    b.path(`M${x} ${a.vgrip.y ?? 14} L${x + 30} ${a.vgrip.y ?? 14} L${x + 26} ${(a.vgrip.y ?? 14) + len} Q${x + 14} ${(a.vgrip.y ?? 14) + len + 6} ${x + 2} ${(a.vgrip.y ?? 14) + len} Z`, a.vgrip.mat ?? 'wood');
  }
  drawOptic(b, a.optic);
  if (a.bipod && a.bipod.behind === false) drawBipod(b, a.bipod);
  const mx = drawMuzzle(b, a.muzzle, br.x1, br.r);
  (a.extras || []).forEach((e) => b[e[0]](...e.slice(1)));
  return mx;
}

function drawPistol(b, a) {
  const s = a.slide, f = a.frame, g = a.grip;
  // grip
  const dx = Math.tan((g.ang ?? 16) * Math.PI / 180) * g.len;
  b.path(`M${g.x1} ${g.y} L${g.x0} ${g.y} Q${g.x0 - 10} ${g.y + 10} ${g.x0 - dx * 0.4} ${g.y + g.len * 0.4} L${g.x0 - dx} ${g.y + g.len} L${g.x1 - dx} ${g.y + g.len} L${g.x1 - dx * 0.2} ${g.y + g.len * 0.25} Z`, g.mat);
  if (g.panel) {
    const p = 7;
    b.path(`M${g.x1 - p} ${g.y + 10} L${g.x0 + p - 2} ${g.y + 10} L${g.x0 - dx + p} ${g.y + g.len - 14} L${g.x1 - dx - p} ${g.y + g.len - 14} Z`, g.panel);
  }
  for (let i = 1; i < 8; i++) {
    const y = g.y + 12 + i * ((g.len - 26) / 8);
    const o = (dx * (y - g.y)) / g.len;
    b.line(g.x0 - o + 6, y, g.x1 - o - 8, y, 'rgba(0,0,0,.25)', 1);
  }
  b.rect(g.x0 - dx - 3, g.y + g.len - 3, g.x1 - g.x0 + 6, 9, a.magBase ?? 'blued', 3);
  // frame & trigger guard
  b.path(`M${f.x0} ${f.top} L${f.x1} ${f.top} L${f.x1} ${f.bot - 6} Q${f.x1} ${f.bot} ${f.x1 - 8} ${f.bot} L${f.x0} ${f.bot} Z`, f.mat);
  const gx = f.guardX, gy = f.bot;
  b.sp(`M${gx} ${gy - 2} Q${gx + 2} ${gy + 34} ${gx - 18} ${gy + 34} L${gx - 50} ${gy + 30} Q${gx - 56} ${gy + 26} ${gx - 56} ${gy + 16}`, MATS[f.mat][2], 6);
  b.sp(`M${gx - 30} ${gy} Q${gx - 24} ${gy + 14} ${gx - 34} ${gy + 24}`, '#111', 4);
  if (a.hammer) b.path(`M${s.x0 + 4} ${s.bot - 4} L${s.x0 - 12} ${s.top - 6} L${s.x0 - 2} ${s.top - 10} L${s.x0 + 14} ${s.top + 6} Z`, 'blued');
  if (a.beaver) b.path(`M${g.x0 + 4} ${g.y - 2} Q${g.x0 - 18} ${g.y - 4} ${g.x0 - 22} ${g.y + 10} L${g.x0 - 6} ${g.y + 12} Z`, f.mat);
  // barrel bit beyond slide (if any)
  const mx = s.x1 + (a.barrelOut ?? 0);
  if (a.barrelOut) b.rect(s.x1 - 4, -6, a.barrelOut + 4, 12, 'blued', 2);
  // slide
  b.path(`M${s.x0} ${s.top + 4} Q${s.x0} ${s.top} ${s.x0 + 6} ${s.top} L${s.x1 - 6} ${s.top} Q${s.x1} ${s.top} ${s.x1} ${s.top + 6} L${s.x1} ${s.bot} L${s.x0} ${s.bot} Z`, s.mat);
  for (let i = 0; i < (s.serr ?? 8); i++) b.line(s.x0 + 10 + i * 5, s.top + 4, s.x0 + 10 + i * 5, s.bot - 4, 'rgba(0,0,0,.45)', 1.6);
  if (s.port) b.rect(s.port[0], s.top + 3, s.port[1], (s.bot - s.top) * 0.5, 'dark', 2);
  b.rect(s.x1 - 14, s.top - 5, 8, 6, 'blued', 1); // front sight
  b.rect(s.x0 + 6, s.top - 6, 14, 7, 'blued', 1); // rear sight
  if (a.lines) a.lines.forEach((l) => b.line(...l, 'rgba(0,0,0,.45)', 1.2));
  return mx;
}

function drawRotary(b, a) {
  // M134 minigun
  const h = a.housing, br = a.barrels;
  // spade grips
  b.path(`M${h.x0 - 60} -46 L${h.x0} -40 L${h.x0} -30 L${h.x0 - 50} -34 L${h.x0 - 58} 30 L${h.x0 - 70} 30 Z`, 'blued');
  b.rect(h.x0 - 78, -60, 16, 110, 'rubber', 7);
  // feed chute
  b.path(`M${h.x0 + 40} 30 Q${h.x0 + 10} 90 ${h.x0 - 80} 120 L${h.x0 - 90} 104 Q${h.x0 - 10} 80 ${h.x0 + 20} 26 Z`, 'olive');
  // motor
  b.rect(h.x0 + 30, -64, 90, 30, 'olive', 8);
  // housing
  b.rect(h.x0, -36, h.x1 - h.x0, 72, 'blued', 10);
  for (let x = h.x0 + 16; x < h.x1 - 10; x += 18) b.line(x, -32, x, 32, 'rgba(255,255,255,.07)', 3);
  // barrels (rotating group)
  b.raw(`<g class="rotor">`);
  const ys = [-22, -8, 6, 20];
  ys.forEach((y, i) => b.rect(h.x1, y - 5, br.x1 - h.x1, 10, i % 2 ? 'steel' : 'gunmetal', 3));
  b.raw(`</g>`);
  [br.c1, br.c2].forEach((cx) => b.rect(cx, -34, 18, 68, 'blued', 4));
  b.rect(br.x1 - 8, -32, 12, 64, 'blued', 4);
  return br.x1 + 4;
}

// ---------- muzzle flash profile (shape, colour, size, duration, torch pattern) per weapon
const FLASH_COLORS = {
  pistol: ['#fff3c8', '#ffb347', '#ff6a00'],
  hot: ['#ffffff', '#fff2a8', '#ffb627'],     // 5.56 / modern powders: white-yellow
  full: ['#fff8d8', '#ffc45c', '#ff7a1a'],    // full-power rifle
  russian: ['#fff1c2', '#ff9f3a', '#ff4d0a'], // 7.62 Soviet ammo — big orange flash
  shotgun: ['#fff0c0', '#ff8c2a', '#e0400a'],
  heavy: ['#ffffff', '#ffd27a', '#ff8a1a'],
};
export function flashProfile(w) {
  const a = w.art, p = w.sound;
  const mz = a.muzzle?.style ?? (a.kind === 'pistol' ? 'pistol' : 'none');
  const barrel = a.barrel ? a.barrel.x1 - a.barrel.x0 : 0;
  let shape = { flash: 'cage', bayonetlug: 'star', none: 'star', brake: 'brake', comp: 'comp', cutts: 'comp', ak: 'comp', cone: 'cone' }[mz] ?? 'star';
  if (a.kind === 'pistol') shape = 'pistol';
  if (a.kind === 'rotary') shape = 'cage';
  if (w.ammo === 'shell') shape = 'ball';
  let color = FLASH_COLORS.full;
  if (w.ammo === 'pistol' || a.kind === 'pistol') color = FLASH_COLORS.pistol;
  if (/556|57x28/.test(w.cart)) color = FLASH_COLORS.hot;
  if (/762x39|762x54r|762x25/.test(w.cart)) color = FLASH_COLORS.russian;
  if (w.ammo === 'shell') color = FLASH_COLORS.shotgun;
  if (/50bmg|145/.test(w.cart)) color = FLASH_COLORS.heavy;
  let size = 0.8 + p.power * 1.1;
  if (a.kind === 'long' && barrel && barrel < 260) size *= 1.25; // short barrels burn powder outside the muzzle
  if (shape === 'cage') size *= 0.62;                             // flash hiders work
  if (shape === 'pistol') size = 0.6 + p.power * 0.5;
  if (shape === 'ball') size = 1.6;
  let dur = Math.round(28 + p.power * 70);
  if (shape === 'cage') dur = Math.round(dur * 0.7);
  if (shape === 'ball') dur = 115;
  if (shape === 'brake') dur = 150;
  if (shape === 'pistol') dur = 38 + Math.round(p.power * 30);
  const torch = shape === 'brake' ? [dur, 45, 55] : shape === 'ball' ? [dur + 30] : shape === 'cone' ? [dur, 30, 30] : [Math.max(40, dur)];
  return { shape, color, size, dur, torch, screen: Math.min(0.85, 0.2 + p.power * 0.55 + (shape === 'ball' ? 0.15 : 0) - (shape === 'cage' ? 0.12 : 0)) };
}

function flashShape(uid, fp) {
  const [c0, c1] = fp.color;
  const g = `url(#${uid}-flash)`;
  switch (fp.shape) {
    case 'cage': return `<ellipse cx="34" cy="0" rx="46" ry="16" fill="${g}"/>
      <path d="M0 0 L46 -22 L30 -2 L70 0 L30 2 L46 22 Z M0 0 L30 -34 L20 -2 Z M0 0 L30 34 L20 2 Z" fill="${c1}" opacity=".85"/><circle cx="6" cy="0" r="10" fill="${c0}"/>`;
    case 'brake': return `<ellipse cx="-30" cy="0" rx="40" ry="70" fill="${g}" opacity=".9"/>
      <path d="M-40 -6 L-70 -80 L-20 -10 Z M-40 6 L-70 80 L-20 10 Z M-10 -6 L-30 -70 L4 -8 Z M-10 6 L-30 70 L4 8 Z" fill="${c1}" opacity=".9"/>
      <ellipse cx="40" cy="0" rx="60" ry="22" fill="${g}"/><path d="M0 -5 L80 0 L0 5 Z" fill="${c0}"/><circle cx="-24" cy="0" r="18" fill="${c0}" opacity=".9"/>`;
    case 'ball': return `<circle cx="60" cy="0" r="62" fill="${g}"/><circle cx="40" cy="0" r="36" fill="${c1}" opacity=".85"/>
      <path d="M0 -8 L110 -30 L80 0 L110 30 L0 8 Z" fill="${c1}" opacity=".7"/><circle cx="16" cy="0" r="20" fill="${c0}"/>`;
    case 'cone': return `<ellipse cx="80" cy="0" rx="110" ry="26" fill="${g}"/><path d="M0 -14 L150 0 L0 14 Z" fill="${c1}" opacity=".9"/>
      <path d="M0 -6 L90 0 L0 6 Z" fill="${c0}"/><circle cx="6" cy="0" r="14" fill="${c0}"/>`;
    case 'comp': return `<ellipse cx="50" cy="0" rx="70" ry="28" fill="${g}"/>
      <path d="M-4 -4 L20 -60 L22 -6 Z M10 -4 L40 -52 L36 -4 Z" fill="${c1}" opacity=".9"/>
      <path d="M0 -6 L80 -18 L60 0 L90 4 L0 6 Z" fill="${c1}" opacity=".9"/><circle cx="8" cy="0" r="13" fill="${c0}"/>`;
    case 'pistol': return `<ellipse cx="40" cy="0" rx="56" ry="22" fill="${g}"/><path d="M0 -5 L56 -16 L40 -2 L74 0 L40 2 L56 16 L0 5 Z" fill="${c1}" opacity=".9"/><circle cx="6" cy="0" r="10" fill="${c0}"/>`;
    default: return `<ellipse cx="60" cy="0" rx="85" ry="34" fill="${g}"/>
      <path d="M0 -6 L70 -26 L46 -4 L120 0 L46 4 L70 26 L0 6 Z" fill="${c0}" opacity=".95"/>
      <path d="M6 -3 L40 -40 L30 -2 Z M6 3 L40 40 L30 2 Z" fill="${c1}" opacity=".85"/><circle cx="8" cy="0" r="14" fill="${c0}"/>`;
  }
}

/**
 * Render a weapon to an SVG string.
 * opts.fx = true adds a muzzle-flash group (hidden) for the simulator stage.
 */
export function renderWeapon(w, opts = {}) {
  const uid = `g${++uidSeq}`;
  const a = w.art;
  const b = new Builder(uid, a.k ?? (a.kind === 'pistol' ? 1 : 1.6));
  let mx = 0;
  if (a.kind === 'pistol') mx = drawPistol(b, a);
  else if (a.kind === 'rotary') mx = drawRotary(b, a);
  else mx = drawLong(b, a);

  const pad = 14;
  const vx = b.x0 - pad, vy = b.y0 - pad, vw = b.x1 - b.x0 + pad * 2, vh = b.y1 - b.y0 + pad * 2;
  let fx = '';
  const fp = flashProfile(w);
  if (opts.fx) {
    const s = fp.size * (a.kind === 'pistol' ? 1 : Math.max(1, b.k * 0.8));
    fx = `<g class="flash" transform="translate(${mx} 0)" opacity="0"><g class="flash-inner" data-s="${s.toFixed(2)}" transform="scale(${s.toFixed(2)})">${flashShape(uid, fp)}</g></g>`;
  }
  const ej = a.eject ?? { x: (a.rec?.x0 ?? 0) + 40, y: -10 };
  const meta = { flash: fp, ejectDir: a.ejectDir ?? -1, ejectDown: !!a.ejectDown, muzzle: { x: mx, y: 0 }, eject: { x: ej.x, y: ej.y * b.k }, grip: a.grip?.x ?? a.rec?.x0 ?? 0, box: [vx, vy, vw, vh] };
  const svg = `<svg class="weapon-svg" viewBox="${vx} ${vy} ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${w.name}" overflow="visible">
    ${b.defs(fp.color)}<g class="gun-body">${b.out.join('')}</g>${fx}</svg>`;
  return { svg, meta };
}
