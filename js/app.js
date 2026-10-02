import { WEAPONS, byId, ERAS, TYPES, MODE_LABELS } from './data.js';
import { renderWeapon } from './render.js';
import { GunAudio, ENVIRONMENTS } from './audio.js';
import { Haptics, Torch, Particles } from './fx.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ storage
const store = {
  get(k, d) { try { const v = localStorage.getItem('arsenal:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('arsenal:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const DEFAULTS = {
  sound: true, vibrate: true, flash: true, torch: false, shake: false,
  volume: 0.9, env: 'range', haptic: 1, infinite: false, autoreload: true, recoil: true, particles: true, softflash: false,
};
const settings = { ...DEFAULTS, ...store.get('settings', {}), torch: false, shake: false };
const saveSettings = () => { const { torch, shake, ...rest } = settings; store.set('settings', rest); };
const favs = new Set(store.get('favs', []));

const audio = new GunAudio();
audio.volume = settings.volume; audio.muted = !settings.sound; audio.env = settings.env;
Haptics.enabled = settings.vibrate; Haptics.intensity = settings.haptic;

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ helpers
const ERA_NAME = Object.fromEntries(ERAS.map((e) => [e.id, e.label]));
const TYPE_NAME = { pistol: 'Pistol', smg: 'SMG', rifle: 'Rifle', sniper: 'Sniper', mg: 'Machine gun', shotgun: 'Shotgun' };
const MODE_SHORT = { semi: 'SEMI', burst: 'BURST', auto: 'AUTO', bolt: 'BOLT', pump: 'PUMP' };
const svgCache = new Map();
const thumb = (w) => { if (!svgCache.has(w.id)) svgCache.set(w.id, renderWeapon(w).svg); return svgCache.get(w.id); };

// ================================================================== ARMORY
const F = { era: 'all', type: 'all', q: '', sort: 'year', fav: false };

function buildFilters() {
  $('#era-tabs').innerHTML = ERAS.map((e) =>
    `<button role="tab" data-era="${e.id}" aria-selected="${e.id === F.era}">${e.label}${e.years ? `<small>${e.years}</small>` : '<small>&nbsp;</small>'}</button>`).join('');
  $('#type-chips').innerHTML = TYPES.map((t) => `<button class="chip" data-type="${t.id}" aria-pressed="${t.id === F.type}">${t.label}</button>`).join('');
  const nations = new Set(WEAPONS.map((w) => w.country));
  $('#stat-count').textContent = WEAPONS.length;
  $('#stat-countries').textContent = nations.size;

  $('#era-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-era]'); if (!b) return;
    F.era = b.dataset.era; $$('#era-tabs button').forEach((x) => x.setAttribute('aria-selected', x === b)); renderGrid();
  });
  $('#type-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    F.type = b.dataset.type; $$('#type-chips .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); renderGrid();
  });
  $('#q').addEventListener('input', (e) => { F.q = e.target.value.trim().toLowerCase(); renderGrid(); });
  $('#sort').addEventListener('change', (e) => { F.sort = e.target.value; renderGrid(); });
  $('#fav-only').addEventListener('click', (e) => {
    F.fav = !F.fav; e.currentTarget.setAttribute('aria-pressed', F.fav); renderGrid();
  });
}

function filtered() {
  let list = WEAPONS.filter((w) =>
    (F.era === 'all' || w.eras.includes(F.era)) &&
    (F.type === 'all' || w.type === F.type) &&
    (!F.fav || favs.has(w.id)) &&
    (!F.q || [w.name, w.nickname, w.country, w.caliber, w.designer, w.type, ...w.wars, String(w.year)].join(' ').toLowerCase().includes(F.q)));
  const by = {
    year: (a, b) => a.year - b.year,
    name: (a, b) => a.name.localeCompare(b.name),
    country: (a, b) => a.country.localeCompare(b.country) || a.year - b.year,
    recoil: (a, b) => b.feel.recoil - a.feel.recoil,
  }[F.sort];
  return list.sort(by);
}

function card(w) {
  return `<button class="card" data-id="${w.id}" aria-label="${esc(w.name)}">
    <div class="modes-mini">${w.modes.map((m) => `<i>${MODE_SHORT[m]}</i>`).join('')}</div>
    ${favs.has(w.id) ? '<svg class="star"><use href="#i-star"/></svg>' : ''}
    <div class="card-art">${thumb(w)}</div>
    <div class="card-body">
      <div class="card-title"><h4>${esc(w.name)}</h4><span class="yr">${w.year}</span></div>
      <div class="sub">${esc(w.country)}<span class="dot"></span>${esc(w.caliber.split(' (')[0])}</div>
      <div class="tags"><span class="tag t-type">${TYPE_NAME[w.type]}</span>${w.wars.slice(0, 2).map((x) => `<span class="tag">${esc(x.replace(/ \(.*\)/, ''))}</span>`).join('')}</div>
    </div></button>`;
}

function renderGrid() {
  const list = filtered();
  $('#empty').hidden = list.length > 0;
  let html = '';
  if (F.sort === 'year' && F.era === 'all' && !F.q) {
    for (const e of ERAS.slice(1)) {
      const group = list.filter((w) => w.eras[0] === e.id);
      if (!group.length) continue;
      html += `<div class="era-head"><h3>${e.label}</h3><span>${e.years} · ${group.length} weapons</span></div>` + group.map(card).join('');
    }
  } else html = list.map(card).join('');
  $('#grid').innerHTML = html;
}

function renderHero() {
  const picks = ['m82a1', 'ak47', 'mg42', 'm1911', 'thompson', 'm4a1', 'garand', 'aug'];
  const w = byId[picks[Math.floor(Math.random() * picks.length)]];
  const el = $('#hero-feat');
  el.innerHTML = renderWeapon(w).svg + `<span class="feat-tag"><svg><use href="#i-play"/></svg>Fire the <b>${esc(w.name)}</b></span>`;
  el.onclick = () => go(w.id);
}

$('#grid').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) go(c.dataset.id); });

