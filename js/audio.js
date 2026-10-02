// Gunfire audio engine (Web Audio API).
//
// Each weapon's shot is synthesised once per variant into an AudioBuffer with an
// OfflineAudioContext, then played back with small pitch/level changes. Rendering
// offline lets us (1) fire 3,000 rpm cheaply and (2) read the shot's loudness
// envelope, which drives the vibration pattern so the phone "feels" the sound.

// Acoustic spaces. ground = what spent cases land on.
export const ENVIRONMENTS = {
  range:    { len: 1.6, decay: 3.2, wet: 0.34, pre: 0.02, damp: 9000, ground: 'concrete', ambient: 'breeze' },
  desert:   { len: 1.1, decay: 5.0, wet: 0.16, pre: 0.01, damp: 7000, ground: 'sand', ambient: 'wind' },
  mountain: { len: 3.6, decay: 1.7, wet: 0.5, pre: 0.12, damp: 5000, ground: 'snow', ambient: 'wind', echoes: 6 },
  jungle:   { len: 1.5, decay: 3.4, wet: 0.42, pre: 0.008, damp: 3200, ground: 'dirt', ambient: 'jungle' },
  urban:    { len: 2.3, decay: 2.5, wet: 0.48, pre: 0.035, damp: 8000, ground: 'asphalt', ambient: 'city', echoes: 12 },
  night:    { len: 1.9, decay: 3.0, wet: 0.3, pre: 0.02, damp: 6000, ground: 'grass', ambient: 'crickets' },
  indoor:   { len: 0.8, decay: 2.2, wet: 0.62, pre: 0.004, damp: 10000, ground: 'concrete', ambient: 'hvac' },
};

// Ground surfaces for casing drops.
const SURFACES = {
  concrete: { ring: 1, rdecay: 0.16, thud: 0.25, bounces: 4, roll: 0.5 },
  asphalt:  { ring: 0.8, rdecay: 0.12, thud: 0.35, bounces: 3, roll: 0.4 },
  wood:     { ring: 0.45, rdecay: 0.06, thud: 0.6, bounces: 3, roll: 0.2, knock: 380 },
  dirt:     { ring: 0.1, rdecay: 0.03, thud: 0.7, bounces: 1, roll: 0 },
  grass:    { ring: 0.05, rdecay: 0.02, thud: 0.45, bounces: 1, roll: 0 },
  sand:     { ring: 0.03, rdecay: 0.02, thud: 0.4, bounces: 0, roll: 0, soft: true },
  snow:     { ring: 0, rdecay: 0.01, thud: 0.22, bounces: 0, roll: 0, soft: true },
};

const noiseCache = new WeakMap();
function noiseBuf(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, b);
  return b;
}
const curveCache = new Map();
function softClip(amt) {
  if (curveCache.has(amt)) return curveCache.get(amt);
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = ((1 + amt) * x) / (1 + amt * Math.abs(x)); }
  curveCache.set(amt, c);
  return c;
}

// ------------------------------------------------------------------ synthesis primitives (any context)
function env(g, t, peak, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function noise(ctx, t, dur, rate = 1) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.playbackRate.value = rate;
  s.start(t, Math.random() * 1.4, dur + 0.05); return s;
}
function filt(ctx, type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }

/** Metallic clank: noise transient + ringing partials. */
function metal(ctx, dest, t, f, gain, dur = 0.05, q = 5, ring = 0.5) {
  const n = noise(ctx, t, dur), g = ctx.createGain(); env(g, t, gain, 0.0008, dur);
  chain(n, filt(ctx, 'bandpass', f, q), g, dest);
  if (ring > 0) [1, 2.41, 3.9].forEach((p, i) => {
    const o = ctx.createOscillator(); o.frequency.value = f * p * (0.98 + Math.random() * 0.04);
    const og = ctx.createGain(); env(og, t, gain * ring * 0.35 / (i + 1), 0.001, dur * 2.2 / (i + 1));
    o.connect(og); og.connect(dest); o.start(t); o.stop(t + dur * 3 + 0.05);
  });
}

