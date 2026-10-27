// Duo-fold front-end perf harness: drives MANUAL folds (pointerdown -> drag -> release)
// at a fixed cadence until the settlement modal appears, sampling frame timings.
import fs from 'node:fs';

const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];
const PORT = Number(opt.port || 9444);
const W = Number(opt.w || 390);
const H = Number(opt.h || 844);
const DPR = Number(opt.dpr || 2);
const RATE = Number(opt.rate || 2);          // folds per second
const RUNS = Number(opt.runs || 3);
const IDLE_MS = Number(opt.idle || 3000);
const TAG = opt.tag || 'mobile';
const OUT = opt.out || `D:/tmp/duo-perf/raw-${TAG}.json`;
const SHOTS = opt.shots || `D:/projects/duo-fold-game/.preview`;
const URL_ = opt.url || 'http://127.0.0.1:21000/index.html';
const PERIOD = 1000 / RATE;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map(); }
  static async open(port, url) {
    const r = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
    const t = await r.json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) {
        const { res, rej } = c.pending.get(m.id);
        c.pending.delete(m.id);
        m.error ? rej(new Error(m.method + ' ' + JSON.stringify(m.error))) : res(m.result);
      } else if (m.method) {
        (c.handlers.get(m.method) || []).forEach((f) => f(m.params));
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout ' + method)); } }, 30000);
    });
  }
  on(ev, fn) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); }
  async ev(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('js: ' + JSON.stringify(r.exceptionDetails));
    return r.result?.value;
  }
}

const PROBE = String.raw`
(() => {
  const D = window.__duo;
  if (!D) return 'no __duo';
  const perf = window.__perf = window.__perf || {};
  perf.buf = null;          // active capture buffer
  perf.tags = {};
  perf.mark = (kind) => { if (perf.buf) perf.buf.marks.push({ t: performance.now(), k: kind }); };
  perf.start = (tag) => {
    perf.buf = { tag, t0: performance.now(), frames: [], render: [], bend: [], screen: [], longtasks: [], marks: [], card: [], lab: {} };
    return perf.buf.t0;
  };
  perf.stop = () => { const b = perf.buf; perf.buf = null; return b; };

  // 1) independent rAF sampler (same vsync as the game's tick)
  const raf = (t) => { if (perf.buf) perf.buf.frames.push(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);

  // 2) long tasks (>50ms main-thread block)
  try {
    new PerformanceObserver((l) => {
      if (!perf.buf) return;
      for (const e of l.getEntries()) perf.buf.longtasks.push({ s: e.startTime, d: e.duration });
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}

  // 3) per-frame cost of the three.js draw + the bend geometry rebuild
  if (!D.renderer.__wrapped) {
    const orig = D.renderer.render.bind(D.renderer);
    D.renderer.render = function (s, c) {
      const t0 = performance.now(); orig(s, c);
      if (perf.buf) perf.buf.render.push(performance.now() - t0);
    };
    D.renderer.__wrapped = true;
  }
  if (!D.phone.__bwrapped) {
    const ob = D.phone.setBend;
    D.phone.setBend = function (a) {
      const t0 = performance.now(); ob(a);
      if (perf.buf) perf.buf.bend.push(performance.now() - t0);
    };
    D.phone.__bwrapped = true;
  }
  // 屏幕画布整幅重绘（2048x1462 内屏 + 1024x1480 外屏）+ 纹理上传
  if (!D.phone.__uwrapped) {
    const ou = D.phone.updateScreen;
    D.phone.updateScreen = function (s) {
      const t0 = performance.now(); ou(s);
      if (perf.buf) perf.buf.screen.push(performance.now() - t0);
    };
    D.phone.__uwrapped = true;
  }
  // 4) settle-card canvas serialisation (runs on the main thread at 结算)
  if (!HTMLCanvasElement.prototype.__wrapped) {
    const td = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function (...a) {
      const t0 = performance.now(); const v = td.apply(this, a); const d = performance.now() - t0;
      if (perf.buf) perf.buf.card.push(d);
      return v;
    };
    HTMLCanvasElement.prototype.__wrapped = true;
  }
  return 'probe ok';
})()
`;

