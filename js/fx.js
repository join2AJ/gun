// Haptics, camera-torch flash and canvas particles.

// ---------------------------------------------------------------- HAPTICS
// Phones can't set vibration strength, only on/off timing. We therefore
// translate the gun's *actual rendered sound* (its loudness envelope) into
// pulse-width modulation: loud = long pulses, quiet = short pulses with gaps.
// A first "kick" pulse is sized by the gun's recoil, so a Glock taps while a
// .50 BMG thumps — and the action clatter after the shot shows up as pulses.
export const Haptics = {
  supported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
  enabled: true,
  intensity: 1,
  cache: new Map(),

  fromEnvelope(w, bank) {
    const key = w.id + ':' + this.intensity;
    if (this.cache.has(key)) return this.cache.get(key);
    const k = this.intensity;
    const kick = Math.round((12 + w.feel.recoil * 7) * k);
    const segs = [[true, kick]];
    if (bank) {
      const { envelope: e, frameMs } = bank;
      const win = 20;
      let quiet = 0;
      for (let t = kick; t < 650; t += win) {
        let lvl = 0;
        for (let i = Math.floor(t / frameMs); i < Math.floor((t + win) / frameMs) && i < e.length; i++) lvl = Math.max(lvl, e[i]);
        if (lvl < 0.025) { quiet += win; if (quiet > 90) break; segs.push([false, win]); continue; }
        quiet = 0;
        const on = Math.min(win, Math.max(8, Math.round(win * Math.min(1, Math.pow(lvl * 3, 0.7)) * Math.min(1.4, k))));
        segs.push([true, on]); if (on < win) segs.push([false, win - on]);
      }
    } else segs.push([false, 20], [true, Math.round(kick * 0.4)]);
    // merge neighbours of the same kind -> [on, off, on, off, ...]
    const out = [];
    let last = null;
    for (const [on, ms] of segs) { if (on === last) out[out.length - 1] += ms; else { out.push(ms); last = on; } }
    if (out.length % 2 === 0) out.pop(); // finish on a pulse, drop the trailing silence
    this.cache.set(key, out);
    return out;
  },

  shot(w, bank, { rapid = false, interval = 0 } = {}) {
    if (!this.enabled || !this.supported) return;
    if (rapid) {
      const kick = (14 + w.feel.recoil * 7) * this.intensity;
      navigator.vibrate(Math.max(8, Math.round(Math.min(interval * 0.6, kick))));
    } else navigator.vibrate(this.fromEnvelope(w, bank));
  },
  tick(ms = 12) { if (this.enabled && this.supported) navigator.vibrate(Math.round(ms * this.intensity)); },
  seq(pat) { if (this.enabled && this.supported) navigator.vibrate(pat.map((v, i) => (i % 2 ? v : Math.round(v * this.intensity)))); },
  stop() { if (this.supported) navigator.vibrate(0); },
  reset() { this.cache.clear(); },
};

// ---------------------------------------------------------------- TORCH
// Rear-camera flashlight via the MediaStream `torch` constraint (Chrome on
// Android, HTTPS). Each gun has its own pattern: e.g. a muzzle-brake rifle
// gives a long flash plus a secondary flare; a pistol a quick blink.
export const Torch = {
  track: null, stream: null, busy: false,
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
  disable() { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; this.track = null; },
  async set(on) { if (this.track) { try { await this.track.applyConstraints({ advanced: [{ torch: on }] }); } catch { /* ignore */ } } },
  async pattern(pat) {
    if (!this.track || this.busy) return;
    this.busy = true;
    for (let i = 0; i < pat.length; i++) {
      if (i % 2 === 0) await this.set(true);
      await new Promise((r) => setTimeout(r, pat[i]));
      if (i % 2 === 0) await this.set(false);
    }
    this.busy = false;
  },
};