// ================================================================== SIMULATOR
const stage = $('#stage');
const gunWrap = $('#gun-wrap');
const overlay = $('#flash-overlay');
const particles = new Particles($('#fx'));
const S = {
  w: null, mode: 'semi', ammo: 0, reloading: false, cycling: false, trigger: false,
  timer: null, remaining: 0, nextT: 0, lastShot: 0, queue: [], series: false, token: 0, fired: 0,
  svg: null, flash: null, flashInner: null, meta: null, rafOn: false,
};
let navDir = 0;

const go = (id) => { location.hash = `#/w/${id}`; };
const order = () => filtered().length ? filtered() : WEAPONS;

function openWeapon(id) {
  stopFiring(true);
  S.token++;
  const w = byId[id];
  S.w = w;
  S.mode = store.get('mode:' + id, w.modes[0]);
  if (!w.modes.includes(S.mode)) S.mode = w.modes[0];
  S.ammo = w.capacity; S.reloading = false; S.cycling = false;
  const { svg, meta } = renderWeapon(w, { fx: true });
  gunWrap.innerHTML = svg;
  S.svg = gunWrap.querySelector('svg'); S.flash = S.svg.querySelector('.flash'); S.flashInner = S.svg.querySelector('.flash-inner');
  S.meta = meta;
  const [bx, , bw] = meta.box;
  // keep relative sizes believable: a pistol shouldn't fill the stage like a .50 cal
  const fit = { pistol: 0.56, smg: 0.82 }[w.type] ?? 1;
  gunWrap.style.setProperty('--fit', fit);
  gunWrap.style.transformOrigin = `${(((meta.grip - bx) / bw) * 100).toFixed(1)}% 60%`;
  gunWrap.classList.remove('swap-in', 'reloading', 'cycling', 'spinning');
  gunWrap.style.setProperty('--from', `${navDir * 50}px`);
  void gunWrap.offsetWidth; gunWrap.classList.add('swap-in');
  navDir = 0;

  $('#w-name').textContent = w.name.toUpperCase();
  $('#w-meta').innerHTML = `${esc(w.country)} · <b>${w.year}</b> · ${esc(w.caliber)}`;
  document.title = `${w.name} — Arsenal`;
  $('[data-action="fav"]').classList.toggle('on', favs.has(id));
  $('[data-action="fav"] use').setAttribute('href', favs.has(id) ? '#i-star' : '#i-star-o');
  $('#feel').innerHTML = meters(w, false);
  $('#reload-banner').hidden = true;
  $('.reload').classList.remove('attn', 'busy');
  renderModes(); renderAmmo(true); renderTab();
}