const ENV = String.raw`
(() => {
  const D = window.__duo;
  const gl = D.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    dpr: window.devicePixelRatio,
    inner: [innerWidth, innerHeight],
    cores: navigator.hardwareConcurrency,
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown',
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'unknown',
    drawingBuffer: gl.getParameter(gl.DRAWING_BUFFER_WIDTH) ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null,
    webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
    calls: D.renderer.info.render.calls,
    triangles: D.renderer.info.render.triangles,
    textures: D.renderer.info.memory.textures,
    geometries: D.renderer.info.memory.geometries,
  };
})()
`;

const STATE = String.raw`
(() => ({
  folds: window.__duo.game.folds,
  stage: window.__duo.game.stage,
  broken: window.__duo.game.broken,
  finished: window.__duo.game.finished,
  traits: window.__duo.game.traits.slice(),
  hudFolds: (document.getElementById('foldsLine') || {}).textContent,
  modal: (() => { const m = document.getElementById('cardModal'); return !!m && !m.hidden; })(),
  animate: document.getAnimations ? document.getAnimations().length : -1,
}))()
`;

async function waitReady(cdp) {
  for (let i = 0; i < 200; i++) {
    const ok = await cdp.ev(`!!(window.__duo && window.__duo.renderer && document.getElementById('cardModal') && document.readyState === 'complete')`);
    if (ok) break;
    await sleep(150);
  }
  await sleep(2500);   // 壁纸 / 环境贴图 / 首帧着色器编译收敛
}

async function metrics(cdp) {
  const m = await cdp.send('Performance.getMetrics');
  const o = {};
  for (const { name, value } of m.metrics) o[name] = value;
  return o;
}

const CX = Math.round(W * 0.5);
const CY = Math.round(H * 0.52);

async function foldGesture(cdp) {
  await cdp.ev(`__perf.mark('fold:start')`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: CX, y: CY, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  await sleep(60);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: CX + Math.round(W * 0.14), y: CY, button: 'left', buttons: 1, pointerType: 'mouse' });
  await sleep(35);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: CX + Math.round(W * 0.29), y: CY, button: 'left', buttons: 1, pointerType: 'mouse' });
  await sleep(35);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: CX + Math.round(W * 0.29), y: CY, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
  await cdp.ev(`__perf.mark('fold:end')`);
}

async function shot(cdp, name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const p = `${SHOTS}/${name}.png`;
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
  return p;
}

const out = { tag: TAG, viewport: { W, H, DPR }, rate: RATE, runs: [], idle: null, env: null, notes: [] };
const TRACE = opt.trace === '1';

const cdp = await CDP.open(PORT, URL_);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Performance.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await waitReady(cdp);
await cdp.ev(PROBE);
// --patch excite：屏蔽每帧写入根级 CSS 变量（A/B 定位样式重算来源）
if (opt.patch === 'excite') {
  const r = await cdp.ev(String.raw`(() => {
    const st = document.documentElement.style;
    const orig = st.setProperty.bind(st);
    let blocked = 0;
    st.setProperty = function (n, v, p) { if (n === '--excite') { blocked++; return; } return orig(n, v, p); };
    const stars = document.querySelector('.stars');
    if (stars) Object.defineProperty(stars.style, 'animationDuration', { set() {}, get() { return ''; } });
    window.__patchInfo = () => blocked;
    return 'excite write suppressed';
  })()`);
  console.log('patch:', r);
}
if (opt.patch === 'noscreen') {
  const r = await cdp.ev(`(() => { window.__duo.phone.updateScreen = () => {}; return 'updateScreen disabled'; })()`);
  console.log('patch:', r);
}
if (opt.patch === 'noscene') {
  const r = await cdp.ev(`(() => { window.__duo.scene.visible = false; return 'scene hidden'; })()`);
  console.log('patch:', r);
}
if (opt.patch === 'dpr1') {
  const r = await cdp.ev(`(() => { window.__duo.renderer.setPixelRatio(1); return 'pixelRatio=' + window.__duo.renderer.getPixelRatio(); })()`);
  console.log('patch:', r);
}
out.env = await cdp.ev(ENV);
console.log('env', JSON.stringify(out.env));

