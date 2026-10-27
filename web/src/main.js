import * as THREE from 'three';
import { Game, MAX_STAGE, FAN_MAX, SAND_MAX, FLAT_LINES, TRAIT_MAP, RARITY, TRAITS } from './logic.js';
import { createPhone, makeEnvironment, setWallpaper } from './phone.js';
import { makeCard } from './card.js';
import { loadAch, recordRun, traitCount } from './achievements.js';

const $ = (id) => document.getElementById(id);

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
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
      const t = TRAIT_MAP[id];
      const r = RARITY[t.rarity];
      return `<span class="trait r-${t.rarity}" style="color:${r.color}"><i></i>${t.name}</span>`;
    })
    .join('');
  const cnt = $('traitCount');
  if (cnt) cnt.textContent = `词条 ${game.traits.length} / 9`;
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
function showRarityBanner(t, rarity) {
  const RAR = {
    rare: { label: '稀有词条', color: '#4aa3ff', hold: 1400 },
    epic: { label: '史诗词条', color: '#b76bff', hold: 1750 },
    legendary: { label: '传说词条', color: '#ffb020', hold: 2300 },
  };
  const cfg = RAR[rarity];
  if (!cfg) return;
  playBand(cfg.label, t.name, cfg.color, cfg.hold, rarity);
}

function showAcBanner() {
  playBand('CARE+', '自动生效 · 已换机', '#00ff88', 2350, 'epic');
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

function updateUI() {
  $('foldCount').textContent = game.folds;
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
    riskEl.textContent = game.broken ? '已报废' : '已结算';
    riskEl.classList.add('danger');
  } else {
    const pb = game.breakChance(1) * 100;
    const pu = game.upChance() * 100;
    const pf = Math.max(0, 100 - pb - pu);
    riskEl.textContent = `下一折：碎裂 ${pb.toFixed(1)}%　升阶 ${pu.toFixed(1)}%　白折 ${pf.toFixed(1)}%`;
    riskEl.classList.toggle('danger', pb > 35);
  }

  const playable = !game.broken && !game.finished;
  $('btnFan').disabled = !playable || game.fanUsed >= FAN_MAX;
  $('btnSand').disabled = !playable || game.sandUsed >= SAND_MAX;
  $('btnAC').disabled = true;   // 已改为自动生效，只做状态展示
  $('btnStop').disabled = !playable;
  const setBadge = (id, text) => {
    const b = $(id)?.querySelector('b');
    if (b) b.textContent = text;
  };
  setBadge('btnFan', `${FAN_MAX - game.fanUsed}`);
  setBadge('btnSand', `${SAND_MAX - game.sandUsed}`);
  setBadge('btnAC', game.acUsed >= 1 ? '已用' : '待命');

  updateTraitsUI();
  phone.updateScreen(screenState());
}

// ================= 交互：拖拽掰弯 =================
let dragging = false;
let dragStartX = 0;
let bend = 0;
let targetBend = 0;
const FOLD_CLOSE = Math.PI / 2;   // 合到 180°（每块 90°）
const BEND_BACK = 0.58;           // 反向掰的上限
const FOLD_THRESHOLD = 0.34;      // 超过这个幅度松手算一次折叠

canvas.addEventListener('pointerdown', (e) => {
  if (game.broken || game.finished) return;
  dragging = true;
  dragStartX = e.clientX;
  canvas.setPointerCapture?.(e.pointerId);
  const h = $('hint');
  if (h) h.classList.add('gone');
});

let lastSandTick = 0;
let lastBendSeen = 0;

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = (e.clientX - dragStartX) / (window.innerWidth * 0.58);
  targetBend = dx >= 0
    ? Math.min(dx * FOLD_CLOSE, FOLD_CLOSE)
    : Math.max(dx * (BEND_BACK / 0.5), -BEND_BACK);
  bend = targetBend;
  phone.setBend(bend);

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

function releasePointer() {
  if (!dragging) return;
  dragging = false;
  const strength = Math.abs(bend);
  if (strength >= FOLD_THRESHOLD) {
    doFold(strength);
  }
  targetBend = 0;
}

canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', releasePointer);

// ================= 游戏动作 =================
let firstFoldDone = false;

