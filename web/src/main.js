import * as THREE from 'three';
import { Game, MAX_STAGE, FAN_MAX, SAND_MAX, flatLine, TRAIT_MAP, RARITY, TRAITS, acLevelFor, HOLD_MS, HOLD_FIRST_DELAY, holdPulseMs, holdPulseGap } from './logic.js';
import { createPhone, makeEnvironment, setWallpaper } from './phone.js';
import { makeCard } from './card.js';
import { t, applyStatic } from './i18n.js';
import { loadAch, loadAcMax, saveAcMax, recordRun, traitCount, unseenCount, markSeen } from './achievements.js';

const $ = (id) => document.getElementById(id);
let starsEl = null;
let lastAppliedBend = 1e9;   // 形变去重，同一角度不重复计算
let dustAcc = 0;
requestAnimationFrame(() => { starsEl = document.querySelector('.stars'); });


// ================= 背景尘埃粒子（canvas，逐颗随机） =================
const DUST_N = 230;   // 密度先够，再谈随机
let dustCanvas = null;
let dustCtx = null;
let dustParts = [];
let dustW = 0, dustH = 0;

function initDust() {
  dustCanvas = document.getElementById('dust');
  if (!dustCanvas) return;
  dustCtx = dustCanvas.getContext('2d');
  dustParts = Array.from({ length: DUST_N }, () => spawnDust(true));
  DUST_SPRITE_COOL = makeDustSprite('198, 224, 255');
  DUST_SPRITE_WARM = makeDustSprite('255, 226, 190');
  resizeDust();
  window.addEventListener('resize', resizeDust);
}

function spawnDust(initial) {
  return {
    x: Math.random(),
    y: initial ? Math.random() : 1.02 + Math.random() * 0.06,
    r: 0.85 + Math.pow(Math.random(), 1.7) * 2.9,      // 大小跨度拉大，粗细混杂
    vy: 0.005 + Math.random() * 0.028,                 // 上浮速度各不相同
    vx: (Math.random() - 0.5) * 0.0085,                // 横向漂移更明显
    a: 0.20 + Math.random() * 0.62,                    // 基础亮度抬高
    ph: Math.random() * Math.PI * 2,                   // 闪烁相位
    freq: 0.4 + Math.random() * 1.5,                   // 闪烁频率
    warm: Math.random() > 0.72,                        // 少量暖色微粒
  };
}

// 预渲染两张光点贴图：冷 / 暖。每帧只 drawImage，不再创建渐变对象
let DUST_SPRITE_COOL = null;
let DUST_SPRITE_WARM = null;

