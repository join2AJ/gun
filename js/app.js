import { WEAPONS, byId, ERAS, TYPES, USERS, CARTS, ENV_LABELS, MODE_LABELS } from './data.js';
import { renderWeapon } from './render.js';
import { GunAudio } from './audio.js';
import { Haptics, Torch, Particles, Weather } from './fx.js';
import { SCENES, SCENE_ORDER, SCENE_ENV_KEY, sceneSvg } from './scenes.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => n.toLocaleString('en-IN');
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0)} km` : `${m} m`);

// ------------------------------------------------------------------ storage
const store = {
  get(k, d) { try { const v = localStorage.getItem('arsenal:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('arsenal:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const DEFAULTS = {
  sound: true, vibrate: true, flash: true, torch: false, shake: false, scene: 'range',
  volume: 0.9, amb: 0.35, haptic: 1, infinite: false, autoreload: true, recoil: true, particles: true, weather: true, softflash: false,
};
const settings = { ...DEFAULTS, ...store.get('settings', {}), torch: false, shake: false };
const saveSettings = () => { const { torch, shake, ...rest } = settings; store.set('settings', rest); };
const favs = new Set(store.get('favs', []));

const audio = new GunAudio();
audio.volume = settings.volume; audio.ambVolume = settings.amb; audio.muted = !settings.sound; audio.env = SCENES[settings.scene]?.env ?? 'range';
Haptics.enabled = settings.vibrate; Haptics.intensity = settings.haptic;

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ labels
const ERA_NAME = Object.fromEntries(ERAS.map((e) => [e.id, e.label]));
const USER_NAME = Object.fromEntries(USERS.map((u) => [u.id, u.label]));
const INDIAN_UNITS = new Set(['spg', 'nsg', 'parasf', 'marcos', 'garud']);
const TYPE_NAME = { pistol: 'Pistol', smg: 'SMG', rifle: 'Rifle', sniper: 'Sniper / AMR', lmg: 'LMG', mg: 'MG / GPMG', shotgun: 'Shotgun' };
const MODE_SHORT = { semi: 'SEMI', burst: 'BURST', auto: 'AUTO', bolt: 'BOLT', pump: 'PUMP' };
const FEED = (w) => (w.ammo === 'belt' ? (w.rotary ? 'linked belt' : 'belt / box') : w.ammo === 'shell' ? 'tube magazine' : w.ping ? 'en-bloc clip' : w.art.mag?.style === 'internal' ? 'internal mag' : w.art.mag?.style === 'drum' ? 'drum' : 'box magazine');
const isIndian = (w) => w.origin === 'India' || w.users.some((u) => INDIAN_UNITS.has(u)) || /India|Kargil|Indo-Pak/.test(w.wars.join(' ') + w.overview);
const rateLabel = (w) => (w.rpm ? `${fmt(w.rpm)} rpm` : w.modes.includes('bolt') ? '~15 aimed rpm' : w.modes.includes('pump') ? '~30 rpm' : 'Semi-auto');
const svgCache = new Map();
const thumb = (w) => { if (!svgCache.has(w.id)) svgCache.set(w.id, renderWeapon(w).svg); return svgCache.get(w.id); };
const stars = (n) => '■'.repeat(n) + `<s>${'■'.repeat(5 - n)}</s>`;

// ================================================================== ARMORY
const F = { era: 'all', type: 'all', user: 'all', q: '', sort: 'year', fav: false, india: false };

function buildFilters() {
  $('#era-tabs').innerHTML = ERAS.map((e) => `<button role="tab" data-era="${e.id}" aria-selected="${e.id === F.era}">${e.label}<small>${e.years ?? 'every era'}</small></button>`).join('');
  $('#type-chips').innerHTML = TYPES.map((t) => `<button class="chip" data-type="${t.id}" aria-pressed="${t.id === F.type}">${t.label}</button>`).join('');
  $('#user-chips').innerHTML = USERS.map((u) => `<button class="chip" data-user="${u.id}" aria-pressed="${u.id === F.user}" ${u.hint ? `title="${u.hint}"` : ''}>${u.label}</button>`).join('');
  $('#stat-count').textContent = WEAPONS.length;
  $('#stat-countries').textContent = new Set(WEAPONS.flatMap((w) => w.country.split(' / '))).size;
  const group = (sel, attr, key) => $(sel).addEventListener('click', (e) => {
    const b = e.target.closest(`[data-${attr}]`); if (!b) return;
    F[key] = b.dataset[attr];
    $$(`${sel} [data-${attr}]`).forEach((x) => x.setAttribute(attr === 'era' ? 'aria-selected' : 'aria-pressed', x === b));
    renderGrid();
  });
  group('#era-tabs', 'era', 'era'); group('#type-chips', 'type', 'type'); group('#user-chips', 'user', 'user');
  $('#q').addEventListener('input', (e) => { F.q = e.target.value.trim().toLowerCase(); renderGrid(); });
  $('#sort').addEventListener('change', (e) => { F.sort = e.target.value; renderGrid(); });
  const flag = (id, key) => $(id).addEventListener('click', (e) => { F[key] = !F[key]; e.currentTarget.setAttribute('aria-pressed', F[key]); renderGrid(); });
  flag('#fav-only', 'fav'); flag('#india-only', 'india');
}

function filtered() {
  const list = WEAPONS.filter((w) =>
    (F.era === 'all' || w.eras.includes(F.era)) &&
    (F.type === 'all' || w.type === F.type) &&
    (F.user === 'all' || w.users.includes(F.user)) &&
    (!F.fav || favs.has(w.id)) && (!F.india || isIndian(w)) &&
    (!F.q || [w.name, w.nickname, w.country, w.caliber, w.designer, TYPE_NAME[w.type], ...w.wars, ...w.users.map((u) => USER_NAME[u]), String(w.year), w.origin ?? ''].join(' ').toLowerCase().includes(F.q)));
  const by = {
    year: (a, b) => a.year - b.year, name: (a, b) => a.name.localeCompare(b.name),
    range: (a, b) => b.eff - a.eff, energy: (a, b) => b.energy - a.energy, rpm: (a, b) => (b.rpm ?? 0) - (a.rpm ?? 0), recoil: (a, b) => b.feel.recoil - a.feel.recoil,
  }[F.sort];
  return list.sort(by);
}

function card(w) {
  const units = w.users.filter((u) => INDIAN_UNITS.has(u));
  return `<button class="card" data-id="${w.id}" aria-label="${esc(w.name)}">
    <div class="corner">${w.modes.map((m) => `<i>${MODE_SHORT[m]}</i>`).join('')}</div>
    ${isIndian(w) ? '<i class="tri" title="Indian origin or service"></i>' : ''}
    ${favs.has(w.id) ? '<svg class="star"><use href="#i-star"/></svg>' : ''}
    <div class="card-art">${thumb(w)}</div>
    <div class="card-body">
      <div class="card-title"><h4>${esc(w.name)}</h4><span class="yr">${w.yearLabel ?? w.year}</span></div>
      <div class="sub">${esc(w.country)} · ${esc(CARTS[w.cart].name)}</div>
      <div class="kstats"><div><span>Eff. range</span><b>${km(w.eff)}</b></div><div><span>Per load</span><b>${w.capacity}</b></div><div><span>Energy</span><b>${fmt(w.energy)} J</b></div></div>
      <div class="tags"><span class="tag t-type">${TYPE_NAME[w.type]}</span>${units.map((u) => `<span class="tag t-unit">${USER_NAME[u]}</span>`).join('')}${w.wars.slice(0, 1).map((x) => `<span class="tag">${esc(x.replace(/ \(.*\)/, ''))}</span>`).join('')}</div>
    </div></button>`;
}

function renderGrid() {
  const list = filtered();
  $('#empty').hidden = list.length > 0;
  $('#result-count').textContent = `${list.length} of ${WEAPONS.length} weapons`;
  let html = '';
  if (F.sort === 'year' && F.era === 'all' && !F.q) {
    for (const e of ERAS.slice(1)) {
      const g = list.filter((w) => w.eras[0] === e.id);
      if (g.length) html += `<div class="era-head"><h3>${e.label}</h3><span>${e.years} · ${g.length}</span></div>` + g.map(card).join('');
    }
  } else html = list.map(card).join('');
  $('#grid').innerHTML = html;
}

function renderHero() {
  const picks = ['ak203', 'm82a1', 'insas', 'tavor', 'mg42', 'm1911', 'vidhwansak', 'negev', 'm4a1'];
  const w = byId[picks[Math.floor(Math.random() * picks.length)]];
  const sc = ['desert', 'mountain', 'range', 'urban'][Math.floor(Math.random() * 4)];
  $('#hero-scene').innerHTML = sceneSvg(sc);
  $('#hero-feat').innerHTML = `<div class="art">${renderWeapon(w).svg}</div>
    <div class="fstats"><span>RANGE <b>${km(w.eff)}</b></span><span>LOAD <b>${w.capacity}</b></span><span>${esc(CARTS[w.cart].name.split(' (')[0])}</span></div>
    <span class="cta"><svg><use href="#i-play"/></svg>Fire the ${esc(w.name)}</span>`;
  $('#hero-feat').onclick = () => go(w.id);
}
$('#grid').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) go(c.dataset.id); });

// ================================================================== SIMULATOR
const stage = $('#stage');
const gunWrap = $('#gun-wrap');
const overlay = $('#flash-overlay');
const particles = new Particles($('#fx'));
const weather = new Weather($('#weather'));
const S = {
  w: null, mode: 'semi', ammo: 0, reloading: false, cycling: false, trigger: false, heat: 0,
  timer: null, remaining: 0, nextT: 0, lastShot: 0, queue: [], series: false, token: 0, fired: 0,
  svg: null, flash: null, flashInner: null, meta: null, bank: null, rafOn: false, lastCase: 0, lastT: 0,
};
let navDir = 0;
const go = (id) => { location.hash = `#/w/${id}`; };
const order = () => (filtered().length ? filtered() : WEAPONS);
const scene = () => SCENES[settings.scene] || SCENES.range;
const hotAfter = (w) => (w.ammo === 'belt' ? (w.rotary ? 4000 : 250) : { 1: 1500, 2: 500, 3: 200, 4: 140, 5: 250 }[w.heat]);