// ---- idle baseline (no folds, same scene) ----
await cdp.ev(`__perf.start('idle')`);
const m0 = await metrics(cdp);
await sleep(IDLE_MS);
const m1 = await metrics(cdp);
const idleBuf = await cdp.ev(`(() => { const b = __perf.stop(); return b; })()`);
const dm = {}; for (const k of Object.keys(m1)) dm[k] = +(m1[k] - (m0[k] || 0)).toFixed(4);
out.idle = { buf: idleBuf, metrics: dm, ms: IDLE_MS };
console.log('idle frames', idleBuf.frames.length);

// ---- fold runs ----
for (let run = 0; run < RUNS; run++) {
  const st0 = await cdp.ev(STATE);
  if (st0.finished || st0.folds > 0) {
    // 清场：关掉结算弹窗 → 新局
    await cdp.ev(`(() => { const c = document.getElementById('closeCard'); if (c) c.click(); return 1; })()`);
    await sleep(700);
    await cdp.ev(`__perf.mark('reset')`);
  }
  const before = await metrics(cdp);
  if (TRACE && run === 0) {
    cdp.traceChunks = []; cdp.traceDone = false;
    cdp.on('Tracing.dataCollected', (p) => cdp.traceChunks.push(...p.value));
    cdp.on('Tracing.tracingComplete', () => { cdp.traceDone = true; });
    await cdp.send('Tracing.start', {
      traceConfig: {
        includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline',
          'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'v8.execute', 'toplevel'],
        recordMode: 'recordAsMuchAsPossible',
      },
      transferMode: 'ReportEvents',
    });
    console.log('tracing on for run1');
  }
  await cdp.ev(`__perf.start('run${run + 1}')`);
  const t0 = Date.now();
  let folds = 0, settled = false, settleAt = 0, brokeAt = 0;
  const marks = [];
  for (let i = 0; i < 400; i++) {
    const target = t0 + i * PERIOD;
    const wait = target - Date.now();
    if (wait > 2) await sleep(wait);
    // stop if settled
    const done = await cdp.ev(`(() => { const m = document.getElementById('cardModal'); return !!m && !m.hidden; })()`);
    if (done) { settled = true; settleAt = Date.now() - t0; break; }
    if (Date.now() - t0 > 120000) { out.notes.push('run' + (run + 1) + ' hit 120s cap'); break; }
    await foldGesture(cdp);
    folds++;
    const brk = await cdp.ev(`window.__duo.game.broken`);
    if (brk && !brokeAt) { brokeAt = Date.now() - t0; await cdp.ev(`__perf.mark('break')`); }
  }
  // 结算后等弹窗图片解码 + 一帧绘制
  await sleep(500);
  if (TRACE && run === 0) {
    await cdp.send('Tracing.end');
    for (let i = 0; i < 200 && !cdp.traceDone; i++) await sleep(100);
    fs.writeFileSync(`D:/tmp/duo-perf/trace-${TAG}.json`, JSON.stringify({ traceEvents: cdp.traceChunks }));
    console.log('trace events', cdp.traceChunks.length);
    cdp.traceChunks = null;
  }
  const buf = await cdp.ev(`(() => { const b = __perf.stop(); return b; })()`);
  const after = await metrics(cdp);
  const dm2 = {}; for (const k of Object.keys(after)) dm2[k] = +(after[k] - (before[k] || 0)).toFixed(4);
  const abs = { ...after };
  const state = await cdp.ev(STATE);
  const shotPath = await shot(cdp, `perf-${TAG}-run${run + 1}-settled`);
  out.runs.push({
    run: run + 1, foldsSent: folds, settled, settleMs: settleAt, brokeAt,
    durationMs: Date.now() - t0, state, buf, metrics: dm2, abs, shot: shotPath,
  });
  console.log(`run${run + 1}: folds=${folds} settled=${settled} ms=${Date.now() - t0} frames=${buf.frames.length}`);
  await sleep(300);
}

fs.writeFileSync(OUT, JSON.stringify(out));
console.log('WROTE', OUT);
await cdp.send('Page.close').catch(() => {});
process.exit(0);
