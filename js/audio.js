// Synthesized gunfire engine (Web Audio API).
// A shot is layered from: supersonic crack + broadband blast + low "thump"
// + mechanical action + environment reverb. All parameters come from the
// weapon's `sound` profile, so no audio files are required.

export const ENVIRONMENTS = {
  range:  { label: 'Outdoor range', len: 1.6, decay: 3.2, wet: 0.35, pre: 0.02 },
  field:  { label: 'Open field',    len: 0.9, decay: 5,   wet: 0.18, pre: 0.01 },
  indoor: { label: 'Indoor range',  len: 0.8, decay: 2.2, wet: 0.55, pre: 0.004 },
  canyon: { label: 'Canyon',        len: 3.4, decay: 1.6, wet: 0.6,  pre: 0.09 },
  urban:  { label: 'City street',   len: 2.2, decay: 2.6, wet: 0.45, pre: 0.035 },
};

export class GunAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.9;
    this.muted = false;
    this.env = 'range';
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
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 8;
    comp.attack.value = 0.001; comp.release.value = 0.12;
    this.bus = c.createGain();
    this.bus.connect(comp); comp.connect(this.master); this.master.connect(c.destination);

    this.verb = c.createConvolver();
    this.verbIn = c.createGain();
    this.verbOut = c.createGain();
    this.verbIn.connect(this.verb); this.verb.connect(this.verbOut); this.verbOut.connect(comp);

    // shared white noise (2s) used by every layer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // soft clipper for the blast layer
    this.shaper = (amt) => {
      const n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; curve[i] = ((1 + amt) * x) / (1 + amt * Math.abs(x)); }
      return curve;
    };
    this.curve = this.shaper(6);
    this.setEnvironment(this.env);
  }

  setEnvironment(id) {
    this.env = id;
    if (!this.ctx) return;
    const e = ENVIRONMENTS[id] || ENVIRONMENTS.range, c = this.ctx;
    const len = Math.floor(c.sampleRate * e.len), pre = Math.floor(c.sampleRate * e.pre);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre);
        // exponential decay + sparse early reflections (slap-back off buildings / canyon walls)
        let v = (Math.random() * 2 - 1) * Math.pow(1 - t, e.decay);
        if (id === 'canyon' || id === 'urban') {
          const echo = Math.sin(t * Math.PI * (id === 'canyon' ? 7 : 12));
          v *= 0.6 + 0.4 * Math.max(0, echo);
        }
        d[i] = v;
      }
    }
    this.verb.buffer = buf;
    this.verbOut.gain.value = e.wet * 1.6;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }

  // ---- primitives -------------------------------------------------------
  _noise(t, dur, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.playbackRate.value = rate;
    s.start(t, Math.random() * 1.5, dur + 0.05);
    return s;
  }
  _env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  _out(t, dur, wet) {
    const g = this.ctx.createGain();
    g.connect(this.bus);
    if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.verbIn); }
    return g;
  }

  /** Metallic click: band-passed noise blip. */
  click(t, freq = 3000, gain = 0.25, dur = 0.02, q = 6) {
    if (!this.ctx) return;
    const src = this._noise(t, dur);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const g = this.ctx.createGain(); this._env(g, t, gain, 0.001, dur);
    src.connect(bp); bp.connect(g); g.connect(this._out(t, dur, 0.15));
  }

  /** Metallic ring (Garand clip ping, shell casing). */
  ring(t, freq, gain, dur, partials = [1, 2.76, 5.4]) {
    if (!this.ctx) return;
    const out = this._out(t, dur, 0.25);
    partials.forEach((p, i) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * p;
      const g = this.ctx.createGain(); this._env(g, t, gain / (i + 1), 0.002, dur / (i * 0.6 + 1));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    });
  }

  // ---- the gunshot --------------------------------------------------------
  shot(p, t = this.now, opts = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const v = 0.92 + Math.random() * 0.16; // per-shot variation
    const rapid = opts.rapid ? 0.6 : 1;
    const decay = p.decay * rapid;
    const out = this._out(t, decay, 0.25 + p.tail * 0.75);
    out.gain.value = 0.55 + p.power * 0.45;

    // 1. supersonic crack: very short, bright
    if (p.crack > 0.05) {
      const n = this._noise(t, 0.03, 1.2);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
      const g = c.createGain(); this._env(g, t, p.crack * 0.9 * v, 0.0005, 0.012 + p.power * 0.01);
      n.connect(hp); hp.connect(g); g.connect(out);
    }
    // 2. muzzle blast: distorted noise through a falling low-pass sweep
    {
      const n = this._noise(t, decay + 0.1, 0.9 + Math.random() * 0.2);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
      lp.frequency.setValueAtTime(p.bright * v, t);
      lp.frequency.exponentialRampToValueAtTime(180 + p.thump, t + decay);
      const sh = c.createWaveShaper(); sh.curve = this.curve;
      const g = c.createGain(); this._env(g, t, 0.9 * v, 0.0015, decay);
      n.connect(lp); lp.connect(sh); sh.connect(g); g.connect(out);
    }
    // 3. body thump: pitched sine dropping fast (chest punch)
    {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(p.thump * 2.2, t);
      o.frequency.exponentialRampToValueAtTime(p.thump * 0.55, t + 0.08 + p.power * 0.12);
      const g = c.createGain(); this._env(g, t, 0.35 + p.power * 0.85, 0.002, 0.1 + p.power * 0.3 * rapid);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.6);
    }
    // 4. low rumble tail for big guns
    if (p.power > 0.75 && !opts.rapid) {
      const n = this._noise(t, 1.2, 0.5);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const g = c.createGain(); this._env(g, t + 0.01, p.power * 0.6, 0.03, 0.6 + p.tail * 0.6);
      n.connect(lp); lp.connect(g); g.connect(out);
    }
    // 5. mechanical action
    const m = p.mech;
    if (m === 'slide') { this.click(t + 0.018, 2600, 0.18, 0.02); this.click(t + 0.05, 1800, 0.14, 0.025); }
    else if (m === 'gas') { this.click(t + 0.03, 2400, 0.12, 0.02); this.click(t + 0.065, 1500, 0.1, 0.03); }
    else if (m === 'bolt-open' || m === 'bolt-closed') { this.click(t + 0.02, 1700, 0.12, 0.025); }
    else if (m === 'heavy') { this.click(t + 0.05, 1200, 0.22, 0.05, 3); this.click(t + 0.12, 900, 0.18, 0.06, 3); }
    else if (m === 'rotary') { /* motor is handled separately */ }
  }

  // ---- action sounds ------------------------------------------------------
  dryFire(t = this.now) { this.click(t, 3200, 0.35, 0.025, 4); this.click(t + 0.012, 1400, 0.2, 0.03, 3); }

  boltCycle(t = this.now, speed = 1) {
    const s = 1 / speed;
    this.click(t, 1500, 0.22, 0.04, 3);              // handle up
    this.click(t + 0.12 * s, 2200, 0.25, 0.06, 2);   // back
    this.click(t + 0.32 * s, 2600, 0.28, 0.05, 2);   // forward
    this.click(t + 0.44 * s, 1300, 0.25, 0.04, 3);   // lock down
  }

  pump(t = this.now) {
    this.click(t, 900, 0.4, 0.07, 1.5); this.click(t + 0.03, 2400, 0.18, 0.04);
    this.click(t + 0.2, 1100, 0.45, 0.07, 1.5); this.click(t + 0.23, 2800, 0.2, 0.04);
  }

  magOut(t = this.now) { this.click(t, 1800, 0.25, 0.03); this.click(t + 0.05, 700, 0.25, 0.08, 1.5); }
  magIn(t = this.now) { this.click(t, 1200, 0.4, 0.05, 2); this.click(t + 0.04, 2600, 0.3, 0.03); }
  charge(t = this.now) { this.click(t, 2000, 0.3, 0.05, 2); this.click(t + 0.16, 2600, 0.4, 0.04, 2); this.click(t + 0.2, 900, 0.3, 0.05, 2); }
  beltLoad(t = this.now) { this.click(t, 900, 0.4, 0.08, 1.5); this.click(t + 0.25, 1800, 0.3, 0.05); this.click(t + 0.6, 1100, 0.5, 0.06, 2); }

  clipPing(t = this.now) { this.ring(t, 2350, 0.22, 0.9, [1, 1.51, 2.79, 4.1]); }

  casing(t = this.now, big = false, shell = false) {
    if (shell) { this.click(t, 500, 0.18, 0.06, 2); this.click(t + 0.12, 650, 0.1, 0.05, 2); return; }
    const f = big ? 2100 : 3600 + Math.random() * 1500;
    this.ring(t, f, 0.05, 0.18); this.ring(t + 0.09 + Math.random() * 0.05, f * 1.07, 0.03, 0.12);
  }

  // ---- minigun motor ------------------------------------------------------
  motorStart() {
    if (!this.ctx || this.motor) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square';
    o.frequency.setValueAtTime(40, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.45);
    o2.frequency.setValueAtTime(20, t); o2.frequency.exponentialRampToValueAtTime(110, t + 0.45);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.bus);
    o.start(t); o2.start(t);
    this.motor = { o, o2, g };
  }
  motorStop() {
    if (!this.motor) return;
    const { o, o2, g } = this.motor, t = this.ctx.currentTime;
    o.frequency.cancelScheduledValues(t); o2.frequency.cancelScheduledValues(t);
    o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
    o2.frequency.setValueAtTime(o2.frequency.value, t); o2.frequency.exponentialRampToValueAtTime(15, t + 1.2);
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.stop(t + 1.4); o2.stop(t + 1.4);
    this.motor = null;
  }
}