function openWeapon(id) {
  stopFiring(true);
  S.token++;
  const w = byId[id];
  S.w = w; S.heat = 0; S.bank = null;
  S.mode = store.get('mode:' + id, w.modes[0]);
  if (!w.modes.includes(S.mode)) S.mode = w.modes[0];
  S.ammo = w.capacity; S.reloading = false; S.cycling = false;
  const { svg, meta } = renderWeapon(w, { fx: true });
  gunWrap.innerHTML = svg;
  S.svg = gunWrap.querySelector('svg'); S.flash = S.svg.querySelector('.flash'); S.flashInner = S.svg.querySelector('.flash-inner');
  S.meta = meta;
  const tok = S.token;
  audio.prepare(w).then((b) => { if (tok === S.token) S.bank = b; }).catch(() => {});
  const fit = { pistol: 0.52, smg: 0.8 }[w.type] ?? 1;
  gunWrap.style.setProperty('--fit', fit);
  const [bx, , bw] = meta.box;
  gunWrap.style.transformOrigin = `${(((meta.grip - bx) / bw) * 100).toFixed(1)}% 60%`;
  gunWrap.classList.remove('swap-in', 'reloading', 'cycling', 'spinning');
  gunWrap.style.setProperty('--from', `${navDir * 50}px`);
  void gunWrap.offsetWidth; gunWrap.classList.add('swap-in');
  navDir = 0;

  $('#w-name').textContent = w.name;
  const indiaChip = isIndian(w) ? (w.country.includes('India') ? '' : '<span><i class="tri"></i>Indian service</span>') : '';
  $('#w-meta').innerHTML = `${indiaChip}<span>${w.country.includes('India') ? '<i class="tri"></i>' : ''}${esc(w.country)}</span><span class="acc">${w.yearLabel ?? w.year}</span><span>${esc(CARTS[w.cart].name)}</span><span>${TYPE_NAME[w.type]}</span>`;
  document.title = `${w.name} — Arsenal`;
  $('#manual-title').textContent = `Field manual · ${w.name}`;
  const fb = $('[data-action="fav"]');
  fb.classList.toggle('on', favs.has(id)); $('use', fb).setAttribute('href', favs.has(id) ? '#i-star' : '#i-star-o');
  $('#reload-banner').hidden = true;
  $('.reload').classList.remove('attn', 'busy');
  renderModes(); renderAmmo(true); renderIntel(); renderEnvTag(); renderTab(); renderHeat();
}