function meters(w, big) {
  const rate = w.rpm ? Math.min(10, Math.round(Math.log10(w.rpm / 100) / Math.log10(30) * 10)) : 1;
  const rows = [['Recoil', w.feel.recoil], ['Loudness', w.feel.loud], ['Fire rate', rate]];
  if (big) rows.push(['Energy', Math.round(w.sound.power * 10)]);
  return rows.map(([l, v]) => `<div class="meter"><span>${l}</span><div class="bar"><i style="width:${v * 10}%"></i></div>${big ? `<b>${v}</b>` : ''}</div>`).join('');
}

function renderModes() {
  $('#modes').innerHTML = S.w.modes.map((m) =>
    `<button class="mode" role="radio" data-mode="${m}" aria-checked="${m === S.mode}"><span class="box"></span>${m === 'burst' ? `${S.w.burst ?? 3}-rd burst` : MODE_LABELS[m]}</button>`).join('');
}
$('#modes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  setMode(b.dataset.mode);
});
function setMode(m) {
  if (m === S.mode) return;
  stopFiring();
  S.mode = m; store.set('mode:' + S.w.id, m);
  $$('#modes .mode').forEach((x) => x.setAttribute('aria-checked', x.dataset.mode === m));
  audio.click(audio.now, 2600, 0.25, 0.02); Haptics.tick(10);
}

function renderAmmo(full) {
  const w = S.w, strip = $('#ammo-strip');
  if (full) {
    strip.className = `ammo-strip ${w.ammo}`;
    if (w.capacity <= 40) strip.innerHTML = Array.from({ length: w.capacity }, () => '<i class="round"></i>').join('');
    else strip.innerHTML = '<div class="ammo-bar"><i></i></div>';
    $('#ammo-cal').textContent = w.caliber.split(' (')[0];
  }
  if (w.capacity <= 40) {
    const r = strip.children;
    for (let i = 0; i < r.length; i++) r[i].classList.toggle('spent', i >= S.ammo);
  } else strip.querySelector('.ammo-bar i').style.width = `${(S.ammo / w.capacity) * 100}%`;
  const c = $('#ammo-count');
  c.textContent = settings.infinite ? '∞' : `${S.ammo} / ${w.capacity}`;
  c.classList.toggle('low', !settings.infinite && S.ammo <= Math.ceil(w.capacity * 0.2));
}

// ------------------------------------------------------------------ firing
const isAuto = () => S.mode === 'auto';
const minGap = () => {
  const w = S.w;
  if (w.rpm) return 60 / w.rpm;
  return w.type === 'pistol' ? 0.1 : w.ammo === 'bmg' ? 0.35 : 0.14; // semi-auto trigger reset
};

async function pressTrigger() {
  await audio.unlock(); // no-op once running; first tap waits for the context to start
  S.trigger = true;
  $('#trigger').classList.add('down');
  $('#hint').classList.add('gone');
  if (S.reloading || S.cycling || S.series) return;
  if (!hasAmmo()) return emptyClick();
  if (S.mode === 'auto') startSeries(Infinity);
  else if (S.mode === 'burst') startSeries(S.w.burst ?? 3);
  else startSeries(1);
}

function releaseTrigger() {
  S.trigger = false;
  $('#trigger').classList.remove('down');
  if (S.series && isAuto() && S.remaining === Infinity) stopFiring();
}

const hasAmmo = () => settings.infinite || S.ammo > 0;

function emptyClick() {
  audio.dryFire(); Haptics.tick(8);
  $('#reload-banner').hidden = false; $('.reload').classList.add('attn');
  if (settings.autoreload) setTimeout(() => { if (!S.reloading && !hasAmmo()) reload(); }, 350);
}

function startSeries(n) {
  const w = S.w;
  S.series = true; S.remaining = n;
  let t0 = Math.max(audio.now + 0.01, S.lastShot + minGap());
  if (w.rotary) {
    audio.motorStart(); gunWrap.classList.add('spinning');
    t0 = audio.now + 0.32; // spin-up before the first round
  }
  S.nextT = t0;
  tick();
  clearInterval(S.timer);
  S.timer = setInterval(tick, 15);
}