/** Supersonic bullet "crack": an N-wave pressure signature plus a hiss of shock noise. */
function nWave(ctx, dest, t, amp, widthMs) {
  const sr = ctx.sampleRate, n = Math.max(8, Math.round((widthMs / 1000) * sr)), pad = 32;
  const b = ctx.createBuffer(1, n + pad, sr), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = 1 - (2 * i) / n; // sharp rise, linear fall, sharp return
  const s = ctx.createBufferSource(); s.buffer = b;
  const g = ctx.createGain(); g.gain.value = amp;
  chain(s, filt(ctx, 'highpass', 400), g, dest); s.start(t);
}

const MECH = {
  slide:  [[0.012, 3000, 0.22, 0.02, 6], [0.045, 1900, 0.2, 0.025, 5], [0.05, 650, 0.12, 0.03, 3]],
  gas:    [[0.022, 2300, 0.14, 0.025, 5], [0.07, 1500, 0.13, 0.03, 4]],
  ak:     [[0.02, 1700, 0.15, 0.03, 4], [0.075, 950, 0.26, 0.05, 3], [0.08, 2600, 0.12, 0.02, 6]],
  ar:     [[0.018, 2600, 0.12, 0.02, 6], [0.06, 1800, 0.12, 0.025, 5]],
  roller: [[0.014, 3600, 0.22, 0.015, 8], [0.05, 2800, 0.2, 0.018, 8]],
  'bolt-open': [[0.03, 1300, 0.2, 0.035, 3]],
  'bolt-closed': [[0.025, 2400, 0.12, 0.02, 5]],
  garand: [[0.025, 1400, 0.18, 0.04, 3], [0.085, 2100, 0.18, 0.03, 5]],
  heavy:  [[0.05, 700, 0.3, 0.07, 2.5], [0.12, 1100, 0.24, 0.06, 3], [0.16, 520, 0.18, 0.08, 2]],
};