// ------------------------------------------------------------------ intel rail + environment tag
function seg10(v, hot) { return `<div class="seg10 ${hot ? 'hot' : ''}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</div>`; }
function renderIntel() {
  const w = S.w, c = CARTS[w.cart];
  const el = $('#intel');
  el.innerHTML = `<h5><span>// INTEL</span><span>${MODE_SHORT[w.modes[0]]}${w.modes.length > 1 ? '+' : ''}</span></h5>
    <dl>
      <dt>Eff. range</dt><dd>${km(w.eff)}</dd>
      <dt>Max travel</dt><dd>~${km(w.max)}</dd>
      <dt>Per load</dt><dd>${w.capacity} rds</dd>
      <dt>Bullet</dt><dd>${c.d.toFixed(2)} mm · ${w.bulletG} g</dd>
      <dt>Velocity</dt><dd>${w.mv} m/s</dd>
      <dt>Energy</dt><dd>${fmt(w.energy)} J</dd>
      <dt>Rate</dt><dd>${rateLabel(w)}</dd>
      <dt>Accuracy</dt><dd>${esc(w.moa)}</dd>
    </dl>
    <div class="mbar"><span>Recoil</span>${seg10(w.feel.recoil)}</div>
    <div class="mbar"><span>Heat</span>${seg10(w.heat * 2, true)}</div>`;
}
$('#intel').addEventListener('click', () => $('#intel').classList.toggle('collapsed'));
function renderEnvTag() {
  const sc = scene(), key = SCENE_ENV_KEY[settings.scene];
  const ENV_IDX = { desert: 0, snow: 1, jungle: 2, mud: 3, altitude: 4 };
  let rel = '';
  if (S.w) {
    const vals = key ? [S.w.env[ENV_IDX[key]]] : settings.scene === 'mountain' ? [S.w.env[1], S.w.env[4]] : [Math.round(S.w.env.reduce((a, b) => a + b, 0) / 5)];
    const v = Math.min(...vals);
    rel = `<small>Reliability <span class="stars5">${stars(v)}</span></small>`;
  }
  $('#env-tag').innerHTML = `<svg><use href="#i-map"/></svg><span><b>${sc.label}</b>${rel}</span>`;
}

function renderModes() {
  $('#modes').innerHTML = S.w.modes.map((m) => `<button class="mode" role="radio" data-mode="${m}" aria-checked="${m === S.mode}"><span class="led"></span>${m === 'burst' ? `${S.w.burst ?? 3}-rd burst` : MODE_LABELS[m]}</button>`).join('');
}
$('#modes').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
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
    strip.innerHTML = w.capacity <= 40 ? Array.from({ length: w.capacity }, () => '<i class="round"></i>').join('') : '<div class="ammo-bar"><i></i></div>';
    $('#ammo-cal').textContent = CARTS[w.cart].name.split(' (')[0];
  }
  if (w.capacity <= 40) { const r = strip.children; for (let i = 0; i < r.length; i++) r[i].classList.toggle('spent', i >= S.ammo); }
  else strip.querySelector('.ammo-bar i').style.width = `${(S.ammo / w.capacity) * 100}%`;
  const c = $('#ammo-count');
  c.textContent = settings.infinite ? '∞' : `${S.ammo} / ${w.capacity}`;
  c.classList.toggle('low', !settings.infinite && S.ammo <= Math.ceil(w.capacity * 0.2));
}
function renderHeat() { $('#heat').style.width = `${Math.round(S.heat * 100)}%`; }

// ------------------------------------------------------------------ firing
const isAuto = () => S.mode === 'auto';
const minGap = () => { const w = S.w; if (w.rpm) return 60 / w.rpm; return w.type === 'pistol' ? 0.1 : w.ammo === 'bmg' ? 0.35 : 0.14; };
const hasAmmo = () => settings.infinite || S.ammo > 0;

async function pressTrigger() {
  await audio.unlock();
  S.trigger = true;
  $('#trigger').classList.add('down'); $('#hint').classList.add('gone');
  if (S.reloading || S.cycling || S.series) return;
  if (!hasAmmo()) return emptyClick();
  startSeries(S.mode === 'auto' ? Infinity : S.mode === 'burst' ? S.w.burst ?? 3 : 1);
}
function releaseTrigger() {
  S.trigger = false;
  $('#trigger').classList.remove('down');
  if (S.series && isAuto() && S.remaining === Infinity) stopFiring();
}
function emptyClick() {
  audio.dryFire(); Haptics.tick(8);
  $('#reload-banner').hidden = false; $('.reload').classList.add('attn');
  if (settings.autoreload) setTimeout(() => { if (!S.reloading && !hasAmmo()) reload(); }, 350);
}

function startSeries(n) {
  const w = S.w;
  S.series = true; S.remaining = n;
  let t0 = Math.max(audio.now + 0.01, S.lastShot + minGap());
  if (w.rotary) { audio.motorStart(); gunWrap.classList.add('spinning'); t0 = audio.now + 0.32; }
  S.nextT = t0;
  tick();
  clearInterval(S.timer);
  S.timer = setInterval(tick, 15);
}
function tick() {
  const w = S.w, gap = minGap(), now = audio.now, rapid = (w.rpm ?? 0) >= 900;
  while (S.remaining > 0 && S.nextT < now + 0.06) {
    if (!hasAmmo()) { stopFiring(); emptyClick(); return; }
    if (!settings.infinite) S.ammo--;
    const t = S.nextT;
    audio.shot(w, t, { rapid });
    S.queue.push({ t, rapid, last: !settings.infinite && S.ammo === 0, gap });
    S.lastShot = t; S.fired++; S.remaining--; S.nextT += gap;
  }
  if (S.remaining <= 0) {
    clearInterval(S.timer); S.timer = null;
    setTimeout(() => {
      S.series = false;
      if (w.rotary) { audio.motorStop(); gunWrap.classList.remove('spinning'); }
      if (S.mode === 'bolt' || S.mode === 'pump') cycleAction();
    }, Math.max(0, (S.lastShot - now + 0.01) * 1000));
  }
}
function stopFiring(hard = false) {
  clearInterval(S.timer); S.timer = null; S.remaining = 0;
  if (S.series) setTimeout(() => { S.series = false; }, Math.max(0, (S.lastShot - audio.now) * 1000));
  if (hard) { S.series = false; S.queue = []; }
  if (audio.motor) audio.motorStop();
  gunWrap.classList.remove('spinning');
}
function cycleAction() {
  const w = S.w, tok = S.token, pump = S.mode === 'pump';
  S.cycling = true;
  const t = audio.now + 0.22;
  if (pump) audio.pump(t); else audio.boltCycle(t, w.ammo === 'bmg' ? 0.8 : 1.15);
  setTimeout(() => {
    if (tok !== S.token) return;
    gunWrap.classList.remove('cycling'); void gunWrap.offsetWidth; gunWrap.classList.add('cycling');
    Haptics.seq(pump ? [30, 160, 34] : [18, 90, 22, 160, 26]);
    ejectShell(w);
  }, 260);
  setTimeout(() => { if (tok === S.token) S.cycling = false; }, pump ? 620 : w.ammo === 'bmg' ? 1200 : 860);
}