// ---------------------------------------------------------------- PARTICLES
export class Particles {
  constructor(canvas) {
    this.cv = canvas; this.cx = canvas.getContext('2d'); this.list = []; this.running = false;
    this.floor = null;
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
  shell(x, y, o = {}) {
    const dir = o.dir ?? -1, size = o.size ?? 1;
    this.list.push({
      t: 'shell', x, y, vx: dir * (110 + Math.random() * 150) * (o.down ? 0.35 : 1), vy: o.down ? 60 : -(260 + Math.random() * 170),
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 30, life: 2.2, age: 0, len: 13 * size, wid: 4.5 * size,
      color: o.color ?? '#d9a441', floor: (this.floor ?? this.h - 12) + (Math.random() - 0.5) * 14, onLand: o.onLand, landed: false, sink: o.sink,
    });
    this._kick();
  }
  /** A dropped magazine: tumbles to the floor, bounces once, slides to rest. */
  mag(x, y, w, h, color, onLand) {
    this.list.push({ t: 'mag', x: x + w / 2, y: y + h / 2, w: Math.max(8, w), h: Math.max(10, h), vx: -40 - Math.random() * 40, vy: 30, rot: 0, vr: -1.5 - Math.random() * 2,
      life: 2.6, age: 0, color, floor: (this.floor ?? this.h - 12) - Math.min(w, h) * 0.3, onLand, landed: false });
    this._kick();
  }
  smoke(x, y, amount = 1, tint = '#cfd3d6') {
    for (let i = 0; i < 4 + amount * 6; i++) {
      this.list.push({ t: 'smoke', x: x + Math.random() * 10, y: y + (Math.random() - 0.5) * 8, vx: 30 + Math.random() * 90 * amount, vy: -10 - Math.random() * 30,
        r: 6 + Math.random() * 10 * amount, life: 0.9 + Math.random() * 1.1, age: 0, tint });
    }
    this._kick();
  }
  sparks(x, y, amount = 1) {
    for (let i = 0; i < 6 * amount; i++) {
      const a = (Math.random() - 0.5) * 0.9, s = 300 + Math.random() * 500;
      this.list.push({ t: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.1 + Math.random() * 0.14, age: 0 });
    }
    this._kick();
  }
  dust(x, y, amount = 1, tint = '#a89878') {
    for (let i = 0; i < 14 * amount; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 80 + Math.random() * 220;
      this.list.push({ t: 'smoke', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, r: 5 + Math.random() * 12, life: 0.7 + Math.random() * 0.8, age: 0, tint, dust: true });
    }
    this._kick();
  }
  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      if (p.t === 'shell') {
        if (p.landed && p.sink) { p.y += 6 * dt; continue; }
        p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > p.floor) {
          if (!p.landed) { p.landed = true; p.onLand && p.onLand(); }
          p.y = p.floor; p.vy *= p.sink ? 0 : -0.35; p.vx *= p.sink ? 0 : 0.6; p.vr *= 0.5;
        }
      } else if (p.t === 'mag') {
        p.vy += 1700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > p.floor) {
          if (!p.landed) { p.landed = true; p.onLand && p.onLand(); }
          p.y = p.floor; p.vy *= -0.25; p.vx *= 0.5; p.vr *= 0.3;
          p.rot += (Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2) - p.rot) * 0.3; // settle flat
        }
      } else if (p.t === 'smoke') { p.vx *= 0.96; p.vy *= 0.96; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 22 * dt; }
      else { p.x += p.vx * dt; p.y += p.vy * dt; }
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
        g.addColorStop(0, '#fff3c4'); g.addColorStop(0.4, p.color); g.addColorStop(1, '#4a3008');
        c.fillStyle = g; c.fillRect(-p.len / 2, -p.wid / 2, p.len, p.wid);
        c.restore();
      } else if (p.t === 'mag') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = Math.min(1, k * 4);
        c.fillStyle = p.color; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.5;
        c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-p.w / 2 + 2, -p.h / 2 + 2, p.w * 0.25, p.h - 4);
        c.restore();
      } else if (p.t === 'smoke') {
        c.globalAlpha = k * (p.dust ? 0.35 : 0.22); c.fillStyle = p.tint;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      } else {
        c.globalAlpha = k; c.strokeStyle = '#ffd36b'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- AMBIENT WEATHER
// Light, always-on particles that sell the scene: snow, blowing sand, jungle
// drizzle, fireflies at night, dust in indoor lights.
export class Weather {
  constructor(canvas) {
    this.cv = canvas; this.cx = canvas.getContext('2d'); this.kind = null; this.p = []; this.on = false;
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = r.width * dpr; this.cv.height = r.height * dpr; this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width; this.h = r.height;
  }
  set(kind) {
    this.kind = kind; this.resize();
    const n = { snow: 110, sand: 70, rain: 90, fireflies: 22, motes: 40 }[kind] || 0;
    this.p = Array.from({ length: n }, () => this.spawn(true));
    if (n && !this.on) { this.on = true; let last = performance.now(); const f = (now) => { if (!this.on) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; this.step(dt); requestAnimationFrame(f); }; requestAnimationFrame(f); }
    if (!n) { this.on = false; this.cx.clearRect(0, 0, this.w, this.h); }
  }
  stop() { this.on = false; this.cx && this.cx.clearRect(0, 0, this.w || 0, this.h || 0); }
  spawn(any) {
    const w = this.w || 800, h = this.h || 400, k = this.kind;
    const y = any ? Math.random() * h : -10;
    if (k === 'snow') return { x: Math.random() * w, y, r: 0.8 + Math.random() * 2.4, vx: -10 + Math.random() * 20, vy: 18 + Math.random() * 40, ph: Math.random() * 6 };
    if (k === 'sand') return { x: any ? Math.random() * w : -10, y: h * (0.45 + Math.random() * 0.55), r: 0.6 + Math.random() * 1.4, vx: 120 + Math.random() * 160, vy: (Math.random() - 0.5) * 20, ph: 0 };
    if (k === 'rain') return { x: Math.random() * w, y, r: 8 + Math.random() * 12, vx: -40, vy: 600 + Math.random() * 300, ph: 0 };
    if (k === 'fireflies') return { x: Math.random() * w, y: h * (0.35 + Math.random() * 0.6), r: 1.5 + Math.random() * 1.5, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 14, ph: Math.random() * 6 };
    return { x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.6, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 5, ph: Math.random() * 6 };
  }
  step(dt) {
    const c = this.cx, w = this.w, h = this.h, k = this.kind;
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i]; p.ph += dt;
      p.x += (p.vx + (k === 'snow' ? Math.sin(p.ph) * 12 : 0)) * dt; p.y += p.vy * dt;
      if (p.y > h + 10 || p.x > w + 20 || p.x < -20 || p.y < -20) this.p[i] = this.spawn(false);
      if (k === 'rain') { c.strokeStyle = 'rgba(190,220,210,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 1.5, p.y - p.r); c.stroke(); continue; }
      let col = 'rgba(255,255,255,.8)';
      if (k === 'sand') col = 'rgba(230,190,130,.45)';
      if (k === 'fireflies') col = `rgba(200,255,120,${0.3 + 0.7 * Math.abs(Math.sin(p.ph * 1.7))})`;
      if (k === 'motes') col = `rgba(255,240,210,${0.15 + 0.25 * Math.abs(Math.sin(p.ph))})`;
      c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    }
  }
}