function tick() {
  const w = S.w, gap = minGap(), now = audio.now;
  const rapid = (w.rpm ?? 0) >= 900;
  while (S.remaining > 0 && S.nextT < now + 0.06) {
    if (!hasAmmo()) { stopFiring(); emptyClick(); return; }
    if (!settings.infinite) S.ammo--;
    const t = S.nextT;
    audio.shot(w.sound, t, { rapid });
    S.queue.push({ t, rapid, last: !settings.infinite && S.ammo === 0, gap });
    S.lastShot = t; S.fired++;
    S.remaining--; S.nextT += gap;
  }
  if (S.remaining <= 0) {
    clearInterval(S.timer); S.timer = null;
    // let the last scheduled shot play out before allowing another series
    const done = S.lastShot - now + 0.01;
    setTimeout(() => {
      S.series = false;
      if (w.rotary) { audio.motorStop(); gunWrap.classList.remove('spinning'); }
      if (S.mode === 'bolt' || S.mode === 'pump') cycleAction();
    }, Math.max(0, done * 1000));
  }
}

function stopFiring(hard = false) {
  clearInterval(S.timer); S.timer = null;
  S.remaining = 0;
  if (S.series) {
    const wait = Math.max(0, (S.lastShot - audio.now) * 1000);
    setTimeout(() => { S.series = false; }, wait);
  }
  if (hard) { S.series = false; S.queue = []; }
  if (audio.motor) audio.motorStop();
  gunWrap.classList.remove('spinning');
}

function cycleAction() {
  const w = S.w, tok = S.token;
  S.cycling = true;
  const pump = S.mode === 'pump';
  const t = audio.now + 0.22;
  if (pump) audio.pump(t); else audio.boltCycle(t, 1.15);
  setTimeout(() => {
    if (tok !== S.token) return;
    gunWrap.classList.remove('cycling'); void gunWrap.offsetWidth; gunWrap.classList.add('cycling');
    Haptics.seq(pump ? [30, 160, 34] : [18, 90, 22, 160, 26]);
    ejectShell(w, pump ? 'shell' : 'casing');
  }, 260);
  setTimeout(() => { if (tok === S.token) S.cycling = false; }, pump ? 620 : 860);
}

// ------------------------------------------------------------------ visual / haptic / light effects
function screenPoint(x, y) {
  if (!S.svg) return null;
  const m = S.svg.getScreenCTM(); if (!m) return null;
  const p = S.svg.createSVGPoint(); p.x = x; p.y = y;
  const r = stage.getBoundingClientRect(), q = p.matrixTransform(m);
  return { x: q.x - r.left, y: q.y - r.top, sx: q.x, sy: q.y };
}

function ejectShell(w, kind = 'casing') {
  if (!settings.particles) return;
  const e = screenPoint(S.meta.eject.x, S.meta.eject.y); if (!e) return;
  const belt = w.ammo === 'belt';
  const color = kind === 'shell' ? '#c0392b' : undefined;
  const size = w.ammo === 'bmg' ? 1.7 : kind === 'shell' ? 1.6 : w.ammo === 'pistol' ? 0.8 : 1.1;
  particles.shell(e.x, e.y, { dir: -1, down: belt, size, color });
  audio.casing(audio.now + 0.45 + Math.random() * 0.15, w.ammo === 'bmg', kind === 'shell');
}