// ------------------------------------------------------------------ effects
function screenPoint(x, y) {
  if (!S.svg) return null;
  const m = S.svg.getScreenCTM(); if (!m) return null;
  const p = S.svg.createSVGPoint(); p.x = x; p.y = y;
  const r = stage.getBoundingClientRect(), q = p.matrixTransform(m);
  return { x: q.x - r.left, y: q.y - r.top, sx: q.x, sy: q.y };
}
function ejectShell(w) {
  if (!settings.particles) return;
  const e = screenPoint(S.meta.eject.x, S.meta.eject.y); if (!e) return;
  const shell = w.ammo === 'shell', c = CARTS[w.cart];
  const size = shell ? 1.6 : Math.max(0.7, Math.min(2.1, c.cl / 45));
  const soft = ['sand', 'snow'].includes(audio.ground);
  particles.floor = stage.clientHeight * 0.9;
  particles.shell(e.x, e.y, {
    dir: S.meta.ejectDir, down: S.meta.ejectDown, size, color: shell ? '#c0392b' : w.sound.steel ? '#8f8a6e' : undefined, sink: soft,
    onLand: () => {
      const now = audio.now;
      if (now - S.lastCase < 0.045) return; // don't stack hundreds of clinks in full-auto
      S.lastCase = now;
      audio.casing(now, { cart: c, shell, steel: w.sound.steel });
    },
  });
}