/** Render one complete gunshot into `dest` starting at time t. */
export function synthShot(ctx, dest, w, t = 0) {
  const p = w.sound, mz = w.art?.muzzle?.style;
  const v = 0.9 + Math.random() * 0.2;
  const out = ctx.createGain(); out.gain.value = 0.55 + p.power * 0.45; out.connect(dest);
  const bus = ctx.createDynamicsCompressor(); // per-shot "mic overload" glue
  bus.threshold.value = -14; bus.ratio.value = 6; bus.attack.value = 0.0005; bus.release.value = 0.08;
  bus.connect(out);

  // 1. muzzle impulse — the instantaneous pressure spike
  { const n = noise(ctx, t, 0.006, 1.4), g = ctx.createGain(); env(g, t, 1.4 * v, 0.0002, 0.004 + p.power * 0.004); chain(n, g, bus); }
  // 2. supersonic N-wave crack + shock hiss
  if (p.crack > 0.2) {
    nWave(ctx, bus, t + 0.0008, p.crack * 0.9 * v, 0.18 + (w.bulletG ?? 8) / 140);
    const n = noise(ctx, t, 0.03, 1.3), g = ctx.createGain(); env(g, t, p.crack * 0.55, 0.0004, 0.01 + p.power * 0.012);
    chain(n, filt(ctx, 'highpass', 3000), g, bus);
  }
  // 3. muzzle blast — saturated noise through a closing low-pass
  {
    const d = p.decay * (0.9 + Math.random() * 0.2);
    const n = noise(ctx, t, d + 0.1, 0.85 + Math.random() * 0.3);
    const lp = filt(ctx, 'lowpass', p.bright * v, 0.9);
    lp.frequency.setValueAtTime(p.bright * v, t); lp.frequency.exponentialRampToValueAtTime(140 + p.thump, t + d);
    const body = filt(ctx, 'peaking', p.thump * 2.2, 1.2); body.gain.value = 7;
    const sh = ctx.createWaveShaper(); sh.curve = softClip(4 + p.power * 8);
    const g = ctx.createGain(); env(g, t, 0.95 * v, 0.0012, d);
    chain(n, lp, body, sh, g, bus);
  }
  // 4. body boom — falling sine (the chest punch)
  {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(p.thump * 2.4, t); o.frequency.exponentialRampToValueAtTime(p.thump * 0.5, t + 0.07 + p.power * 0.14);
    const g = ctx.createGain(); env(g, t, 0.3 + p.power * 0.9, 0.0015, 0.08 + p.power * 0.34);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.7);
  }
  // 5. sub rumble for heavy calibres
  if (p.power > 0.74) {
    const n = noise(ctx, t, 1.4, 0.5), g = ctx.createGain(); env(g, t + 0.008, p.power * 0.55, 0.025, 0.4 + p.tail * 0.7);
    chain(n, filt(ctx, 'lowpass', 220), g, bus);
  }
  // 6. muzzle brake side blast — a second, sharper burst of mid-range noise
  if (mz === 'brake' || mz === 'comp') {
    const n = noise(ctx, t, 0.09), g = ctx.createGain(); env(g, t + 0.001, mz === 'brake' ? 0.8 : 0.35, 0.001, 0.05);
    chain(n, filt(ctx, 'bandpass', 1800, 0.8), g, bus);
  }
  // 7. barrel / receiver ring (what makes a gun sound like metal)
  metal(ctx, bus, t + 0.002, 1400 + p.thump * 6, 0.06 + p.power * 0.05, 0.03, 9, 0.6);
  // 8. action — unique per operating system
  (MECH[p.mech] || []).forEach(([dt, f, gn, d, q]) => metal(ctx, bus, t + dt, f * (0.97 + Math.random() * 0.06), gn, d, q, 0.4));
  if (p.mech === 'ar') { // AR buffer spring "sproing"
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(1350, t + 0.03); o.frequency.linearRampToValueAtTime(1180, t + 0.2);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(); env(g, t + 0.03, 0.05, 0.002, 0.16);
    o.connect(g); g.connect(bus); o.start(t + 0.03); lfo.start(t + 0.03); o.stop(t + 0.25); lfo.stop(t + 0.25);
  }
}