function shotFx(item) {
  const w = S.w, p = w.sound;
  const k = w.feel.recoil / 10;
  const soft = settings.softflash;
  // recoil
  if (settings.recoil) {
    const jitter = item.rapid ? 0.55 + Math.random() * 0.5 : 1;
    const dist = (6 + k * 34) * jitter, rot = (1 + k * 7) * jitter;
    const dur = item.rapid || isAuto() ? Math.max(45, Math.min(item.gap * 1000 * 0.95, 120)) : 160 + k * 160;
    gunWrap.animate([
      { transform: 'none' },
      { transform: `translate(${-dist}px, ${-dist * 0.12}px) rotate(${-rot}deg)`, offset: 0.16 },
      { transform: 'none' },
    ], { duration: dur, easing: 'cubic-bezier(.15,.7,.3,1)' });
    if (p.power >= 0.75 && !soft) {
      const a = 3 + p.power * 9;
      stage.animate([{ transform: 'none' }, { transform: `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px)` }, { transform: 'none' }], { duration: 110 });
    }
  }
  // muzzle flash sprite
  if (S.flash) {
    const s = 0.75 + Math.random() * 0.5;
    S.flashInner.setAttribute('transform', `${S.flashInner.getAttribute('transform').replace(/ rotate.*$/, '')} rotate(${(Math.random() - 0.5) * 16}) scale(${s} ${0.8 + Math.random() * 0.5})`);
    S.flash.animate([{ opacity: soft ? 0.35 : 1 }, { opacity: 0 }], { duration: item.rapid ? 40 : 60 + p.power * 70, easing: 'ease-out' });
  }
  const mz = screenPoint(S.meta.muzzle.x, 0);
  // screen flash
  if (settings.flash && mz) {
    overlay.style.setProperty('--fx', `${mz.sx}px`); overlay.style.setProperty('--fy', `${mz.sy}px`);
    const peak = soft ? 0.1 : 0.22 + p.power * 0.5;
    overlay.animate([{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: 0 }], { duration: item.rapid ? 50 : 90 + p.power * 80 });
  }
  if (settings.torch && !soft) Torch.pulse(item.rapid ? 35 : 50 + p.power * 70);
  Haptics.shot(p, { rapid: item.rapid || isAuto(), interval: item.gap * 1000 });
  // particles
  if (settings.particles && mz) {
    if (!item.rapid || Math.random() < 0.35) particles.smoke(mz.x, mz.y, p.power);
    if (!soft) particles.sparks(mz.x, mz.y, item.rapid ? 0.5 : 1 + p.power);
    if (w.art.muzzle?.style === 'brake') particles.dust(mz.x - 10, mz.y, 1.4);
  }
  if (S.mode !== 'bolt' && S.mode !== 'pump') {
    if (!item.rapid || Math.random() < 0.6) ejectShell(w);
  }
  // M1 Garand en-bloc clip "PING"
  if (w.ping && item.last) {
    audio.clipPing(audio.now + 0.09);
    const e = screenPoint(S.meta.eject.x, S.meta.eject.y);
    if (e && settings.particles) particles.shell(e.x, e.y, { dir: 0.4, size: 1.6, color: '#5a5f66' });
    toast('PING! — empty en-bloc clip ejected', 1600);
  }
  renderAmmo(false);
  if (item.last) { $('#reload-banner').hidden = false; $('.reload').classList.add('attn'); }
}

function frame() {
  if (!S.rafOn) return;
  const now = audio.now;
  while (S.queue.length && S.queue[0].t <= now + 0.004) shotFx(S.queue.shift());
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ reload
function reload() {
  const w = S.w;
  if (S.reloading || settings.infinite || S.ammo === w.capacity) return;
  stopFiring();
  const tok = S.token;
  const dur = w.ammo === 'shell' ? Math.min(3.2, 0.6 + (w.capacity - S.ammo) * 0.4)
    : w.ammo === 'belt' ? 3.2 : w.ammo === 'bmg' ? 2.8 : w.ammo === 'pistol' && w.type === 'pistol' ? 1.4
    : w.modes.includes('bolt') ? 2.4 : w.type === 'smg' ? 1.9 : 2.2;
  S.reloading = true;
  const t = audio.now;
  if (w.ammo === 'shell') {
    const n = w.capacity - S.ammo;
    for (let i = 0; i < n; i++) { audio.click(t + 0.3 + i * 0.4, 1300, 0.3, 0.05, 2); audio.click(t + 0.36 + i * 0.4, 2400, 0.15, 0.03); }
  } else if (w.ammo === 'belt') {
    audio.beltLoad(t + 0.2); audio.click(t + 1.6, 1000, 0.4, 0.06, 2); audio.charge(t + dur - 0.5);
  } else if (w.modes.includes('bolt') || w.ping) {
    audio.click(t + 0.15, 1600, 0.3, 0.04); audio.magIn(t + dur * 0.5); audio.boltCycle(t + dur - 0.55, 1.3);
  } else {
    audio.magOut(t + 0.15); audio.magIn(t + dur * 0.55); if (S.ammo === 0) audio.charge(t + dur * 0.75);
  }
  setTimeout(() => tok === S.token && Haptics.seq([14]), dur * 550);
  setTimeout(() => tok === S.token && Haptics.seq([12, 80, 20]), dur * 800);
  const rb = $('.reload');
  rb.classList.remove('attn'); rb.style.setProperty('--dur', `${dur}s`); gunWrap.style.setProperty('--dur', `${dur}s`);
  rb.classList.remove('busy'); gunWrap.classList.remove('reloading'); void rb.offsetWidth;
  rb.classList.add('busy'); gunWrap.classList.add('reloading');
  $('#reload-banner').hidden = true;
  setTimeout(() => {
    if (tok !== S.token) return;
    S.ammo = w.capacity; S.reloading = false;
    rb.classList.remove('busy'); gunWrap.classList.remove('reloading');
    renderAmmo(false);
  }, dur * 1000);
}

// ------------------------------------------------------------------ input
function bindHold(el, { ignoreButtons = false } = {}) {
  el.addEventListener('pointerdown', (e) => {
    if (ignoreButtons && e.target.closest('button')) return;
    if (e.button > 0) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    pressTrigger();
  });
  const up = () => { if (S.trigger) releaseTrigger(); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindHold(stage, { ignoreButtons: true });
bindHold($('#trigger'));

document.addEventListener('keydown', (e) => {
  if ($('#view-sim').hidden || e.target.matches('input, select, textarea') || $('#settings').open) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) pressTrigger(); }
  else if (e.key === 'r' || e.key === 'R') reload();
  else if (e.key === 'm' || e.key === 'M') { const m = S.w.modes; setMode(m[(m.indexOf(S.mode) + 1) % m.length]); }
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'i' || e.key === 'I') toggleManual();
  else if (e.key === 'f' || e.key === 'F') fullscreen();
  else if (e.key === 'Escape' && !$('#manual').classList.contains('open')) location.hash = '#/';
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') releaseTrigger();
});