function shotFx(item) {
  const w = S.w, p = w.sound, fp = S.meta.flash, sc = scene();
  const k = w.feel.recoil / 10, soft = settings.softflash, night = sc.night;
  if (settings.recoil) {
    const jitter = item.rapid ? 0.55 + Math.random() * 0.5 : 1;
    const dist = (6 + k * 34) * jitter, rot = (1 + k * 7) * jitter;
    const dur = item.rapid || isAuto() ? Math.max(45, Math.min(item.gap * 1000 * 0.95, 120)) : 160 + k * 160;
    gunWrap.animate([{ transform: 'none' }, { transform: `translate(${-dist}px, ${-dist * 0.12}px) rotate(${-rot}deg)`, offset: 0.16 }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.15,.7,.3,1)' });
    if (p.power >= 0.75 && !soft) {
      const a = 3 + p.power * 9;
      stage.animate([{ transform: 'none' }, { transform: `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px)` }, { transform: 'none' }], { duration: 110 });
    }
  }
  // muzzle flash sprite — its own shape, size and duration per weapon
  if (S.flash) {
    const base = +S.flashInner.dataset.s, s = base * (0.8 + Math.random() * 0.4) * (night ? 1.25 : 1);
    S.flashInner.setAttribute('transform', `scale(${s.toFixed(2)} ${(s * (0.8 + Math.random() * 0.45)).toFixed(2)}) rotate(${((Math.random() - 0.5) * 12).toFixed(1)})`);
    S.flash.animate([{ opacity: soft ? 0.35 : 1 }, { opacity: soft ? 0.2 : 0.85, offset: 0.3 }, { opacity: 0 }], { duration: item.rapid ? Math.min(45, fp.dur) : fp.dur, easing: 'ease-out' });
  }
  const mz = screenPoint(S.meta.muzzle.x, 0);
  if (settings.flash && mz) {
    overlay.style.setProperty('--fx', `${mz.sx}px`); overlay.style.setProperty('--fy', `${mz.sy}px`);
    overlay.style.setProperty('--fc0', fp.color[0]); overlay.style.setProperty('--fc1', fp.color[2] + '88');
    const peak = soft ? 0.08 : Math.min(0.95, fp.screen * (1 + night * 0.6));
    overlay.animate([{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: 0 }], { duration: item.rapid ? 50 : fp.dur + 40 });
  }
  if (settings.torch && !soft) Torch.pattern(item.rapid ? [35] : fp.torch);
  Haptics.shot(w, S.bank, { rapid: item.rapid || isAuto(), interval: item.gap * 1000 });
  if (settings.particles && mz) {
    if (!item.rapid || Math.random() < 0.35) particles.smoke(mz.x, mz.y, p.power, sc.smoke);
    if (!soft) particles.sparks(mz.x, mz.y, item.rapid ? 0.5 : 1 + p.power);
    if (fp.shape === 'brake') particles.dust(mz.x - 10, mz.y, 1.4, sc.dust);
  }
  if (S.mode !== 'bolt' && S.mode !== 'pump' && (!item.rapid || Math.random() < 0.6)) ejectShell(w);
  if (w.ping && item.last) {
    audio.clipPing(audio.now + 0.09);
    const e = screenPoint(S.meta.eject.x, S.meta.eject.y);
    if (e && settings.particles) particles.shell(e.x, e.y, { dir: 0.4, size: 1.6, color: '#5a5f66' });
    toast('PING! — empty en-bloc clip ejected', 1600);
  }
  S.heat = Math.min(1, S.heat + 1 / hotAfter(w));
  renderAmmo(false);
  if (item.last) { $('#reload-banner').hidden = false; $('.reload').classList.add('attn'); }
}

function frame(ts) {
  if (!S.rafOn) return;
  const now = audio.now;
  while (S.queue.length && S.queue[0].t <= now + 0.004) shotFx(S.queue.shift());
  // barrel cools ~4%/s; a hot barrel shimmers with smoke
  const dt = Math.min(0.1, (ts - (S.lastT || ts)) / 1000); S.lastT = ts;
  if (S.heat > 0) {
    S.heat = Math.max(0, S.heat - dt * 0.04);
    if (S.heat > 0.65 && settings.particles && Math.random() < dt * 6 * S.heat) {
      const mz = screenPoint(S.meta.muzzle.x - 40, -8); if (mz) particles.smoke(mz.x, mz.y, 0.3, '#e6e9ec');
    }
    renderHeat();
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ reload
function reload() {
  const w = S.w;
  if (S.reloading || settings.infinite || S.ammo === w.capacity) return;
  stopFiring();
  const tok = S.token;
  const dur = w.ammo === 'shell' ? Math.min(3.2, 0.6 + (w.capacity - S.ammo) * 0.4)
    : w.ammo === 'belt' ? 3.2 : w.ammo === 'bmg' ? 2.8 : w.type === 'pistol' ? 1.4
    : w.modes.includes('bolt') ? 2.4 : w.type === 'smg' ? 1.9 : 2.2;
  S.reloading = true;
  const t = audio.now;
  if (w.ammo === 'shell') {
    for (let i = 0; i < w.capacity - S.ammo; i++) { audio.click(t + 0.3 + i * 0.4, 1300, 0.3, 0.05, 2); audio.click(t + 0.36 + i * 0.4, 2400, 0.15, 0.03); }
  } else if (w.ammo === 'belt') { audio.beltLoad(t + 0.2); audio.click(t + 1.6, 1000, 0.4, 0.06, 2); audio.charge(t + dur - 0.5); }
  else if (w.modes.includes('bolt') || w.ping) { audio.click(t + 0.15, 1600, 0.3, 0.04); audio.magIn(t + dur * 0.5); audio.boltCycle(t + dur - 0.55, 1.3); }
  else { audio.magOut(t + 0.15); audio.magIn(t + dur * 0.55); if (S.ammo === 0) audio.charge(t + dur * 0.75); }
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
function bindHold(el, ignoreButtons = false) {
  el.addEventListener('pointerdown', (e) => {
    if (ignoreButtons && e.target.closest('button, .intel')) return;
    if (e.button > 0) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    pressTrigger();
  });
  const up = () => { if (S.trigger) releaseTrigger(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, up));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindHold(stage, true);
bindHold($('#trigger'));

document.addEventListener('keydown', (e) => {
  if ($('#view-sim').hidden || e.target.matches('input, select, textarea') || $('#settings').open || $('#scenes').open) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) pressTrigger(); }
  else if (e.key === 'r' || e.key === 'R') reload();
  else if (e.key === 'm' || e.key === 'M') { const m = S.w.modes; setMode(m[(m.indexOf(S.mode) + 1) % m.length]); }
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'i' || e.key === 'I') toggleManual();
  else if (e.key === 'e' || e.key === 'E') openScenes();
  else if (e.key === 'f' || e.key === 'F') fullscreen();
  else if (e.key === 'Escape' && !$('#manual').classList.contains('open')) location.hash = '#/';
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'Enter') releaseTrigger(); });

function step(d) {
  const list = order();
  let i = list.findIndex((w) => w.id === S.w.id); if (i < 0) i = 0;
  navDir = d;
  location.replace(`#/w/${list[(i + d + list.length) % list.length].id}`);
}

// ------------------------------------------------------------------ toggles
async function toggle(name) {
  const btn = $(`[data-tog="${name}"]`);
  if (name === 'sound') { settings.sound = !settings.sound; audio.setMuted(!settings.sound); if (settings.sound) audio.unlock(); }
  else if (name === 'vibrate') {
    if (!Haptics.supported) { toast('Vibration isn\'t available here (iPhone & desktop browsers block it). Try Chrome on Android.'); return; }
    settings.vibrate = !settings.vibrate; Haptics.enabled = settings.vibrate; if (settings.vibrate) Haptics.seq([40, 60, 20]);
  } else if (name === 'flash') settings.flash = !settings.flash;
  else if (name === 'torch') {
    if (settings.torch) { settings.torch = false; Torch.disable(); }
    else {
      if (!Torch.possible || !window.isSecureContext) { toast('Flashlight needs HTTPS and a camera-enabled browser.'); btn.classList.add('na'); return; }
      try { btn.classList.add('na'); await Torch.enable(); settings.torch = true; btn.classList.remove('na'); toast('Flashlight armed — each weapon has its own flash pattern'); Torch.pattern([120]); }
      catch (err) { btn.classList.add('na'); toast(err.name === 'NotAllowedError' ? 'Camera permission denied — flashlight unavailable.' : err.message, 3600); return; }
    }
  } else if (name === 'shake') {
    if (!settings.shake) {
      if (typeof DeviceMotionEvent === 'undefined') { toast('Motion sensors aren\'t available on this device.'); return; }
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        try { if ((await DeviceMotionEvent.requestPermission()) !== 'granted') { toast('Motion permission denied.'); return; } } catch { toast('Motion permission denied.'); return; }
      }
      settings.shake = true; window.addEventListener('devicemotion', onMotion); toast('Shake your phone to fire!');
    } else { settings.shake = false; window.removeEventListener('devicemotion', onMotion); }
  }
  saveSettings(); syncToggles();
}
function syncToggles() {
  for (const n of ['sound', 'vibrate', 'flash', 'torch', 'shake']) { const b = $(`[data-tog="${n}"]`); b.classList.toggle('on', !!settings[n]); b.setAttribute('aria-pressed', !!settings[n]); }
  if (!Haptics.supported) $('[data-tog="vibrate"]').classList.add('na');
}
$('.sim-right').addEventListener('click', (e) => { const b = e.target.closest('[data-tog]'); if (b) toggle(b.dataset.tog); });

let lastShake = 0;
function onMotion(e) {
  if ($('#view-sim').hidden) return;
  const lin = e.acceleration && e.acceleration.x != null, a = lin ? e.acceleration : e.accelerationIncludingGravity;
  if (!a) return;
  const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0), now = performance.now();
  if (mag > (lin ? 15 : 25) && now - lastShake > 280) {
    lastShake = now;
    if (S.reloading || S.cycling || S.series) return;
    if (!hasAmmo()) return emptyClick();
    audio.unlock().then(() => startSeries(S.mode === 'auto' ? 5 : S.mode === 'burst' ? S.w.burst ?? 3 : 1));
  }
}