function doFold(strength) {
  if (!firstFoldDone) {
    firstFoldDone = true;
    const sh = $('swipeHint');
    if (sh) {
      sh.classList.add('gone');
      setTimeout(() => { sh.style.display = 'none'; }, 600);
    }
  }
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
    log('咔嚓——');
    log(`「${game.stageName}」，${game.folds} 次折叠。`);
    log('客服：属人为损坏。');
    updateUI();
    setTimeout(showCard, 900);
    return;
  }

  if (r.result === 'up') {
    sfx('up');
    log(`升阶！现在是「${game.stageName}」。`);
    if (game.stage === 4) log('屏幕开始偶发闪烁。有点意思了。');
    if (game.stage === 5) { sfx('glitch'); log('折线处窜出一缕荧光绿。有人开始夸它好看了。'); }
    if (game.stage >= 9) log('这已经不能叫手机了。');
  } else if (r.result === 'ac') {
    // 延保自动生效：绿色脉冲 + 绿色粒子 + 强震动
    sfx('glitch');
    sfx('up');
    haptic([60, 70, 60, 70, 140]);
    triggerGlow(0x00ff88, 1.8);
    burstShards(0x00ff88, 70);
    shakeCamera(0.035);
    setTimeout(() => triggerGlow(0x00ff88, 1.2), 320);
    showAcBanner();
    log(r.text);
    log('这一张延保已经用掉了。下次再裂，就是 7998 元。');
  } else if (r.result === 'guarded') {
    log(strength > FOLD_THRESHOLD ? '硬扛下来了。铰链再也合不严。' : '');
  } else {
    log(FLAT_LINES[Math.floor(Math.random() * FLAT_LINES.length)]);
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
// 延保已自动生效，按钮只展示状态
$('btnAC').addEventListener('click', (e) => e.preventDefault());

$('btnStop').addEventListener('click', () => {
  if (!game.stop()) return;
  log(`你把手机收回盒子里。${game.folds} 次折叠，到此为止。`);
  updateUI();
  showCard();
});

// ================= 成就手册 =================
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
  $('bookProgress').textContent = `已解锁 ${unlocked} / ${total}`;

  $('bookStats').innerHTML = `
    <div class="book-stat"><b>${a.bestStage}</b><span>最高品阶</span></div>
    <div class="book-stat"><b>${a.bestFolds}</b><span>最多折叠</span></div>
    <div class="book-stat"><b>${a.runs}</b><span>折坏台数</span></div>
    <div class="book-stat"><b>${a.legendary}</b><span>传说词条</span></div>
  `;

  const groups = [
    { key: 'legendary', label: '传 说' },
    { key: 'epic', label: '史 诗' },
    { key: 'rare', label: '稀 有' },
    { key: 'common', label: '普 通' },
  ];

  $('bookGrid').innerHTML = groups
    .map((g) => {
      const list = TRAITS.filter((t) => t.rarity === g.key);
      if (!list.length) return '';
      const got = list.filter((t) => traitCount(a, t.id) > 0).length;
      const cards = list
        .map((t) => {
          const n = traitCount(a, t.id);
          const rar = RARITY[t.rarity];
          const locked = n === 0;
          return `<div class="book-trait ${locked ? 'locked' : ''}">
            <div class="bt-top">
              <span class="bt-name" style="color:${locked ? 'var(--dim)' : rar.color}">${locked ? '???' : t.name}</span>
              <span class="bt-rarity" style="color:${rar.color}">${rar.label}</span>
            </div>
            <div class="bt-desc">${locked ? '尚未解锁' : t.desc}</div>
            ${locked ? '' : `<div class="bt-count">×${n}</div>`}
          </div>`;
        })
        .join('');
      return `<div class="book-group">${g.label} · ${got}/${list.length}</div>
              <div class="book-grid">${cards}</div>`;
    })
    .join('');
}

$('btnBook').addEventListener('click', () => {
  renderBook();
  $('book').hidden = false;
});
$('closeBook').addEventListener('click', () => { $('book').hidden = true; });

// ================= 成就卡片 ==================
function showCard() {
  recordRun(game, game.traits.some((id) => TRAIT_MAP[id].rarity === 'legendary'));
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
  $('dlCard').download = `duo-${game.folds}折-${game.stageName}.png`;
  $('cardModal').hidden = false;
}

$('closeCard').addEventListener('click', () => {
  $('cardModal').hidden = true;
  game.reset();
  logs = [];
  logEl.innerHTML = '';
  traitBar.innerHTML = '';
  log('又一台新机。官方说这次改进了铰链。');
  log('按住机身，向两侧掰。');
  bend = 0;
  targetBend = 0;
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

  if (!dragging) {
    const damp = game.sandUsed > 0 ? 9 : 14;   // 沙子卡住铰链，回弹更滞
    bend += (targetBend - bend) * Math.min(1, dt * damp);
    if (Math.abs(bend) < 0.0006) bend = 0;
    phone.setBend(bend);
  }

  updateShards(dt);

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
    if (screenTimer > 0.11) {
      screenTimer = 0;
      phone.updateScreen({ ...screenState(), t: now / 1000 });
    }
  }

  // 折叠时 V 形向观察者凸出、整机又随角度偏转，会让模型顶出视口上沿并向左漂，
  // 这里按折叠角度做位置补偿，保证任何角度下都居中不溢出。
  if (!game.broken) {
    const ab = Math.abs(bend);
    // 竖直：防止 V 形顶出视口上沿
    // 水平：主导边翻过去后整体重心右移，需要回正；补偿作用在整机上，
    // 不是让固定那半边参与折叠，所以不会破坏「另一半不动」的手感
    phone.group.position.y = 0.11 - ab * 0.13;
    phone.group.position.x = -ab * 0.24;
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

window.__duo = { scene, camera, phone, renderer, THREE, game, envTex, band: playBand };

// 壁纸（加载完成后重绘一次屏幕）
const wp = new Image();
wp.onload = () => { setWallpaper(wp); updateUI(); };
wp.onerror = () => { console.warn('wallpaper load failed, fallback to gradient'); };
wp.src = './assets/wallpaper-light.jpg';

initShards();
layout();
updateUI();
log('新机到手。15999 元，和 15999 个不舍得。');
log('按住机身，向两侧掰。');
requestAnimationFrame(tick);