function step(d) {
  const list = order();
  let i = list.findIndex((w) => w.id === S.w.id);
  if (i < 0) i = 0;
  const n = list[(i + d + list.length) % list.length];
  navDir = d;
  location.replace(`#/w/${n.id}`);
}

// ------------------------------------------------------------------ toggles
async function toggle(name) {
  const btn = $(`[data-tog="${name}"]`);
  if (name === 'sound') {
    settings.sound = !settings.sound; audio.setMuted(!settings.sound); if (settings.sound) audio.unlock();
  } else if (name === 'vibrate') {
    if (!Haptics.supported) { toast('Vibration isn\'t available here (iPhone/desktop browsers block it). Try Chrome on Android.'); return; }
    settings.vibrate = !settings.vibrate; Haptics.enabled = settings.vibrate; if (settings.vibrate) Haptics.seq([40, 60, 20]);
  } else if (name === 'flash') {
    settings.flash = !settings.flash;
  } else if (name === 'torch') {
    if (settings.torch) { settings.torch = false; Torch.disable(); }
    else {
      if (!Torch.possible || !window.isSecureContext) { toast('Flashlight needs HTTPS and a camera-enabled browser.'); btn.classList.add('na'); return; }
      try { btn.classList.add('na'); await Torch.enable(); settings.torch = true; btn.classList.remove('na'); toast('Flashlight armed — it will flash with every shot'); Torch.pulse(120); }
      catch (err) { btn.classList.add('na'); toast(err.name === 'NotAllowedError' ? 'Camera permission denied — flashlight unavailable.' : err.message, 3600); return; }
    }
  } else if (name === 'shake') {
    if (!settings.shake) {
      if (typeof DeviceMotionEvent === 'undefined') { toast('Motion sensors aren\'t available on this device.'); return; }
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        try { if ((await DeviceMotionEvent.requestPermission()) !== 'granted') { toast('Motion permission denied.'); return; } }
        catch { toast('Motion permission denied.'); return; }
      }
      settings.shake = true; window.addEventListener('devicemotion', onMotion); toast('Shake your phone to fire!');
    } else { settings.shake = false; window.removeEventListener('devicemotion', onMotion); }
  }
  saveSettings(); syncToggles();
}
function syncToggles() {
  for (const n of ['sound', 'vibrate', 'flash', 'torch', 'shake']) {
    const b = $(`[data-tog="${n}"]`); b.classList.toggle('on', !!settings[n]); b.setAttribute('aria-pressed', !!settings[n]);
  }
  if (!Haptics.supported) $('[data-tog="vibrate"]').classList.add('na');
}
$('.sim-right').addEventListener('click', (e) => { const b = e.target.closest('[data-tog]'); if (b) toggle(b.dataset.tog); });

let lastShake = 0;
function onMotion(e) {
  if ($('#view-sim').hidden) return;
  const a = e.acceleration && e.acceleration.x != null ? e.acceleration : e.accelerationIncludingGravity;
  if (!a) return;
  const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  const thresh = e.acceleration && e.acceleration.x != null ? 15 : 25;
  const now = performance.now();
  if (mag > thresh && now - lastShake > 280) {
    lastShake = now;
    if (S.reloading || S.cycling || S.series) return;
    if (!hasAmmo()) return emptyClick();
    startSeries(S.mode === 'auto' ? 5 : S.mode === 'burst' ? S.w.burst ?? 3 : 1);
  }
}