// ------------------------------------------------------------------ scenes
function applyScene(id, announce = false) {
  settings.scene = SCENES[id] ? id : 'range'; saveSettings();
  const sc = scene();
  const el = $('#scene'); el.innerHTML = sceneSvg(settings.scene); el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
  audio.setEnvironment(sc.env);
  if (settings.weather && !$('#view-sim').hidden) weather.set(sc.weather); else weather.stop();
  renderEnvTag();
  if (S.w && tab === 'intel') renderTab();
  if (announce) toast(`${sc.label} — ${sc.sub}`, 1600);
}
function openScenes() {
  const ENV_IDX = { desert: 0, snow: 1, jungle: 2, mud: 3, altitude: 4 };
  $('#scene-grid').innerHTML = SCENE_ORDER.map((id) => {
    const sc = SCENES[id], key = SCENE_ENV_KEY[id];
    const v = S.w ? (key ? S.w.env[ENV_IDX[key]] : id === 'mountain' ? Math.min(S.w.env[1], S.w.env[4]) : Math.round(S.w.env.reduce((a, b) => a + b, 0) / 5)) : 0;
    return `<button class="scene-card" data-scene="${id}" aria-pressed="${id === settings.scene}">${sceneSvg(id)}<span class="lbl"><b>${sc.label}</b><small><span>${sc.sub}</span>${S.w ? `<span class="stars5">${stars(v)}</span>` : ''}</small></span></button>`;
  }).join('');
  $('#scenes').showModal();
}
$('#scene-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-scene]'); if (!b) return;
  applyScene(b.dataset.scene, true); $('#scenes').close();
});

// ------------------------------------------------------------------ actions
async function fullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
    } else await document.exitFullscreen();
  } catch { toast('Fullscreen not supported here — add Arsenal to your home screen instead.'); }
}
function toggleManual(force) { const m = $('#manual'); m.classList.toggle('open', force ?? !m.classList.contains('open')); }

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  if (a === 'back') location.hash = '#/';
  else if (a === 'info') toggleManual();
  else if (a === 'settings') openSettings();
  else if (a === 'scenes') openScenes();
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
let tab = 'intel';
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  tab = b.dataset.tab; $$('#tabs button').forEach((x) => x.setAttribute('aria-selected', x === b)); renderTab();
});

/** Cartridge drawn to scale next to a 9mm reference. */
function cartridgeSvg(w) {
  const list = [CARTS[w.cart]];
  if (w.cart !== '9x19') list.push(CARTS['9x19']);
  const S2 = 2.2, H = 170 * S2 > 380 ? 380 : 170 * S2;
  const maxL = Math.max(...list.map((c) => c.oal));
  const sc = Math.min(S2, 320 / maxL);
  let x = 70, out = '';
  list.forEach((c, i) => {
    const L = c.oal * sc, cl = c.cl * sc, bw = c.base * sc, dw = c.d * sc, base = 200;
    const cx = x + bw / 2;
    if (c.shell) {
      out += `<rect x="${x}" y="${base - L}" width="${bw}" height="${L}" fill="#b71c1c"/><rect x="${x}" y="${base - 10 * sc}" width="${bw}" height="${10 * sc}" fill="#d6a84a"/>`;
    } else {
      const neck = Math.min(cl, cl - (c.pistol ? 0 : 6 * sc)), shoulder = c.pistol ? cl : cl * 0.78, rim = (c.rim ?? c.base) * sc;
      out += `<path d="M${cx - rim / 2} ${base} L${cx + rim / 2} ${base} L${cx + rim / 2} ${base - 2.2 * sc} L${cx + bw / 2} ${base - 3 * sc} L${cx + bw / 2 * 0.97} ${base - shoulder} L${cx + dw / 2 + 0.6} ${base - neck} L${cx + dw / 2 + 0.6} ${base - cl} L${cx - dw / 2 - 0.6} ${base - cl} L${cx - dw / 2 - 0.6} ${base - neck} L${cx - bw / 2 * 0.97} ${base - shoulder} L${cx - bw / 2} ${base - 3 * sc} L${cx - rim / 2} ${base - 2.2 * sc} Z" fill="#d6a84a" stroke="#7a5414"/>`;
      const bl = L - cl;
      out += `<path d="M${cx - dw / 2} ${base - cl} L${cx - dw / 2} ${base - cl - bl * 0.45} Q${cx - dw / 2} ${base - L + 2} ${cx} ${base - L} Q${cx + dw / 2} ${base - L + 2} ${cx + dw / 2} ${base - cl - bl * 0.45} L${cx + dw / 2} ${base - cl} Z" fill="#c26d3a" stroke="#6a3410"/>`;
    }
    out += `<text x="${cx}" y="${base + 18}" text-anchor="middle" fill="${i ? '#8ea096' : '#a3f53a'}" font-family="Share Tech Mono, monospace" font-size="11">${c.name.split(' (')[0]}</text>`;
    out += `<text x="${cx}" y="${base - L - 8}" text-anchor="middle" fill="#8ea096" font-family="Share Tech Mono, monospace" font-size="10">${c.oal} mm</text>`;
    x += Math.max(bw / 2, c.name.split(' (')[0].length * 3.4) + Math.max(bw / 2, 60) + 40;
  });
  // ruler (10 mm ticks)
  let ruler = '';
  for (let mm = 0; mm <= Math.ceil(maxL / 10) * 10; mm += 10) ruler += `<line x1="8" x2="${mm % 50 ? 13 : 18}" y1="${200 - mm * sc}" y2="${200 - mm * sc}" stroke="#5b6b63"/>`;
  return `<svg class="viz" viewBox="0 0 ${Math.max(x, 220)} 230" style="max-height:${H}px">${ruler}<line x1="8" x2="8" y1="200" y2="${200 - maxL * sc}" stroke="#5b6b63"/>${out}</svg>
    <p class="viz-note">Drawn to scale. Bullet Ø ${CARTS[w.cart].d} mm · bullet ${w.bulletG} g · case ${CARTS[w.cart].cl} mm.</p>`;
}

/** Effective range vs maximum bullet travel, on a log scale with real-world markers. */
function rangeSvg(w) {
  const X = (m) => 10 + (Math.log10(Math.max(10, m)) - 1) / (Math.log10(10000) - 1) * 300;
  const marks = [[100, 'Football field'], [1000, '1 km'], [5000, '5 km']];
  return `<svg class="viz" viewBox="0 0 320 74">
    ${marks.map(([m, l]) => `<line x1="${X(m)}" x2="${X(m)}" y1="10" y2="50" stroke="#2b3a34" stroke-dasharray="2 3"/><text x="${X(m)}" y="66" fill="#5b6b63" font-family="Share Tech Mono, monospace" font-size="9" text-anchor="middle">${l}</text>`).join('')}
    <rect x="${X(10)}" y="22" width="${X(w.max) - X(10)}" height="16" fill="rgba(255,194,58,.18)"/>
    <rect x="${X(10)}" y="22" width="${X(w.eff) - X(10)}" height="16" fill="#a3f53a"/>
    <text x="${X(w.eff) - 4}" y="34" fill="#0b1402" font-family="Share Tech Mono, monospace" font-size="10" text-anchor="end">${km(w.eff)}</text>
    <text x="${Math.min(X(w.max) - 4, 316)}" y="16" fill="#ffc23a" font-family="Share Tech Mono, monospace" font-size="9.5" text-anchor="end">max travel ~${km(w.max)}</text>
  </svg><p class="viz-note">Green = effective (aimed) range. Amber = how far the bullet can still travel and cause harm. Time to 100 m ≈ ${(100 / w.mv).toFixed(2)} s (Mach ${(w.mv / 343).toFixed(1)}).</p>`;
}