// ------------------------------------------------------------------ engine
export class GunAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.9; this.ambVolume = 0.35;
    this.muted = false;
    this.env = 'range';
    this.bank = new Map(); // weapon id -> { buffers, envelope, frameMs }
  }
  get ready() { return !!this.ctx; }
  get now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }

  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this._build();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 4; lim.ratio.value = 12; lim.attack.value = 0.001; lim.release.value = 0.15;
    this.bus = c.createGain();
    this.bus.connect(lim); lim.connect(this.master); this.master.connect(c.destination);
    this.verbIn = c.createGain(); this.verb = c.createConvolver(); this.verbDamp = filt(c, 'lowpass', 8000); this.verbOut = c.createGain();
    chain(this.verbIn, this.verb, this.verbDamp, this.verbOut, lim);
    this.ambBus = c.createGain(); this.ambBus.gain.value = this.ambVolume; this.ambBus.connect(this.master);
    this.setEnvironment(this.env);
  }

  setEnvironment(id) {
    this.env = ENVIRONMENTS[id] ? id : 'range';
    if (!this.ctx) return;
    const e = ENVIRONMENTS[this.env], c = this.ctx;
    const len = Math.floor(c.sampleRate * e.len), pre = Math.floor(c.sampleRate * e.pre);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, e.decay) * 0.6;
      }
      // discrete echoes off valley walls / buildings
      for (let k = 1; k <= (e.echoes || 0); k++) {
        const at = pre + Math.floor(len * (0.08 + Math.random() * 0.8) * (k / (e.echoes + 1)) * 1.6) % len;
        const amp = 0.9 * Math.pow(0.78, k);
        for (let j = 0; j < 900 && at + j < len; j++) d[at + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / 160);
      }
    }
    this.verb.buffer = buf;
    this.verbDamp.frequency.value = e.damp;
    this.verbOut.gain.value = e.wet * 1.7;
    if (this.ambientOn) this.startAmbient();
  }
  get ground() { return ENVIRONMENTS[this.env].ground; }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }
  setAmbientVolume(v) { this.ambVolume = v; if (this.ambBus) this.ambBus.gain.value = v; }

  // ---------------------------------------------------------------- shot bank
  /** Pre-render shot variants for a weapon and measure its loudness envelope. */
  async prepare(w) {
    if (this.bank.has(w.id)) return this.bank.get(w.id);
    const sr = this.ctx ? this.ctx.sampleRate : 44100;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    const dur = 0.35 + w.sound.decay + (w.sound.power > 0.74 ? 1.1 : 0.3);
    const jobs = [0, 1, 2, 3].map(async () => {
      const o = new OAC(1, Math.ceil(sr * dur), sr);
      synthShot(o, o.destination, w, 0.005);
      return o.startRendering();
    });
    const buffers = await Promise.all(jobs);
    // loudness envelope in 4 ms frames (peak), normalised
    const d = buffers[0].getChannelData(0), frame = Math.round(sr * 0.004), envl = [];
    let peak = 0;
    for (let i = 0; i < d.length; i += frame) {
      let m = 0; for (let j = i; j < i + frame && j < d.length; j++) { const a = Math.abs(d[j]); if (a > m) m = a; }
      envl.push(m); if (m > peak) peak = m;
    }
    const entry = { buffers, envelope: envl.map((x) => x / (peak || 1)), frameMs: 4 };
    this.bank.set(w.id, entry);
    return entry;
  }

  shot(w, t = this.now, opts = {}) {
    if (!this.ctx) return;
    const e = this.bank.get(w.id);
    const out = this.ctx.createGain();
    out.gain.value = opts.rapid ? 0.85 : 1;
    out.connect(this.bus);
    const send = this.ctx.createGain(); send.gain.value = 0.3 + w.sound.tail * 0.7; out.connect(send); send.connect(this.verbIn);
    if (!e) { synthShot(this.ctx, out, w, t); return; }
    const src = this.ctx.createBufferSource();
    src.buffer = e.buffers[Math.floor(Math.random() * e.buffers.length)];
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    src.connect(out); src.start(t);
  }

  // ---------------------------------------------------------------- action sounds
  click(t, f = 3000, g = 0.25, d = 0.02, q = 6) { if (this.ctx) metal(this.ctx, this.bus, t, f, g, d, q, 0.3); }
  dryFire(t = this.now) { this.click(t, 3200, 0.35, 0.02, 7); this.click(t + 0.01, 1400, 0.2, 0.03, 4); }
  boltCycle(t = this.now, speed = 1) {
    const s = 1 / speed;
    this.click(t, 1500, 0.24, 0.04, 3); this.click(t + 0.13 * s, 2300, 0.28, 0.06, 2);
    this.click(t + 0.33 * s, 2700, 0.3, 0.05, 2); this.click(t + 0.45 * s, 1250, 0.28, 0.04, 3);
  }
  pump(t = this.now) {
    this.click(t, 850, 0.45, 0.07, 1.6); this.click(t + 0.03, 2500, 0.2, 0.04);
    this.click(t + 0.2, 1050, 0.5, 0.07, 1.6); this.click(t + 0.23, 2900, 0.24, 0.04);
  }
  magOut(t = this.now) { this.click(t, 1800, 0.25, 0.03); this.click(t + 0.05, 700, 0.25, 0.08, 1.5); }
  magIn(t = this.now) { this.click(t, 1200, 0.42, 0.05, 2); this.click(t + 0.04, 2600, 0.32, 0.03); }
  charge(t = this.now) { this.click(t, 2000, 0.3, 0.05, 2); this.click(t + 0.16, 2600, 0.42, 0.04, 2); this.click(t + 0.2, 900, 0.3, 0.05, 2); }
  beltLoad(t = this.now) { this.click(t, 900, 0.4, 0.08, 1.5); this.click(t + 0.25, 1800, 0.3, 0.05); this.click(t + 0.6, 1100, 0.5, 0.06, 2); }
  clipPing(t = this.now) {
    if (!this.ctx) return;
    [1, 1.51, 2.79, 4.1].forEach((p, i) => {
      const o = this.ctx.createOscillator(); o.frequency.value = 2350 * p;
      const g = this.ctx.createGain(); env(g, t, 0.22 / (i + 1), 0.002, 0.9 / (i * 0.6 + 1));
      o.connect(g); g.connect(this.bus); g.connect(this.verbIn); o.start(t); o.stop(t + 1);
    });
  }

  /**
   * Spent case hitting the ground. Pitch comes from the case length, ring and
   * bounces from the ground surface (concrete rings, sand & snow just thud).
   */
  casing(t, { cart, shell = false, steel = false, surface } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, S = SURFACES[surface || this.ground] || SURFACES.concrete;
    const out = c.createGain(); out.gain.value = 0.9; out.connect(this.bus);
    const send = c.createGain(); send.gain.value = 0.15; out.connect(send); send.connect(this.verbIn);
    const cl = cart?.cl ?? 45;
    let f0 = 7000 * Math.pow(19 / cl, 0.85) * (steel ? 0.88 : 1) * (0.95 + Math.random() * 0.1);
    const heavy = Math.min(1, cl / 100);
    let gap = 0.09 + Math.random() * 0.05 + heavy * 0.05, amp = 1, tt = t;
    const hits = 1 + S.bounces + (shell ? -1 : 0);
    for (let i = 0; i < Math.max(1, hits); i++) {
      // impact thud
      const n = noise(c, tt, 0.05), g = c.createGain(); env(g, tt, (S.thud * 0.5 + heavy * 0.3) * amp, 0.001, S.soft ? 0.05 : 0.02);
      chain(n, filt(c, S.soft ? 'lowpass' : 'bandpass', S.soft ? 500 : 900 + (1 - heavy) * 1500, 1), g, out);
      if (shell) { // plastic hull + brass head
        metal(c, out, tt, 520, 0.22 * amp, 0.04, 3, 0); if (S.ring > 0.3) metal(c, out, tt + 0.004, 3800, 0.08 * amp, 0.02, 8, 0.5);
      } else if (S.ring > 0.02) {
        [1, 2.756, 5.404].forEach((pr, k) => {
          const f = f0 * pr; if (f > 15000) return;
          const o = c.createOscillator(); o.frequency.value = f;
          const og = c.createGain(); env(og, tt, (0.11 / (k + 1)) * S.ring * amp, 0.0008, S.rdecay * (steel ? 0.45 : 1) * (1 + heavy) / (k * 0.7 + 1));
          o.connect(og); og.connect(out); o.start(tt); o.stop(tt + 0.6);
        });
      }
      if (S.knock) metal(c, out, tt, S.knock, 0.12 * amp, 0.03, 2, 0);
      tt += gap; gap *= 0.55; amp *= 0.5;
    }
    if (S.roll && !shell) { // brief rattle as it rolls to a stop
      const n = noise(c, tt, 0.2), g = c.createGain(); env(g, tt, 0.04 * S.roll, 0.01, 0.15);
      chain(n, filt(c, 'bandpass', f0 * 0.6, 4), g, out);
    }
  }

  // ---------------------------------------------------------------- minigun motor
  motorStart() {
    if (!this.ctx || this.motor) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square';
    o.frequency.setValueAtTime(40, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.45);
    o2.frequency.setValueAtTime(20, t); o2.frequency.exponentialRampToValueAtTime(110, t + 0.45);
    const lp = filt(c, 'lowpass', 1200);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o2.start(t);
    this.motor = { o, o2, g };
  }
  motorStop() {
    if (!this.motor) return;
    const { o, o2, g } = this.motor, t = this.ctx.currentTime;
    [o, o2].forEach((x, i) => { x.frequency.cancelScheduledValues(t); x.frequency.setValueAtTime(x.frequency.value, t); x.frequency.exponentialRampToValueAtTime(i ? 15 : 30, t + 1.2); });
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.stop(t + 1.4); o2.stop(t + 1.4);
    this.motor = null;
  }

  // ---------------------------------------------------------------- ambience
  startAmbient() {
    this.ambientOn = true;
    if (!this.ctx) return;
    this.stopAmbient(true);
    const c = this.ctx, kind = ENVIRONMENTS[this.env].ambient, nodes = [], timers = [];
    const loopNoise = (type, f, q, gain, lfoHz = 0, lfoDepth = 0) => {
      const s = c.createBufferSource(); s.buffer = noiseBuf(c); s.loop = true;
      const fl = filt(c, type, f, q), g = c.createGain(); g.gain.value = gain;
      chain(s, fl, g, this.ambBus); s.start();
      if (lfoHz) { const l = c.createOscillator(); l.frequency.value = lfoHz; const lg = c.createGain(); lg.gain.value = lfoDepth; l.connect(lg); lg.connect(g.gain); l.start(); nodes.push(l); }
      nodes.push(s);
    };
    const chirps = (f, every, len, gain, burst = 1) => timers.push(setInterval(() => {
      const t = c.currentTime + Math.random() * 0.3;
      for (let k = 0; k < burst; k++) {
        const o = c.createOscillator(); o.frequency.setValueAtTime(f * (0.9 + Math.random() * 0.2), t + k * len * 1.6);
        o.frequency.exponentialRampToValueAtTime(f * 1.25, t + k * len * 1.6 + len);
        const g = c.createGain(); env(g, t + k * len * 1.6, gain, 0.005, len);
        o.connect(g); g.connect(this.ambBus); o.start(t + k * len * 1.6); o.stop(t + k * len * 1.6 + len + 0.05);
      }
    }, every));
    if (kind === 'wind') loopNoise('bandpass', 420, 0.6, 0.22, 0.13, 0.12);
    if (kind === 'breeze') loopNoise('lowpass', 600, 0.5, 0.1, 0.09, 0.05);
    if (kind === 'city') { loopNoise('lowpass', 180, 0.6, 0.35); loopNoise('bandpass', 1200, 0.4, 0.02, 0.05, 0.015); }
    if (kind === 'hvac') { loopNoise('lowpass', 140, 0.8, 0.3); const o = c.createOscillator(); o.frequency.value = 50; const g = c.createGain(); g.gain.value = 0.012; o.connect(g); g.connect(this.ambBus); o.start(); nodes.push(o); }
    if (kind === 'jungle') { loopNoise('highpass', 3500, 0.5, 0.025, 0.3, 0.015); chirps(2600, 1700, 0.07, 0.03, 3); chirps(4200, 900, 0.03, 0.015, 5); }
    if (kind === 'crickets') { loopNoise('lowpass', 400, 0.5, 0.05); chirps(4600, 600, 0.025, 0.02, 4); }
    this.amb = { nodes, timers };
  }
  stopAmbient(keepFlag = false) {
    if (!keepFlag) this.ambientOn = false;
    if (!this.amb) return;
    this.amb.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
    this.amb.timers.forEach(clearInterval);
    this.amb = null;
  }
}