function makeDustSprite(tint) {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, `rgba(${tint}, 1)`);
  grd.addColorStop(0.38, `rgba(${tint}, 0.34)`);
  grd.addColorStop(1, `rgba(${tint}, 0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return cv;
}

function resizeDust() {
  if (!dustCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);   // 浮尘不需要视网膜级精度
  dustW = dustCanvas.clientWidth || window.innerWidth;
  dustH = dustCanvas.clientHeight || window.innerHeight;
  dustCanvas.width = Math.round(dustW * dpr);
  dustCanvas.height = Math.round(dustH * dpr);
  if (dustCtx) dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateDust(dt, excite) {
  if (!dustCtx || !dustW) return;
  const spd = 1 + excite * 2.6;
  dustCtx.clearRect(0, 0, dustW, dustH);

  for (const p of dustParts) {
    p.y -= p.vy * spd * dt;
    p.x += p.vx * spd * dt;
    if (p.y < -0.03) Object.assign(p, spawnDust(false));
    if (p.x < -0.02) p.x = 1.02;
    if (p.x > 1.02) p.x = -0.02;

    p.ph += dt * p.freq * (1 + excite * 1.8);
    const tw = 0.62 + Math.sin(p.ph) * 0.38;          // 闪烁
    const alpha = p.a * tw * (0.55 + excite * 0.75);

    const cx = p.x * dustW;
    const cy = p.y * dustH;
    const size = p.r * (1 + excite * 0.25) * 6.8;      // sprite 直径

    const spr = p.warm ? DUST_SPRITE_WARM : DUST_SPRITE_COOL;
    dustCtx.globalAlpha = Math.min(1, alpha);
    dustCtx.drawImage(spr, cx - size / 2, cy - size / 2, size, size);
  }
}

// ================= 音频（Web Audio 实时合成，零素材） =================
let actx = null;
function ac() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function noise(acx, dur) {
  const len = Math.max(1, Math.floor(acx.sampleRate * dur));
  const buf = acx.createBuffer(1, len, acx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
// 触感反馈：Android Chrome 可用；iOS Safari 不支持，会静默失败
function haptic(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* 忽略 */ }
}

function tone(acx, freq, dur, vol, shape, at, glide) {
  const o = acx.createOscillator();
  const g = acx.createGain();
  o.type = shape || 'sine';
  o.frequency.value = freq;
  if (glide) {
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, at + dur);
  }
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(acx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function sfx(type) {
  try {
    const acx = ac();
    const now = acx.currentTime;
    if (type === 'fold') {
      const s = acx.createBufferSource();
      s.buffer = noise(acx, 0.09);
      const f = acx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      f.Q.value = 1.4;
      const g = acx.createGain();
      g.gain.setValueAtTime(0.42, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      s.connect(f).connect(g).connect(acx.destination);
      s.start(now);
    } else if (type === 'break') {
      const s = acx.createBufferSource();
      s.buffer = noise(acx, 0.55);
      const f = acx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 800;
      const g = acx.createGain();
      g.gain.setValueAtTime(0.7, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      s.connect(f).connect(g).connect(acx.destination);
      s.start(now);

      const o = acx.createOscillator();
      const og = acx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, now);
      o.frequency.exponentialRampToValueAtTime(42, now + 0.38);
      og.gain.setValueAtTime(0.6, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      o.connect(og).connect(acx.destination);
      o.start(now);
      o.stop(now + 0.48);
    } else if (type === 'up') {
      [523.25, 659.25, 783.99].forEach((fr, i) => {
        const o = acx.createOscillator();
        const g = acx.createGain();
        o.type = 'sine';
        o.frequency.value = fr;
        const t = now + i * 0.075;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g).connect(acx.destination);
        o.start(t);
        o.stop(t + 0.3);
      });
    } else if (type === 'common') {
      tone(acx, 1180, 0.06, 0.16, 'sine', now);
    } else if (type === 'rare') {
      tone(acx, 880, 0.09, 0.18, 'sine', now);
      tone(acx, 1320, 0.12, 0.15, 'sine', now + 0.07);
    } else if (type === 'epic') {
      [660, 880, 1100, 1320].forEach((f, i) => tone(acx, f, 0.14, 0.14, 'triangle', now + i * 0.055));
      tone(acx, 220, 0.3, 0.1, 'sine', now, true);
    } else if (type === 'legendary') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(acx, f, 0.5, 0.16, 'sine', now + i * 0.05));
      [261.6, 392, 523.25].forEach((f) => tone(acx, f, 0.9, 0.1, 'triangle', now + 0.18, true));
      tone(acx, 130, 0.7, 0.16, 'sine', now + 0.2, true);
    } else if (type === 'sand') {
      const s = acx.createBufferSource();
      s.buffer = noise(acx, 0.11);
      const f = acx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1500;
      f.Q.value = 1.1;
      const g = acx.createGain();
      g.gain.setValueAtTime(0.13, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      s.connect(f).connect(g).connect(acx.destination);
      s.start(now);
    } else if (type === 'hinge') {
      // 铰链异响：沙哑的金属摩擦
      const s = acx.createBufferSource();
      s.buffer = noise(acx, 0.16);
      const f = acx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 780;
      f.Q.value = 6;
      const g = acx.createGain();
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      s.connect(f).connect(g).connect(acx.destination);
      s.start(now);
    } else if (type === 'glitch') {
      const s = acx.createBufferSource();
      s.buffer = noise(acx, 0.22);
      const f = acx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(3200, now);
      f.frequency.exponentialRampToValueAtTime(700, now + 0.22);
      const g = acx.createGain();
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      s.connect(f).connect(g).connect(acx.destination);
      s.start(now);
    }
  } catch (e) { /* 静音失败不影响游戏 */ }
}

// ================= Three.js 场景 =================
const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  // 拿不到 WebGL2 上下文时别让整页静默白屏：给出可读原因（部分机型的省电模式/隐私设置会禁掉）
  window.__bootErr?.(t('boot.webgl', { e: err && err.message ? err.message : err }));
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.30;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
// 背景交给 CSS：纯黑底色没有暗部空间，所有浮层只能靠亮度区分，层次立不起来
scene.background = null;

const camera = new THREE.PerspectiveCamera(35, 1, 0.8, 20);
camera.position.set(0, 0, 9.5);

const envTex = makeEnvironment(renderer);
scene.environment = envTex;

scene.add(new THREE.HemisphereLight(0xd6e4ff, 0x1e232b, 0.95));

const keyLight = new THREE.DirectionalLight(0xffffff, 3.3);
keyLight.position.set(3.5, 4.5, 6);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8fb0ff, 2.0);
rimLight.position.set(-5, -1.5, -4);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xffd8b8, 1.1);
fillLight.position.set(4, -3, 3);
scene.add(fillLight);

const phone = createPhone();
phone.group.position.y = 0.11;
phone.group.rotation.x = -0.14;   // 略微俯视，增强立体感
phone.group.rotation.y = 0.06;
scene.add(phone.group);

const game = new Game();
// 本机历史上摸到过的最高品阶：决定延保能升级到几次（数值存档在成就页的本地存档里）
let bestStage = loadAch().bestStage || 0;
game.acMax = loadAcMax();

// ================= 玻璃碎片 + 镜头震动 =================
const SHARD_COUNT = 120;
let shardPoints = null;
let shardData = null;

function initShards() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(SHARD_COUNT * 3);
  const col = new Float32Array(SHARD_COUNT * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.026,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  shardPoints = new THREE.Points(geo, mat);
  shardPoints.visible = false;
  scene.add(shardPoints);

  shardData = Array.from({ length: SHARD_COUNT }, () => ({
    v: new THREE.Vector3(),
    life: 0,
  }));
}

function burstShards(tint, count) {
  if (!shardPoints) return;
  const pos = shardPoints.geometry.attributes.position.array;
  const col = shardPoints.geometry.attributes.color.array;
  const gx = phone.group.position.x;
  const gy = phone.group.position.y;

  const n = Math.min(count || SHARD_COUNT, SHARD_COUNT);
  const base = tint ? new THREE.Color(tint) : null;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = gx + (Math.random() - 0.5) * 1.45;
    pos[i * 3 + 1] = gy + (Math.random() - 0.5) * 1.05;
    pos[i * 3 + 2] = 0.06;

    const d = shardData[i];
    const a = Math.random() * Math.PI * 2;
    const sp = 0.6 + Math.random() * 2.4;
    d.v.set(
      Math.cos(a) * sp * 0.55,
      Math.sin(a) * sp * 0.55 + 0.9,
      0.7 + Math.random() * 2.2
    );
    d.life = 1.3 + Math.random() * 1.2;

    const t = Math.random();
    if (base) {
      col[i * 3] = base.r * (0.8 + t * 0.5);
      col[i * 3 + 1] = base.g * (0.8 + t * 0.5);
      col[i * 3 + 2] = base.b * (0.8 + t * 0.5);
    } else {
      col[i * 3] = 0.72 + t * 0.28;
      col[i * 3 + 1] = 0.86 + t * 0.14;
      col[i * 3 + 2] = 1.0;
    }
  }
  shardPoints.geometry.attributes.position.needsUpdate = true;
  shardPoints.geometry.attributes.color.needsUpdate = true;
  shardPoints.material.opacity = 1;
  shardPoints.visible = true;
}

function updateShards(dt) {
  if (!shardPoints || !shardPoints.visible) return;
  const pos = shardPoints.geometry.attributes.position.array;
  let alive = 0;
  let maxLife = 0;

  for (let i = 0; i < SHARD_COUNT; i++) {
    const d = shardData[i];
    if (d.life <= 0) continue;
    d.life -= dt;
    d.v.y -= 3.4 * dt;
    d.v.multiplyScalar(0.984);
    pos[i * 3] += d.v.x * dt;
    pos[i * 3 + 1] += d.v.y * dt;
    pos[i * 3 + 2] += d.v.z * dt;
    if (d.life > 0) {
      alive++;
      if (d.life > maxLife) maxLife = d.life;
    }
  }
  shardPoints.geometry.attributes.position.needsUpdate = true;
  shardPoints.material.opacity = Math.min(1, maxLife / 1.1);
  if (alive === 0) shardPoints.visible = false;
}

let camShake = 0;
function shakeCamera(amount) {
  camShake = Math.max(camShake, amount);
}

// ================= 词条辉光（在机身背后，不糊在正面）=================
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const glowSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0x4aa3ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
);
glowSprite.position.set(0, 0.12, -0.75);
glowSprite.scale.set(3.2, 3.2, 1);
scene.add(glowSprite);

const glowState = { active: false, t: 0, dur: 1.0 };

// 常驻背光：让模型从背景里"浮"出来，而不是贴在一块死板上
const ambGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0x2a4a72,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
);
ambGlow.position.set(0, 0.1, -1.6);
ambGlow.scale.set(6.2, 5.4, 1);
scene.add(ambGlow);

function triggerGlow(hex, dur) {
  glowSprite.material.color.set(hex);
  glowState.active = true;
  glowState.t = 0;
  glowState.dur = dur || 1.0;
}

// ================= 状态同步 =================
function screenState() {
  return {
    stage: game.stage,
    folds: game.folds,
    broken: game.broken,
    matte: !game.has('mattegone'),
    sand: game.sandUsed > 0,
    traits: game.traits,
  };
}

const logEl = $('log');
let logs = [];
function log(msg) {
  if (!msg) return;
  logs.push(msg);
  if (logs.length > 4) logs.shift();
  logEl.innerHTML = logs
    .map((t, i) => `<p class="${i < logs.length - 1 ? 'fade' : ''}">${t}</p>`)
    .join('');
}

const traitBar = $('traits');
const RAR_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 };

function updateTraitsUI() {
  // 高稀有度排在前面，视觉上先看到珍贵的那几个
  const sorted = [...game.traits].sort(
    (a, b) => RAR_ORDER[TRAIT_MAP[a].rarity] - RAR_ORDER[TRAIT_MAP[b].rarity]
  );
  traitBar.innerHTML = sorted
    .map((id) => {
      const tr = TRAIT_MAP[id];
      const r = RARITY[tr.rarity];
      return `<span class="trait r-${tr.rarity}" style="color:${r.color}"><i></i>${tr.name}</span>`;
    })
    .join('');
  const cnt = $('traitCount');
  if (cnt) cnt.textContent = t('hud.traits', { n: game.traits.length });
}

const GLOW_COLOR = {
  blue: 0x4aa3ff,
  violet: 0xb76bff,
  gold: 0xffb020,
};

function flashScreen(kind) {
  triggerGlow(GLOW_COLOR[kind] || 0x4aa3ff, kind === 'gold' ? 1.5 : 1.0);
}

const HAPTIC_BY_RARITY = {
  common: [18],
  rare: [22, 45, 22],
  epic: [30, 50, 30, 50, 45],
  legendary: [40, 55, 40, 55, 70, 60, 130],
};

function celebrateTrait(t) {
  if (!t) return;
  sfx(t.rarity);
  haptic(HAPTIC_BY_RARITY[t.rarity] || [18]);
  updateTraitsUI();

  if (t.rarity === 'legendary') {
    // 传说：金色三重脉冲 + 金色粒子迸发 + 镜头轻震
    flashScreen('gold');
    burstShards(0xffb020, 90);
    shakeCamera(0.028);
    [0, 260, 520].forEach((ms, i) =>
      setTimeout(() => {
        triggerGlow(0xffb020, 1.1);
        sfx('legendary');
      }, ms)
    );
    showRarityBanner(t, 'legendary');
  } else if (t.rarity === 'epic') {
    // 史诗：紫色双脉冲 + 紫色粒子
    flashScreen('violet');
    burstShards(0xb76bff, 55);
    shakeCamera(0.016);
    setTimeout(() => triggerGlow(0xb76bff, 0.9), 240);
    showRarityBanner(t, 'epic');
  } else if (t.rarity === 'rare') {
    flashScreen('blue');
    showRarityBanner(t, 'rare');
  }
}


// 稀有度横幅：斜向贯穿整屏的条带。分三档，越稀有层次越多。
// rare = 单带快扫 / epic = 双层 + 扫光 + 文字弹入 / legendary = 三层 + 双扫光 + 星点 + 逐字上浮
function showRarityBanner(trait, rarity) {
  const RAR = {
    rare: { label: t('rar.banner.rare'), color: '#4aa3ff', hold: 1400 },
    epic: { label: t('rar.banner.epic'), color: '#b76bff', hold: 1750 },
    legendary: { label: t('rar.banner.legendary'), color: '#ffb020', hold: 2300 },
  };
  const cfg = RAR[rarity];
  if (!cfg) return;
  playBand(cfg.label, trait.name, cfg.color, cfg.hold, rarity);
}

function showAcBanner(left) {
  const n = typeof left === 'number' ? left : 0;
  const text = n > 0 ? t('band.acSwap', { n }) : t('band.acEmpty');
  playBand('CARE+', text, '#00ff88', 2350, 'epic');
}

function playBand(label, name, color, hold, tier) {
  const el = document.createElement('div');
  el.className = `rarity-band tier-${tier || 'rare'}`;
  el.style.setProperty('--rc', color);

  let extra = '';
  if (tier === 'legendary') {
    // 三条错落的光带 + 星点
    extra =
      '<div class="rb-echo rb-echo-1"></div>' +
      '<div class="rb-echo rb-echo-2"></div>' +
      '<div class="rb-sheen"></div>' +
      '<div class="rb-sheen rb-sheen-2"></div>' +
      '<div class="rb-stars"></div>';
  } else if (tier === 'epic') {
    extra = '<div class="rb-echo rb-echo-1"></div><div class="rb-sheen"></div>';
  }

  // 传说：名字逐字上浮
  const nameHtml =
    tier === 'legendary'
      ? [...name].map((ch, i) =>
          `<span class="rb-ch" style="--i:${i}">${ch}</span>`).join('')
      : name;

  el.innerHTML =
    extra +
    '<div class="rb-inner">' +
    `<span class="rb-label">${label}</span>` +
    `<span class="rb-name">${nameHtml}</span>` +
    '</div>';

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));

  setTimeout(() => {
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => el.remove(), 460);
  }, hold);
}

// 延保（CARE+）：上限随「本机历史最高品阶」解锁，升级必须玩家在折叠数为 0 时自己点
function acTargetLevel() {
  return acLevelFor(Math.max(bestStage, game.stage));
}

function updateAcUI() {
  const btn = $('btnAC');
  if (!btn) return;
  const target = acTargetLevel();
  const canUp = game.folds === 0 && !game.broken && !game.finished && target > game.acMax;
  const left = game.acLeft;

  btn.disabled = !canUp;
  btn.classList.toggle('can-upgrade', canUp);
  btn.classList.toggle('is-armed', !canUp && left > 0);
  btn.classList.toggle('spent', left === 0);
  btn.title = canUp
    ? t('ac.titleUp', { best: Math.max(bestStage, game.stage), target })
    : t('ac.titleLeft', { n: left });

  const sub = btn.querySelector('b');
  if (sub) sub.textContent = canUp ? t('ac.subUp', { n: target }) : t('ac.subLeft', { n: left });

  // 开局前把「本机历史最高」和升级规则摊开给玩家看；开局后收起，把空间还给日志
  const note = $('careNote');
  if (note) {
    const best = Math.max(bestStage, game.stage);
    const showNote = game.folds === 0 && !game.broken && !game.finished;
    note.hidden = !showNote;
    if (showNote) {
      const cnBest = $('cnBest');
      if (cnBest) cnBest.textContent = best > 0 ? `STAGE ${String(best).padStart(2, '0')}` : t('care.none');
      const lvTarget = acLevelFor(best);
      note.querySelectorAll('.cn-rule i').forEach((el) => {
        const lv = Number(el.dataset.lv);
        el.classList.toggle('on', game.acMax >= lv);
        el.classList.toggle('next', game.acMax < lv && lv <= lvTarget);
      });
    }
  }
}

function updateUI() {
  const foldsEl = $('foldsLine');
  if (foldsEl) foldsEl.innerHTML = t('hud.folds', { n: game.folds });
  $('stageName').textContent = game.stageName;
  $('stageName').classList.toggle('dead', game.broken);
  $('stageSub').textContent = `STAGE ${String(game.stage).padStart(2, '0')} / ${String(MAX_STAGE).padStart(2, '0')}`;

  // 品阶身份牌：阶数徽章 + 品阶色 + 10 格进度
  const badge = $('stageBadge');
  if (badge) badge.textContent = String(game.stage).padStart(2, '0');
  const stageColor = game.broken ? '#ff4d5e'
    : game.stage >= 9 ? '#ff4d5e'
    : game.stage >= 7 ? '#ffb020'
    : game.stage >= 5 ? '#b76bff'
    : game.stage >= 3 ? '#4aa3ff'
    : '#00ff88';
  const tag = document.querySelector('.stagetag');
  if (tag) tag.style.setProperty('--sc', stageColor);

  const bar = $('stageBar');
  if (bar && bar.children.length !== MAX_STAGE) {
    bar.innerHTML = Array.from({ length: MAX_STAGE }, () => '<i></i>').join('');
  }
  if (bar) {
    [...bar.children].forEach((seg, i) => {
      seg.classList.toggle('on', i < game.stage);
    });
  }

  const riskEl = $('risk');
  if (game.broken || game.finished) {
    riskEl.textContent = game.broken ? t('risk.dead') : t('risk.settled');
    riskEl.classList.add('danger');
  } else {
    const pb = game.breakChance(1) * 100;
    const pu = game.upChance() * 100;
    const pf = Math.max(0, 100 - pb - pu);
    riskEl.textContent = t('risk.next', { b: pb.toFixed(1), u: pu.toFixed(1), f: pf.toFixed(1) });
    riskEl.classList.toggle('danger', pb > 35);
  }

  const playable = !game.broken && !game.finished;
  $('btnFan').disabled = !playable || game.fanUsed >= FAN_MAX;
  $('btnSand').disabled = !playable || game.sandUsed >= SAND_MAX;
  $('btnStop').disabled = !playable;
  const setBadge = (id, text) => {
    const b = $(id)?.querySelector('b');
    if (b) b.textContent = text;
  };
  setBadge('btnFan', `${FAN_MAX - game.fanUsed}`);
  setBadge('btnSand', `${SAND_MAX - game.sandUsed}`);
  updateAcUI();

  updateTraitsUI();
  syncSwipeHint();
  phone.updateScreen(screenState());
}

// ================= 新手引导：折叠数回到 0 就出现（每台新机都会重新显示） =================
let hintSuppressed = false;   // 拖拽时先让位；松手没折成再回来

function syncSwipeHint() {
  const el = $('swipeHint');
  if (!el) return;
  const show = game.folds === 0 && !game.broken && !game.finished && !hintSuppressed && !autoFolding;
  el.classList.toggle('gone', !show);
  el.setAttribute('aria-hidden', show ? 'false' : 'true');
}

// ================= 长按：按住维持自动连续折叠，松手即停 =================
const HOLD_SLOP = 14;     // 手指抖超过这么多就当作拖拽，不算长按
const AUTO_GAP = 540;     // 每次自动折叠之间的间隔

let holdStartAt = 0;
let holdTimer = 0;
let holdPoint = { x: 0, y: 0 };
let charging = false;     // 长按充能中（震动逐渐变强）
let autoFolding = false;
let autoTimer = 0;
let activePointerId = null;   // 正在维持长按/自动折叠的手指，其它触点一律不接管

function setHoldProgress(p) {
  const hint = $('swipeHint');
  if (hint) hint.style.setProperty('--hold', p.toFixed(3));
}

function cancelHold() {
  if (!charging) return;
  charging = false;
  clearTimeout(holdTimer);
  holdTimer = 0;
  const hint = $('swipeHint');
  if (hint) {
    hint.classList.remove('charging');
    hint.style.removeProperty('--hold');
  }
}

// 充能脉冲：越接近启动，单次越长、间隔越短——手感上是"蓄力"
function holdTick() {
  if (!charging) return;
  const p = Math.min(1, (performance.now() - holdStartAt) / HOLD_MS);
  setHoldProgress(p);
  if (p >= 1) {
    cancelHold();
    startAutoFold();      // 启动瞬间不再补震动：那一下已经是最强的一次脉冲
    return;
  }
  haptic([holdPulseMs(p)]);
  holdTimer = setTimeout(holdTick, holdPulseGap(p));
}

function startHold(x, y) {
  if (autoFolding || game.broken || game.finished) return;
  holdPoint = { x, y };
  holdStartAt = performance.now();
  charging = true;
  const hint = $('swipeHint');
  if (hint) hint.classList.add('charging');
  setHoldProgress(0);
  // 第一下震动留个缓闸：正常拖拽掰弯不会白白挨一下震动
  holdTimer = setTimeout(holdTick, HOLD_FIRST_DELAY);
}

let foldSwingTimer = 0;   // 每一下自动折叠的"掰下去"动画计时

function autoFoldStep() {
  if (!autoFolding) return;
  if (game.broken || game.finished) { stopAutoFold(); return; }
  targetBend = FOLD_CLOSE * 0.9;            // 视觉上真的掰下去
  foldSwingTimer = setTimeout(() => {
    foldSwingTimer = 0;
    if (!autoFolding) return;
    targetBend = 0;
    doFold(0.9);                            // 走正常的折叠流程：判定、音效、游戏内震动都在里面
    if (game.broken || game.finished) { stopAutoFold(); return; }
    autoTimer = setTimeout(autoFoldStep, AUTO_GAP);
  }, 170);
}

function startAutoFold() {
  if (autoFolding || game.broken || game.finished) return;
  autoFolding = true;
  hintSuppressed = true;
  syncSwipeHint();
  sfx('up');
  log(t('log.holdLock'));
  autoFoldStep();
}

function stopAutoFold() {
  if (!autoFolding) return;
  autoFolding = false;
  clearTimeout(autoTimer);
  clearTimeout(foldSwingTimer);
  autoTimer = 0;
  foldSwingTimer = 0;
  targetBend = 0;
  hintSuppressed = false;
  syncSwipeHint();
  if (!game.broken && !game.finished) log(t('log.autoStop'));
}

// ================= 交互：拖拽掰弯 =================
let dragging = false;
let dragStartX = 0;
let bend = 0;
let targetBend = 0;
const FOLD_CLOSE = Math.PI / 2;   // 合到 180°（每块 90°）
const BEND_BACK = 0.58;           // 反向掰的上限
const FOLD_THRESHOLD = 0.34;      // 超过这个幅度松手算一次折叠

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// 切窗口/失焦等于手指不再按着：自动折叠必须跟着停
window.addEventListener('blur', () => releasePointer(null));

canvas.addEventListener('pointerdown', (e) => {
  if (game.broken || game.finished) return;
  // 自动折叠靠"按住"维持：这期间新的按下不接管、也不会打断它（松手才停）
  if (autoFolding || activePointerId !== null) return;
  activePointerId = e.pointerId;
  dragging = true;
  dragStartX = e.clientX;
  // 指针捕获对合成/陈旧 pointerId 会抛错，别让一次失败打断整条长按链路
  try { canvas.setPointerCapture?.(e.pointerId); } catch (err) { /* 忽略 */ }
  hintSuppressed = true;
  syncSwipeHint();
  startHold(e.clientX, e.clientY);
});

let lastSandTick = 0;
let lastBendSeen = 0;

canvas.addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== activePointerId) return;
  // 自动折叠已经启动：直到松手为止，手指不再控制折叠角度
  if (autoFolding) return;
  // 手一动就退出长按判定；充能期间不跟随拖拽，避免"长按"变成"误掰"
  if (charging) {
    if (Math.hypot(e.clientX - holdPoint.x, e.clientY - holdPoint.y) > HOLD_SLOP) cancelHold();
    return;
  }
  const dx = (e.clientX - dragStartX) / (window.innerWidth * 0.58);
  targetBend = dx >= 0
    ? Math.min(dx * FOLD_CLOSE, FOLD_CLOSE)
    : Math.max(dx * (BEND_BACK / 0.5), -BEND_BACK);
  bend = targetBend;   // 渲染循环里统一 setBend，避免每个指针事件都重算顶点

  // 沙子卡在铰链里：手指滑动过程中就该有细小的阻尼震动，
  // 而不是等到松手判定才震一下。按位移节流，避免每条指针事件都触发。
  if (game.sandUsed > 0 && !game.broken) {
    const now = performance.now();
    const moved = Math.abs(bend - lastBendSeen);
    if (now - lastSandTick > 85 && moved > 0.012) {
      lastSandTick = now;
      lastBendSeen = bend;
      // 越用力掰，沙粒摩擦越明显
      const ms = Math.round(5 + Math.min(7, moved * 90));
      haptic([ms]);
    }
  }
});

function releasePointer(e) {
  // 只认维持住长按的那根手指；其它触点的抬起不影响
  if (e && activePointerId !== null && e.pointerId !== activePointerId) return;
  if (!dragging) return;
  const wasAuto = autoFolding;
  dragging = false;
  activePointerId = null;
  cancelHold();
  // 松手即停：按住多久就折多久，也不再补判一次手动折叠
  if (wasAuto) stopAutoFold();
  if (wasAuto || game.broken || game.finished) { targetBend = 0; return; }
  const strength = Math.abs(bend);
  if (strength >= FOLD_THRESHOLD) {
    doFold(strength);
  } else {
    // 没掰够：指引重新出来
    hintSuppressed = false;
    syncSwipeHint();
  }
  targetBend = 0;
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', releasePointer);

// ================= 游戏动作 =================
function doFold(strength) {
  if (game.broken || game.finished) return;
  sfx('fold');
  if (game.sandUsed > 0) {
    // 铰链里残留沙粒：折叠时轻微的沙涩感
    setTimeout(() => { sfx('sand'); haptic([10, 26, 8]); }, 70);
  }
  haptic(Math.round(8 + strength * 14));
  if (game.has('rattle')) setTimeout(() => sfx('hinge'), 130);
  const r = game.fold();

  if (r.result === 'break') {
    sfx('break');
    haptic([90, 50, 140, 60, 200]);
    burstShards();
    shakeCamera(0.085);
    log('');
    log(t('log.snap'));
    log(t('log.break', { name: game.stageName, n: game.folds }));
    log(t('log.support'));
    updateUI();
    setTimeout(showCard, 900);
    return;
  }

  if (r.result === 'up') {
    sfx('up');
    log(t('log.stageUp', { name: game.stageName }));
    if (game.stage === 4) log(t('log.stage4'));
    if (game.stage === 5) { sfx('glitch'); log(t('log.stage5')); }
    if (game.stage >= 9) log(t('log.stage9'));
  } else if (r.result === 'ac') {
    // 延保自动生效：绿色脉冲 + 绿色粒子 + 强震动
    sfx('glitch');
    sfx('up');
    haptic([60, 70, 60, 70, 140]);
    triggerGlow(0x00ff88, 1.8);
    burstShards(0x00ff88, 70);
    shakeCamera(0.035);
    setTimeout(() => triggerGlow(0x00ff88, 1.2), 320);
    showAcBanner(r.left);
    log(r.text);
    log(r.left > 0
      ? t('log.acLeft', { n: r.left })
      : t('log.acSpent'));
  } else if (r.result === 'guarded') {
    log(strength > FOLD_THRESHOLD ? t('log.guarded') : '');
  } else {
    log(flatLine());
  }
  if (r.trait) celebrateTrait(r.trait);
  updateUI();
}

$('btnFan').addEventListener('click', () => {
  const res = game.useFan();
  if (!res) return;
  sfx('glitch');
  haptic([25, 40, 25]);
  log(res.text);
  res.gained.forEach((t) => setTimeout(() => celebrateTrait(t), 220));
  updateUI();
});
$('btnSand').addEventListener('click', () => {
  const res = game.useSand();
  if (!res) return;
  sfx('hinge');
  haptic([35, 60, 35]);
  log(res.text);
  res.gained.forEach((t) => setTimeout(() => celebrateTrait(t), 220));
  updateUI();
});
// 延保：折叠数为 0 时点它升级「本局最多能续命几次」；局内自动生效，不需要手动开
$('btnAC').addEventListener('click', () => {
  if (game.folds !== 0 || game.broken || game.finished) return;
  const up = game.upgradeAc(acTargetLevel());
  if (!up) return;
  saveAcMax(up.to);
  sfx('up');
  setTimeout(() => sfx('legendary'), 150);
  haptic([30, 50, 30, 50, 90]);
  triggerGlow(0xffb020, 1.3);
  burstShards(0xffb020, 60);
  playBand('CARE+', t('band.acUpgrade', { n: up.to }), '#ffb020', 1900, 'epic');
  log(t('log.acUpgrade', { to: up.to, from: up.from }));
  updateUI();
});

$('btnStop').addEventListener('click', () => {
  stopAutoFold();
  if (!game.stop()) return;
  log(t('log.stop', { n: game.folds }));
  updateUI();
  showCard();
});

// ================= 成就页 =================
let freshIds = [];   // 本次打开前还没看过的解锁，卡片上标 NEW

function renderBook() {
  const a = loadAch();
  const total = TRAITS.length;
  const unlocked = TRAITS.filter((t) => traitCount(a, t.id) > 0).length;
  const pct = total ? unlocked / total : 0;

  // 进度环
  const CIRC = 188.5;
  const ring = $('ringFg');
  ring.style.strokeDashoffset = String(CIRC * (1 - pct));
  $('ringText').textContent = Math.round(pct * 100) + '%';
  $('bookProgress').textContent = t('book.progress', { u: unlocked, t: total });

  $('bookStats').innerHTML = `
    <div class="book-stat"><b>${a.bestStage}</b><span>${t('book.stat.stage')}</span></div>
    <div class="book-stat"><b>${a.bestFolds}</b><span>${t('book.stat.folds')}</span></div>
    <div class="book-stat"><b>${a.runs}</b><span>${t('book.stat.runs')}</span></div>
    <div class="book-stat"><b>${a.legendary}</b><span>${t('book.stat.legendary')}</span></div>
  `;

  const groups = [
    { key: 'legendary' },
    { key: 'epic' },
    { key: 'rare' },
    { key: 'common' },
  ];

  $('bookGrid').innerHTML = groups
    .map((g) => {
      const list = TRAITS.filter((tr) => tr.rarity === g.key);
      if (!list.length) return '';
      const got = list.filter((tr) => traitCount(a, tr.id) > 0).length;
      const cards = list
        .map((tr) => {
          const n = traitCount(a, tr.id);
          const rar = RARITY[tr.rarity];
          const locked = n === 0;
          const fresh = !locked && freshIds.includes(tr.id);
          return `<div class="book-trait ${locked ? 'locked' : ''} ${fresh ? 'fresh' : ''}">
            <div class="bt-top">
              <span class="bt-name" style="color:${locked ? 'var(--dim)' : rar.color}">${locked ? '???' : tr.name}</span>
              <span class="bt-rarity" style="color:${rar.color}">${rar.label}</span>
            </div>
            <div class="bt-desc">${locked ? t('book.locked') : tr.desc}</div>
            ${locked ? '' : `<div class="bt-count">×${n}${fresh ? '<i class="bt-new">NEW</i>' : ''}</div>`}
          </div>`;
        })
        .join('');
      return `<div class="book-group">${RARITY[g.key].label} · ${got}/${list.length}</div>
              <div class="book-grid">${cards}</div>`;
    })
    .join('');
}

// 入口右上角小红点：有没看过的新解锁就点亮，打开成就页即视为看过
function syncBookDot() {
  const dot = $('bookDot');
  if (dot) dot.hidden = unseenCount() === 0;
}

$('btnBook').addEventListener('click', () => {
  freshIds = loadAch().unseen.slice();   // 先记下"这次才看到的"，渲染完再清
  renderBook();
  $('book').hidden = false;
  markSeen();
  syncBookDot();
});
$('closeBook').addEventListener('click', () => { $('book').hidden = true; });
syncBookDot();

// ================= 成就卡片 ==================
function showCard() {
  const ach = recordRun(game, game.traits.some((id) => TRAIT_MAP[id].rarity === 'legendary'));
  bestStage = ach.bestStage;   // 本机最高品阶：延保能升级到几次看它
  syncBookDot();               // 有新解锁 → 成就入口点小红点
  const c = makeCard({
    stage: game.stage,
    stageName: game.stageName,
    stageMax: MAX_STAGE,
    folds: game.folds,
    fan: game.fanUsed,
    sand: game.sandUsed,
    ac: game.acUsed,
    broken: game.broken,
    quote: game.pickQuote(),
    serial: `No.${String(1000 + game.folds * 7 + game.stage * 13).padStart(4, '0')}`,
    traits: game.traits.map((id) => TRAIT_MAP[id]).filter(Boolean),
  });
  const url = c.toDataURL('image/png');
  $('cardImg').src = url;
  $('dlCard').href = url;
  // 文件名里别留空格和 · ：各系统都对它不友好
  const slug = game.stageName.replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '');
  $('dlCard').download = `duo-${game.folds}-${slug}.png`;
  $('cardModal').hidden = false;
}

$('closeCard').addEventListener('click', () => {
  stopAutoFold();
  $('cardModal').hidden = true;
  game.reset();
  logs = [];
  logEl.innerHTML = '';
  traitBar.innerHTML = '';
  log(t('log.newRun'));
  log(t('log.holdHint'));
  bend = 0;
  targetBend = 0;
  hintSuppressed = false;   // 折叠数归 0，滑动手势指引重新出现
  phone.setBend(0);
  if (shardPoints) {
    shardPoints.visible = false;
    shardData.forEach((d) => { d.life = 0; });
  }
  camShake = 0;
  camera.position.x = 0;
  camera.position.y = 0;
  updateUI();
});

// ================= 布局与渲染 =================
function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;

  // 展开总宽 = HALF_W*2 = 1.58，按宽度适配（占屏 86%，留出边距）
  const phoneW = 1.58;
  const vw = phoneW / 0.66;   // 除数 = 机身占视口宽度比例
  const z = vw / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);

  camera.position.z = z;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', layout);

let last = performance.now();
let screenTimer = 0;
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // 自动折叠期间手指不参与控制，角度必须走阻尼才能演出"掰下去"的动画
  if (!dragging || autoFolding) {
    const damp = game.sandUsed > 0 ? 9 : 14;   // 沙子卡住铰链，回弹更滞
    bend += (targetBend - bend) * Math.min(1, dt * damp);
    if (Math.abs(bend) < 0.0006) bend = 0;
  }
  // 每帧最多应用一次形变（拖拽时同样走这里）
  if (bend !== lastAppliedBend) {
    phone.setBend(bend);
    lastAppliedBend = bend;
  }

  updateShards(dt);

  const tickExcite = Math.min(Math.abs(bend) / (Math.PI / 2), 1);
  // 粒子 30fps 更新：浮尘本来就慢，隔帧画看不出差别，能省一半 2D 绘制
  dustAcc += dt;
  if (dustAcc >= 0.033) {
    updateDust(dustAcc, tickExcite);
    dustAcc = 0;
  }

  if (glowState.active) {
    glowState.t += dt;
    const p = glowState.t / glowState.dur;
    if (p >= 1) {
      glowState.active = false;
      glowSprite.material.opacity = 0;
    } else {
      glowSprite.material.opacity = Math.sin(p * Math.PI) * 0.9;
      const s = 3.0 + p * 2.2;
      glowSprite.scale.set(s, s, 1);
    }
  }

  // 镜头震动
  if (camShake > 0.0008) {
    camera.position.x = (Math.random() - 0.5) * camShake;
    camera.position.y = (Math.random() - 0.5) * camShake;
    camShake *= Math.pow(0.0025, dt);
  } else if (camShake !== 0) {
    camShake = 0;
    camera.position.x = 0;
    camera.position.y = 0;
  }

  // 高阶故障需要时间驱动（闪屏、触点漂移）
  if (!game.broken && game.stage >= 4) {
    screenTimer += dt;
    if (screenTimer > 0.18) {
      screenTimer = 0;
      phone.updateScreen({ ...screenState(), t: now / 1000 });
    }
  }

  // 折叠时 V 形向观察者凸出、整机又随角度偏转，会让模型顶出视口上沿并向左漂，
  // 这里按折叠角度做位置补偿，保证任何角度下都居中不溢出。
  if (!game.broken) {
    const ab = Math.abs(bend);
    const excite = Math.min(ab / (Math.PI / 2), 1);          // 0~1 折叠强度

    // 模型保持稳定：动效交给背景层，机身只做必要的构图补偿
    phone.group.position.y = 0.11 - ab * 0.13;
    phone.group.position.x = -ab * 0.24;
    phone.group.rotation.z = 0;

    // 折叠强度交给 CSS，驱动背景动效的强弱
    document.documentElement.style.setProperty('--excite', excite.toFixed(3));
    // 星点流速也跟着走：静时 46s 一圈，折满时 14s 一圈
    if (starsEl) starsEl.style.animationDuration = `${(46 - excite * 32).toFixed(1)}s`;
  }

  // 报废后缓慢自转，像在看一件遗物
  // 非线性翻转：0-45° 几乎不转（内屏清楚可见），45° 之后加速翻到外屏
  // 左半翻过去后外屏自然朝向观察者，整机不再随折叠旋转（否则右半会看起来在飘）
  const targetRotY = 0.06;
  if (game.broken) {
    phone.group.rotation.y = 0.06 + Math.sin(now / 2600) * 0.24;
  } else {
    phone.group.rotation.y += (targetRotY - phone.group.rotation.y) * Math.min(1, dt * 12);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

initDust();

window.__duo = { scene, camera, phone, renderer, THREE, game, envTex, band: playBand };

// 壁纸（加载完成后重绘一次屏幕）
const wp = new Image();
wp.onload = () => { setWallpaper(wp); updateUI(); };
wp.onerror = () => { console.warn('wallpaper load failed, fallback to gradient'); };
wp.src = './assets/wallpaper-light.jpg';

initShards();
layout();
updateUI();
log(t('log.firstRun'));
log(t('log.holdHint'));
requestAnimationFrame(tick);