function envBars(w) {
  const keys = Object.keys(ENV_LABELS), curKey = SCENE_ENV_KEY[settings.scene];
  return `<div class="envs">${keys.map((k, i) => {
    const v = w.env[i];
    const cur = k === curKey || (settings.scene === 'mountain' && (k === 'snow' || k === 'altitude'));
    return `<div class="row ${cur ? 'cur' : ''}"><span>${ENV_LABELS[k]}</span><span class="bar5 ${v <= 2 ? 'bad' : v === 3 ? 'lo' : ''}">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= v ? 'on' : ''}"></i>`).join('')}</span><b>${v}/5</b></div>`;
  }).join('')}</div>
  ${w.envNote ? `<p class="viz-note">⚠ ${esc(w.envNote)}</p>` : ''}
  <p class="viz-note">In water: ordinary firearms are not designed to fire submerged — a bullet stops within 1–2 m and the gun can be damaged. In thin high-altitude air bullets fly slightly flatter and further; extreme cold thickens lubricants and stiffens springs.</p>`;
}

function hapticSvg(w) {
  const pat = Haptics.fromEnvelope(w, S.bank);
  const total = pat.reduce((a, b) => a + b, 0);
  let x = 0, out = '';
  pat.forEach((d, i) => { const wd = (d / total) * 300; if (i % 2 === 0) out += `<rect x="${x}" y="6" width="${Math.max(1.5, wd)}" height="26" fill="#a3f53a"/>`; x += wd; });
  let env = '';
  if (S.bank) { const e = S.bank.envelope, n = Math.min(e.length, Math.ceil(total / S.bank.frameMs)); env = `<polyline fill="none" stroke="#45d4ff" stroke-width="1.2" points="${Array.from({ length: n }, (_, i) => `${(i / n) * 300},${32 - e[i] * 26}`).join(' ')}"/>`; }
  return `<svg class="viz" viewBox="0 0 300 38">${out}${env}</svg>
    <p class="viz-note">Green = vibration pulses for one shot (${total} ms). Blue = this weapon's actual sound envelope it was built from — the first pulse is the recoil kick.</p>`;
}

