// Haptics, camera-torch flash and canvas particles.

// ---------------------------------------------------------------- HAPTICS
// Browsers can't set vibration strength, so we fake an amplitude envelope
// with pulse-width modulation: long pulses feel strong, short pulses with
// gaps feel weaker. The envelope mirrors the audio: blast → decay → action.
export const Haptics = {
  supported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
  enabled: true,
  intensity: 1,

  pattern(p, { rapid = false, interval = 0 } = {}) {
    const k = this.intensity;
    if (rapid) {
      // one pulse per shot, leaving a gap so successive shots stay distinct
      return [Math.max(8, Math.round(Math.min(interval * 0.6, 18 + p.power * 40) * k))];
    }
    const main = Math.round((22 + p.power * 70) * k);
    const pat = [main];
    // decaying tail (PWM): pulses get shorter, gaps longer
    const steps = Math.round(1 + p.decay * 10);
    for (let i = 1; i <= steps; i++) {
      pat.push(Math.round(6 + i * 6), Math.max(4, Math.round((main * 0.45) / i)));
    }
    // mechanical action "kick"
    if (p.mech === 'heavy') pat.push(30, Math.round(35 * k));
    else if (p.mech === 'slide' || p.mech === 'gas') pat.push(16, Math.round(12 * k));
    return pat;
  },

  shot(p, opts) { if (this.enabled && this.supported) navigator.vibrate(this.pattern(p, opts)); },
  tick(ms = 12) { if (this.enabled && this.supported) navigator.vibrate(Math.round(ms * this.intensity)); },
  seq(pat) { if (this.enabled && this.supported) navigator.vibrate(pat.map((v, i) => (i % 2 ? v : Math.round(v * this.intensity)))); },
  stop() { if (this.supported) navigator.vibrate(0); },
};

// ---------------------------------------------------------------- TORCH
// Uses the rear camera's flashlight via MediaStream `torch` constraint
// (Chrome on Android over HTTPS). Not available on iOS/desktop.
export const Torch = {
  track: null,
  stream: null,
  busy: false,
  lastOff: 0,

  get possible() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
  get active() { return !!this.track; },

  async enable() {
    if (this.track) return true;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('This device/browser does not expose the flashlight. Try Chrome on Android.');
    }
    this.stream = stream; this.track = track;
    return true;
  },

  disable() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null; this.track = null;
  },

  async set(on) {
    if (!this.track) return;
    try { await this.track.applyConstraints({ advanced: [{ torch: on }] }); } catch { /* ignore */ }
  },

  // pulse the LED; toggling hardware is slow (~30-80ms) so we throttle
  async pulse(ms = 60) {
    if (!this.track || this.busy) return;
    this.busy = true;
    await this.set(true);
    setTimeout(async () => { await this.set(false); this.busy = false; }, ms);
  },
};

// ---------------------------------------------------------------- PARTICLES
export class Particles {
  constructor(canvas) {
    this.cv = canvas;
    this.cx = canvas.getContext('2d');
    this.list = [];
    this.running = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = r.width * dpr; this.cv.height = r.height * dpr;
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width; this.h = r.height;
  }
  _kick() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.update(dt); this.draw();
      if (this.list.length) requestAnimationFrame(step); else { this.running = false; this.cx.clearRect(0, 0, this.w, this.h); }
    };
    requestAnimationFrame(step);
  }
  shell(x, y, opts = {}) {
    const dir = opts.dir ?? 1;
    const big = opts.size ?? 1;
    this.list.push({
      t: 'shell', x, y, vx: dir * (120 + Math.random() * 140) * (opts.down ? 0.4 : 1), vy: opts.down ? 40 : -(260 + Math.random() * 160),
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 30, life: 1.6, age: 0,
      len: 13 * big, wid: 4.5 * big, color: opts.color ?? '#d9a441', floor: this.h - 12,
    });
    this._kick();
  }
  smoke(x, y, amount = 1) {
    for (let i = 0; i < 4 + amount * 6; i++) {
      this.list.push({ t: 'smoke', x: x + Math.random() * 10, y: y + (Math.random() - 0.5) * 8, vx: 30 + Math.random() * 90 * amount, vy: -10 - Math.random() * 30,
        r: 6 + Math.random() * 10 * amount, life: 0.9 + Math.random() * 0.9, age: 0 });
    }
    this._kick();
  }
  sparks(x, y, amount = 1) {
    for (let i = 0; i < 6 * amount; i++) {
      const a = (Math.random() - 0.5) * 0.9;
      const s = 300 + Math.random() * 500;
      this.list.push({ t: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.12 + Math.random() * 0.12, age: 0 });
    }
    this._kick();
  }
  dust(x, y, amount = 1) {
    // muzzle-brake side blast (Barrett) — dust pushed up & sideways
    for (let i = 0; i < 14 * amount; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const s = 80 + Math.random() * 200;
      this.list.push({ t: 'smoke', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, r: 5 + Math.random() * 12, life: 0.7 + Math.random() * 0.8, age: 0, dust: true });
    }
    this._kick();
  }
  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      if (p.t === 'shell') {
        p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
      } else if (p.t === 'smoke') {
        p.vx *= 0.96; p.vy *= 0.96; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 22 * dt;
      } else { p.x += p.vx * dt; p.y += p.vy * dt; }
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }
  draw() {
    const c = this.cx;
    c.clearRect(0, 0, this.w, this.h);
    for (const p of this.list) {
      const k = 1 - p.age / p.life;
      if (p.t === 'shell') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = Math.min(1, k * 3);
        const g = c.createLinearGradient(0, -p.wid / 2, 0, p.wid / 2);
        g.addColorStop(0, '#fff3c4'); g.addColorStop(0.4, p.color); g.addColorStop(1, '#6b4a10');
        c.fillStyle = g; c.fillRect(-p.len / 2, -p.wid / 2, p.len, p.wid);
        c.restore();
      } else if (p.t === 'smoke') {
        c.globalAlpha = k * (p.dust ? 0.35 : 0.22);
        c.fillStyle = p.dust ? '#a89878' : '#cfd3d6';
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      } else {
        c.globalAlpha = k; c.strokeStyle = '#ffd36b'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }
}