// ------------------------------------------------------------------ actions
async function fullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    } else await document.exitFullscreen();
  } catch { toast('Fullscreen not supported here — add Arsenal to your home screen instead.'); }
}

function toggleManual(force) {
  const m = $('#manual');
  const open = force ?? !m.classList.contains('open');
  m.classList.toggle('open', open);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  if (a === 'back') location.hash = '#/';
  else if (a === 'info') toggleManual();
  else if (a === 'settings') openSettings();
  else if (a === 'fullscreen') fullscreen();
  else if (a === 'prev') step(-1);
  else if (a === 'next') step(1);
  else if (a === 'reload') reload();
  else if (a === 'fav') {
    const id = S.w.id;
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set('favs', [...favs]);
    b.classList.toggle('on', favs.has(id)); $('use', b).setAttribute('href', favs.has(id) ? '#i-star' : '#i-star-o');
    toast(favs.has(id) ? 'Added to favorites' : 'Removed from favorites', 1400);
  }
});

// ------------------------------------------------------------------ field manual
let tab = 'overview';
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  tab = b.dataset.tab; $$('#tabs button').forEach((x) => x.setAttribute('aria-selected', x === b)); renderTab();
});

function hapticSvg(w) {
  const pat = Haptics.pattern(w.sound);
  const total = pat.reduce((a, b) => a + b, 0);
  let x = 0, out = '';
  pat.forEach((d, i) => { const wd = (d / total) * 300; if (i % 2 === 0) out += `<rect x="${x}" y="4" width="${Math.max(1.5, wd)}" height="28" rx="2" fill="var(--accent)"/>`; x += wd; });
  return `<svg viewBox="0 0 300 36" style="width:100%;height:36px;background:var(--surface-2);border-radius:8px;border:1px solid var(--line)">${out}</svg>
    <p style="font-size:12.5px;color:var(--muted);margin-top:6px">Vibration waveform for one shot (${total} ms). Pulse width mimics the blast, the decaying echo and the action cycling.</p>`;
}