function renderTab() {
  const w = S.w, b = $('#tab-body'), c = CARTS[w.cart], fp = S.meta.flash;
  if (tab === 'intel') {
    b.innerHTML = `<div class="tiles">
        <div class="tile"><span>Effective range</span><b>${km(w.eff)}</b><small>${w.range.replace(/[~ ]/g, '') === km(w.eff).replace(/ /g, '') ? 'Aimed fire' : esc(w.range)}</small></div>
        <div class="tile"><span>Max bullet travel</span><b>~${km(w.max)}</b><small>Danger zone in air</small></div>
        <div class="tile"><span>Rounds per load</span><b>${w.capacity}</b><small>${FEED(w)}</small></div>
        <div class="tile"><span>Rate of fire</span><b>${rateLabel(w)}</b><small>${w.modes.map((m) => MODE_SHORT[m]).join(' · ')}</small></div>
        <div class="tile"><span>Bullet</span><b>${c.d.toFixed(2)} mm</b><small>${esc(c.name)} · ${w.bulletG} g</small></div>
        <div class="tile"><span>Muzzle energy</span><b>${fmt(w.energy)} J</b><small>${(w.energy / 560).toFixed(1)}× a 9mm pistol</small></div>
        <div class="tile"><span>Muzzle velocity</span><b>${w.mv} m/s</b><small>Mach ${(w.mv / 343).toFixed(1)} · ${w.mv > 343 ? 'supersonic crack' : 'subsonic'}</small></div>
        <div class="tile"><span>Accuracy</span><b>${esc(w.moa)}</b><small>1 MOA ≈ 3 cm at 100 m</small></div>
        <div class="tile wide"><span>Heat</span><b>${['', 'Very low', 'Low', 'Moderate', 'High', 'Very high'][w.heat]}</b><small>${esc(w.heatNote)}</small></div>
        <div class="tile"><span>Weight</span><b>${esc(w.weight)}</b></div>
        <div class="tile"><span>Length</span><b>${esc(w.length)}</b></div>
      </div>
      <h3>Range</h3>${rangeSvg(w)}
      <h3>Ammunition to scale</h3>${cartridgeSvg(w)}
      <h3>Field reliability</h3>${envBars(w)}
      <h3>Used by</h3><div class="wars">${w.users.map((u) => `<span class="${INDIAN_UNITS.has(u) ? 'unit' : ''}">${USER_NAME[u]}</span>`).join('')}</div>
      <h3>Full specification</h3>
      <table class="specs">${[['Calibre', w.caliber], ['Action', w.action], ['Fire modes', w.modes.map((m) => MODE_LABELS[m]).join(', ')], ['Designer', w.designer], ['Country', w.country], ['Introduced', w.yearLabel ?? w.year]].map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
      <p class="viz-note">Typical published values; they vary by variant and ammunition. Reliability ratings are editorial estimates.</p>`;
  } else if (tab === 'overview') {
    b.innerHTML = `${w.nickname ? `<p class="nick">${esc(w.nickname)}</p>` : ''}<p class="lead">${esc(w.overview)}</p>
      <div class="facts">
        <div class="tile"><span>Country</span><b>${esc(w.country)}</b></div><div class="tile"><span>Introduced</span><b>${w.yearLabel ?? w.year}</b></div>
        <div class="tile wide"><span>Designer</span><b>${esc(w.designer)}</b></div>
      </div>
      <h3>Service history</h3><p>${esc(w.history)}</p>
      <h3>Service &amp; conflicts</h3><div class="wars">${w.wars.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      <h3>Eras</h3><div class="wars">${w.eras.map((e) => `<span>${ERA_NAME[e]}</span>`).join('')}</div>
      <h3>Did you know?</h3><ul class="trivia">${w.trivia.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  } else if (tab === 'how') {
    b.innerHTML = `<p class="lead">${esc(w.action)}</p>
      <button class="btn-ghost" id="walk"><svg><use href="#i-play"/></svg>Walk through the cycle</button>
      <ol class="steps" style="margin-top:12px">${w.how.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
    $('#walk').onclick = walkCycle;
  } else if (tab === 'feel') {
    const rate = w.rpm ? Math.min(10, Math.round((Math.log10(w.rpm / 100) / Math.log10(30)) * 10)) : 1;
    b.innerHTML = `<div class="meters">${[['Recoil', w.feel.recoil], ['Loudness', w.feel.loud], ['Fire rate', rate], ['Energy', Math.min(10, Math.max(1, Math.round(Math.log10(w.energy / 300) * 6)))]].map(([l, v]) => `<div class="meter"><span>${l}</span>${seg10(v)}<b>${v}</b></div>`).join('')}</div>
      <p class="lead" style="margin-top:14px">${esc(w.feel.text)}</p>
      <h3>Vibration signature</h3>${hapticSvg(w)}
      <h3>Muzzle flash</h3>
      <p>${{ cage: 'Flash hider: a small, quick "flower" of flame.', brake: 'Muzzle brake: gas and flame blast out sideways — expect a dust cloud.', ball: 'Shotgun: a big orange fireball.', cone: 'Recoil booster: a long forward cone of flame.', comp: 'Compensator: flame jets upward to hold the muzzle down.', pistol: 'Short pistol barrel: a small, warm flash.', star: 'No flash suppression: a full star-shaped flash.' }[fp.shape]} Lasts ~${fp.dur} ms; flashlight pattern ${fp.torch.join('/')} ms.</p>
      <div class="feel-actions"><button class="btn-ghost" id="feel-vibe"><svg><use href="#i-vibe"/></svg>Feel one shot</button><button class="btn-ghost" id="feel-hear"><svg><use href="#i-sound"/></svg>Hear one shot</button></div>`;
    $('#feel-vibe').onclick = () => { if (!Haptics.supported) toast('Vibration isn\'t available on this device.'); Haptics.shot(w, S.bank); };
    $('#feel-hear').onclick = async () => { await audio.unlock(); audio.shot(w); };
    if (!S.bank) audio.prepare(w).then((bk) => { S.bank = bk; if (tab === 'feel' && S.w === w) renderTab(); });
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
  $('#s-volume').value = settings.volume; $('#s-amb').value = settings.amb; $('#s-haptic').value = settings.haptic;
  ['infinite', 'autoreload', 'recoil', 'particles', 'weather', 'softflash'].forEach((k) => { $(`#s-${k}`).checked = settings[k]; });
  $('#cap-note').textContent = [
    `Vibration: ${Haptics.supported ? 'supported' : 'not supported in this browser'}`,
    `Flashlight: ${Torch.possible && window.isSecureContext ? 'may be available (Chrome on Android)' : 'unavailable'}`,
    `Audio: ${window.AudioContext || window.webkitAudioContext ? 'ready' : 'missing'}`,
  ].join(' · ');
  $('#settings').showModal();
}
$('#settings').addEventListener('input', (e) => {
  const t = e.target, k = t.id.replace('s-', '');
  if (k === 'volume') { settings.volume = +t.value; audio.setVolume(settings.volume); }
  else if (k === 'amb') { settings.amb = +t.value; audio.setAmbientVolume(settings.amb); }
  else if (k === 'haptic') { settings.haptic = +t.value; Haptics.intensity = settings.haptic; Haptics.reset(); Haptics.seq([60]); }
  else if (t.type === 'checkbox') settings[k] = t.checked;
  if (k === 'infinite' && S.w) { S.ammo = S.w.capacity; renderAmmo(false); }
  if (k === 'weather') applyScene(settings.scene);
  saveSettings();
});
[$('#settings'), $('#scenes')].forEach((d) => d.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }));

// ------------------------------------------------------------------ routing & lifecycle
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not allowed */ }
}
const portraitMq = window.matchMedia('(orientation: portrait) and (max-width: 720px)');
let rotateSkipped = false;
function checkRotate() { $('#rotate').hidden = !(portraitMq.matches && !$('#view-sim').hidden && !rotateSkipped); }
portraitMq.addEventListener?.('change', () => { checkRotate(); setTimeout(() => { particles.resize(); weather.set(settings.weather ? scene().weather : null); }, 300); });
$('#rotate-skip').onclick = () => { rotateSkipped = true; checkRotate(); };

function route() {
  const m = location.hash.match(/^#\/w\/([\w-]+)/);
  if (m && byId[m[1]]) {
    const entering = $('#view-sim').hidden;
    $('#view-armory').hidden = true; $('#view-sim').hidden = false;
    if (entering) {
      applyScene(settings.scene);
      if (audio.ready) audio.startAmbient(); else audio.ambientOn = true;
    }
    openWeapon(m[1]);
    particles.resize();
    if (!S.rafOn) { S.rafOn = true; requestAnimationFrame(frame); }
    keepAwake(true);
  } else {
    stopFiring(true);
    S.rafOn = false; toggleManual(false);
    if (settings.torch) { settings.torch = false; Torch.disable(); syncToggles(); }
    audio.stopAmbient(); weather.stop();
    $('#view-sim').hidden = true; $('#view-armory').hidden = false;
    document.title = 'Arsenal — Gun Simulator & Field Manual';
    keepAwake(false);
  }
  checkRotate();
}
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { releaseTrigger(); stopFiring(); Haptics.stop(); }
  else if (!$('#view-sim').hidden) keepAwake(true);
});
window.addEventListener('pointerdown', async () => {
  await audio.unlock();
  if (audio.ambientOn && !audio.amb && !$('#view-sim').hidden) audio.startAmbient();
}, { capture: true });

function gate() {
  if (store.get('gated', false)) return;
  const g = $('#gate'); g.hidden = false;
  $('#gate-go').onclick = async () => { await audio.unlock(); store.set('gated', true); g.hidden = true; Haptics.seq([30, 60, 30]); };
}

// ------------------------------------------------------------------ boot
buildFilters(); renderGrid(); renderHero(); syncToggles(); route(); gate();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