function renderTab() {
  const w = S.w, b = $('#tab-body');
  if (tab === 'overview') {
    b.innerHTML = `${w.nickname ? `<p class="nick">${esc(w.nickname)}</p>` : ''}
      <p class="lead">${esc(w.overview)}</p>
      <div class="facts">
        <div class="fact"><span>Country</span><b>${esc(w.country)}</b></div>
        <div class="fact"><span>Introduced</span><b>${w.year}</b></div>
        <div class="fact"><span>Designer</span><b>${esc(w.designer)}</b></div>
        <div class="fact"><span>Class</span><b>${TYPE_NAME[w.type]}</b></div>
      </div>
      <h3>Service history</h3><p>${esc(w.history)}</p>
      <h3>Conflicts</h3><div class="wars">${w.wars.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <h3>Did you know?</h3><ul class="trivia">${w.trivia.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <h3>Eras</h3><div class="wars">${w.eras.map((e) => `<span>${ERA_NAME[e]}</span>`).join('')}</div>`;
  } else if (tab === 'how') {
    b.innerHTML = `<p style="margin-bottom:12px"><b style="color:var(--text)">${esc(w.action)}</b></p>
      <button class="btn-ghost" id="walk"><svg><use href="#i-play"/></svg>Walk through the cycle</button>
      <ol class="steps">${w.how.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
    $('#walk').onclick = walkCycle;
  } else if (tab === 'specs') {
    const rows = [
      ['Calibre', w.caliber], ['Action', w.action], ['Capacity', `${w.capacity} rounds`],
      ['Rate of fire', w.rpm ? `${w.rpm} rounds/min` : 'Semi-automatic / manual'],
      ['Muzzle velocity', w.velocity], ['Effective range', w.range], ['Weight', w.weight], ['Length', w.length],
      ['Fire modes', w.modes.map((m) => MODE_LABELS[m]).join(', ')],
    ];
    b.innerHTML = `<table class="specs">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
      <p style="font-size:12.5px;color:var(--dim);margin-top:12px">Typical published values — they vary by variant and ammunition.</p>`;
  } else if (tab === 'feel') {
    b.innerHTML = `<div class="big-meters">${meters(w, true)}</div>
      <p class="lead">${esc(w.feel.text)}</p>
      <h3>Haptic signature</h3>${hapticSvg(w)}
      <div class="feel-actions"><button class="btn-ghost" id="feel-vibe"><svg><use href="#i-vibe"/></svg>Feel one shot</button>
      <button class="btn-ghost" id="feel-hear"><svg><use href="#i-sound"/></svg>Hear one shot</button></div>`;
    $('#feel-vibe').onclick = () => { if (!Haptics.supported) toast('Vibration isn\'t available on this device.'); Haptics.shot(w.sound); };
    $('#feel-hear').onclick = async () => { await audio.unlock(); audio.shot(w.sound); };
  }
}

async function walkCycle() {
  await audio.unlock();
  const items = $$('.steps li'), tok = S.token;
  for (let i = 0; i < items.length; i++) {
    if (tok !== S.token || tab !== 'how') return;
    items.forEach((x, j) => x.classList.toggle('active', j === i));
    items[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    audio.click(audio.now, 1400 + i * 300, 0.2, 0.03); Haptics.tick(12);
    await new Promise((r) => setTimeout(r, 1700));
  }
  items.forEach((x) => x.classList.remove('active'));
}

// ------------------------------------------------------------------ settings dialog
function openSettings() {
  const d = $('#settings');
  $('#s-env').innerHTML = Object.entries(ENVIRONMENTS).map(([k, v]) => `<option value="${k}" ${k === settings.env ? 'selected' : ''}>${v.label}</option>`).join('');
  $('#s-volume').value = settings.volume; $('#s-haptic').value = settings.haptic;
  $('#s-infinite').checked = settings.infinite; $('#s-autoreload').checked = settings.autoreload;
  $('#s-recoil').checked = settings.recoil; $('#s-particles').checked = settings.particles; $('#s-softflash').checked = settings.softflash;
  const caps = [
    `Vibration: ${Haptics.supported ? 'supported' : 'not supported in this browser'}`,
    `Flashlight: ${Torch.possible && window.isSecureContext ? 'may be available (Chrome on Android)' : 'unavailable'}`,
    `Audio: Web Audio ${window.AudioContext || window.webkitAudioContext ? 'ready' : 'missing'}`,
  ];
  $('#cap-note').textContent = caps.join(' · ');
  d.showModal();
}
$('#settings').addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 's-volume') { settings.volume = +t.value; audio.setVolume(settings.volume); }
  if (t.id === 's-haptic') { settings.haptic = +t.value; Haptics.intensity = settings.haptic; Haptics.seq([60]); }
  if (t.id === 's-env') { settings.env = t.value; audio.unlock().then(() => { audio.setEnvironment(t.value); if (S.w) audio.shot(S.w.sound); }); }
  if (t.id === 's-infinite') { settings.infinite = t.checked; if (S.w) { S.ammo = S.w.capacity; renderAmmo(false); } }
  if (t.id === 's-autoreload') settings.autoreload = t.checked;
  if (t.id === 's-recoil') settings.recoil = t.checked;
  if (t.id === 's-particles') settings.particles = t.checked;
  if (t.id === 's-softflash') settings.softflash = t.checked;
  saveSettings();
});
$('#settings').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// ------------------------------------------------------------------ routing & lifecycle
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not allowed */ }
}

function route() {
  const m = location.hash.match(/^#\/w\/([\w-]+)/);
  if (m && byId[m[1]]) {
    $('#view-armory').hidden = true; $('#view-sim').hidden = false;
    openWeapon(m[1]);
    particles.resize();
    if (!S.rafOn) { S.rafOn = true; requestAnimationFrame(frame); }
    keepAwake(true);
  } else {
    stopFiring(true);
    S.rafOn = false; toggleManual(false);
    if (settings.torch) { settings.torch = false; Torch.disable(); syncToggles(); }
    $('#view-sim').hidden = true; $('#view-armory').hidden = false;
    document.title = 'Arsenal — Gun Simulator & Field Guide';
    keepAwake(false);
  }
}
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { releaseTrigger(); stopFiring(); Haptics.stop(); }
  else if (!$('#view-sim').hidden) keepAwake(true);
});

// unlock audio on first interaction anywhere
window.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });

function gate() {
  if (store.get('gated', false)) return;
  const g = $('#gate'); g.hidden = false;
  $('#gate-go').onclick = async () => {
    await audio.unlock(); store.set('gated', true); g.hidden = true;
    Haptics.seq([30, 60, 30]);
  };
}

// ------------------------------------------------------------------ boot
buildFilters();
renderGrid();
renderHero();
syncToggles();
route();
gate();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
