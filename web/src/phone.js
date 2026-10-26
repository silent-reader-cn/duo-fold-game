import * as THREE from 'three';
import { ICONS } from './icons.js';

// ================= 真实尺寸（iPhone Duo）=================
// 内屏 7.6" 4:3 → 展开 157×112mm；外屏 5.4" 在背面；展开厚 5.2mm
// 3D 单位：0.01 单位 ≈ 1mm
const HALF_W = 0.79;       // 单侧宽（展开总宽 1.58）
const HEIGHT = 1.15;       // 机身高度（展开 1.37:1 ≈ 4:3）
const THICK = 0.052;       // 展开厚度
const CORNER = 0.105;      // 机身圆角（iPhone 式大圆角）
const BEVEL = 0.009;

// 内屏画布（整屏 1.4:1，左右各取一半）
const CW = 1024;
const CH = 731;
// 外屏画布（竖屏 0.7:1）
const SW = 512;
const SH = 740;

const CJK = '"PingFang SC","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif';

// ---------------- 形状工具 ----------------
function halfShell(w, h, r, isLeft) {
  const s = new THREE.Shape();
  const y0 = -h / 2;
  const y1 = h / 2;
  if (isLeft) {
    s.moveTo(0, y0);
    s.lineTo(-w + r, y0);
    s.quadraticCurveTo(-w, y0, -w, y0 + r);
    s.lineTo(-w, y1 - r);
    s.quadraticCurveTo(-w, y1, -w + r, y1);
    s.lineTo(0, y1);
    s.lineTo(0, y0);
  } else {
    s.moveTo(0, y0);
    s.lineTo(w - r, y0);
    s.quadraticCurveTo(w, y0, w, y0 + r);
    s.lineTo(w, y1 - r);
    s.quadraticCurveTo(w, y1, w - r, y1);
    s.lineTo(0, y1);
    s.lineTo(0, y0);
  }
  return s;
}

function roundRectPath(ctx, x, y, w, h, radii) {
  // radii: [tl, tr, br, bl]
  const [tl, tr, br, bl] = radii;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

// ---------------- 榴莲 logo（避嫌用，替代苹果标）----------------
function drawDurian(ctx, cx, cy, R) {
  // 刺
  ctx.fillStyle = '#8e9a3a';
  const spikes = 30;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const a2 = a + 0.06;
    const a3 = a - 0.06;
    const tipR = R * 1.16;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a3) * R * 0.94, cy + Math.sin(a3) * R * 0.94);
    ctx.lineTo(cx + Math.cos(a) * tipR, cy + Math.sin(a) * tipR);
    ctx.lineTo(cx + Math.cos(a2) * R * 0.94, cy + Math.sin(a2) * R * 0.94);
    ctx.closePath();
    ctx.fill();
  }
  // 主体
  const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#e2ea7a');
  g.addColorStop(0.6, '#bcc94a');
  g.addColorStop(1, '#8e9a3a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // 咬痕（右上角咬掉一口）
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const biteR = R * 0.34;
  ctx.beginPath();
  ctx.arc(cx + R * 0.82, cy - R * 0.62, biteR, 0, Math.PI * 2);
  ctx.fill();
  // 咬痕边缘的两个小凹口
  ctx.beginPath();
  ctx.arc(cx + R * 0.52, cy - R * 0.92, biteR * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 果柄
  ctx.strokeStyle = '#6f7a2c';
  ctx.lineWidth = R * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - R * 0.95);
  ctx.lineTo(cx, cy - R * 1.28);
  ctx.stroke();
}

function durianTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  drawDurian(ctx, 256, 276, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}


// ---------------- iOS Home 界面 ----------------
const ICON_NAMES = [
  'camera', 'message-circle', 'music', 'map', 'mail', 'settings',
  'calendar', 'cloud-sun', 'clock', 'sticky-note', 'bell', 'trending-up',
  'wallet', 'folder', 'mic', 'heart-pulse', 'book-open', 'house',
  'shopping-bag', 'languages', 'zap', 'calculator', 'audio-lines', 'app-window',
];
const DOCK_ICONS = ['phone', 'compass', 'message-circle', 'camera'];

/** 用 Path2D 描边绘制图标（Lucide 24x24 网格） */
function drawIconGlyph(ctx, name, cx, cy, size, color = 'rgba(255,255,255,.96)') {
  const paths = ICONS[name];
  if (!paths) return;
  const sc = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(sc, sc);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.35 / sc;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < paths.length; i++) {
    ctx.stroke(new Path2D(paths[i]));
  }
  ctx.restore();
}

let _wallpaper = null;
export function setWallpaper(img) { _wallpaper = img; }

function drawHome(ctx, st) {
  // 壁纸
  if (_wallpaper) {
    ctx.drawImage(_wallpaper, 0, 0, CW, CH);
    // 压暗，保证图标可读
    ctx.fillStyle = 'rgba(5,7,16,.26)';
    ctx.fillRect(0, 0, CW, CH);
    // 顶部与底部渐暗，撑出景深
    const topG = ctx.createLinearGradient(0, 0, 0, CH * 0.35);
    topG.addColorStop(0, 'rgba(0,0,0,.32)');
    topG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topG;
    ctx.fillRect(0, 0, CW, CH * 0.35);
    const botG = ctx.createLinearGradient(0, CH * 0.7, 0, CH);
    botG.addColorStop(0, 'rgba(0,0,0,0)');
    botG.addColorStop(1, 'rgba(0,0,0,.30)');
    ctx.fillStyle = botG;
    ctx.fillRect(0, CH * 0.7, CW, CH * 0.3);
  } else {
    const bg = ctx.createRadialGradient(CW * 0.26, CH * 0.20, 30, CW * 0.5, CH * 0.62, CW * 0.98);
    bg.addColorStop(0, '#232e4a');
    bg.addColorStop(0.40, '#141b2c');
    bg.addColorStop(1, '#06080d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CW, CH);
  }

  // --- 状态栏 ---
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(240,244,250,.92)';
  ctx.font = `600 30px ${CJK}`;
  ctx.fillText('9:41', 46, 54);

  ctx.textAlign = 'right';
  ctx.font = `400 24px ${CJK}`;
  ctx.fillStyle = 'rgba(240,244,250,.72)';
  ctx.fillText('5G', CW - 178, 52);

  // 信号条
  ctx.fillStyle = 'rgba(240,244,250,.85)';
  for (let i = 0; i < 4; i++) {
    const h = 6 + i * 4;
    ctx.fillRect(CW - 148 + i * 8, 52 - h, 4.5, h);
  }
  // WiFi
  ctx.strokeStyle = 'rgba(240,244,250,.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CW - 100, 50, 13, -Math.PI * 0.80, -Math.PI * 0.20);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CW - 100, 50, 6.5, -Math.PI * 0.72, -Math.PI * 0.28);
  ctx.stroke();
  // 电池
  ctx.strokeStyle = 'rgba(240,244,250,.8)';
  ctx.lineWidth = 2.4;
  roundRectPath(ctx, CW - 74, 38, 44, 20, [5, 5, 5, 5]);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,244,250,.82)';
  ctx.fillRect(CW - 29, 44, 3.5, 8);
  ctx.fillStyle = 'rgba(240,244,250,.9)';
  roundRectPath(ctx, CW - 70, 42, 30, 12, [3, 3, 3, 3]);
  ctx.fill();

  // --- 图标网格 6x4 ---
  const cols = 6, rows = 4;
  const iconW = 100;
  const gapX = (CW - cols * iconW) / (cols + 1);
  const marginX = gapX;
  const top = 80;
  const rowH = 128;

  // iOS 系统色的双段渐变（上亮下深）
  const colorPairs = [
    ['#5b9cf8', '#1f5fd0'], ['#4ade80', '#0f9d58'], ['#ffd166', '#e08a10'],
    ['#ff7a7a', '#c62828'], ['#b98cff', '#6b39c9'], ['#5eead4', '#0f8f96'],
    ['#ffb066', '#c25a10'], ['#8e99a8', '#4a545f'],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = marginX + c * (iconW + gapX);
      const y = top + r * rowH;
      const rad = [iconW * 0.25, iconW * 0.25, iconW * 0.25, iconW * 0.25];

      const pair = colorPairs[idx % colorPairs.length];
      const bg = ctx.createLinearGradient(x, y, x + iconW * 0.35, y + iconW);
      bg.addColorStop(0, pair[0]);
      bg.addColorStop(1, pair[1]);
      ctx.fillStyle = bg;
      roundRectPath(ctx, x, y, iconW, iconW, rad);
      ctx.fill();

      // 玻璃高光
      const gl = ctx.createLinearGradient(x, y, x, y + iconW);
      gl.addColorStop(0, 'rgba(255,255,255,.30)');
      gl.addColorStop(0.45, 'rgba(255,255,255,.04)');
      gl.addColorStop(1, 'rgba(0,0,0,.16)');
      ctx.fillStyle = gl;
      roundRectPath(ctx, x, y, iconW, iconW, rad);
      ctx.fill();

      // 图标（Lucide 形状，白色描边压在彩色底板上）
      drawIconGlyph(ctx, ICON_NAMES[idx] || 'app-window', x + iconW / 2, y + iconW / 2, iconW * 0.54);

      // 图标名
      ctx.fillStyle = 'rgba(232,236,244,.58)';
      ctx.font = `400 15px ${CJK}`;
      ctx.textAlign = 'center';
      const names = ['相机', '信息', '音乐', '地图', '邮件', '设置', '日历', '天气', '时钟', '备忘录', '提醒', '股票', '钱包', '文件', '播客', '健康', '图书', '家庭', '商店', '翻译', '快捷', '提示', '计算器', '语音'];
      ctx.fillText(names[idx] || '', x + iconW / 2, y + iconW + 20);
    }
  }

  // --- 页面指示点 ---
  const dotY = CH - 116;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 0 ? 'rgba(240,244,250,.92)' : 'rgba(240,244,250,.32)';
    ctx.beginPath();
    ctx.arc(CW / 2 - 18 + i * 18, dotY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Dock（毛玻璃条）---
  const dockH = 94;
  const dockW = CW - 148;
  const dockX = 74;
  const dockY = CH - dockH - 10;

  ctx.fillStyle = 'rgba(255,255,255,.11)';
  roundRectPath(ctx, dockX, dockY, dockW, dockH, [dockH * 0.44, dockH * 0.44, dockH * 0.44, dockH * 0.44]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, dockX, dockY, dockW, dockH, [dockH * 0.44, dockH * 0.44, dockH * 0.44, dockH * 0.44]);
  ctx.stroke();

  const dockN = 4;
  const diW = 64;
  const dgap = (dockW - dockN * diW) / (dockN + 1);
  for (let i = 0; i < dockN; i++) {
    const x = dockX + dgap + i * (diW + dgap);
    const y = dockY + (dockH - diW) / 2;
    const dp = colorPairs[(i + 3) % colorPairs.length];
    const dbg = ctx.createLinearGradient(x, y, x + diW * 0.35, y + diW);
    dbg.addColorStop(0, dp[0]);
    dbg.addColorStop(1, dp[1]);
    ctx.fillStyle = dbg;
    roundRectPath(ctx, x, y, diW, diW, [diW * 0.27, diW * 0.27, diW * 0.27, diW * 0.27]);
    ctx.fill();
    const gl2 = ctx.createLinearGradient(x, y, x, y + diW);
    gl2.addColorStop(0, 'rgba(255,255,255,.32)');
    gl2.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = gl2;
    roundRectPath(ctx, x, y, diW, diW, [diW * 0.27, diW * 0.27, diW * 0.27, diW * 0.27]);
    ctx.fill();

    drawIconGlyph(ctx, DOCK_ICONS[i], x + diW / 2, y + diW / 2, diW * 0.52);
  }
}

// ---------------- 内屏绘制（高保真故障特效）----------------
let _noisePattern = null;
function noisePattern(ctx) {
  if (_noisePattern) return _noisePattern;
  const n = document.createElement('canvas');
  n.width = 128;
  n.height = 128;
  const nc = n.getContext('2d');
  const img = nc.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 26;
  }
  nc.putImageData(img, 0, 0);
  _noisePattern = ctx.createPattern(n, 'repeat');
  return _noisePattern;
}

/** 递归裂纹：带暗影边缘 + 亮线折射 + 分叉 */
function growCrack(ctx, x, y, angle, len, width, depth, rnd) {
  if (depth <= 0 || len < 3) return;
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;

  ctx.strokeStyle = 'rgba(0,0,0,.62)';
  ctx.lineWidth = width + 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(236,242,252,${0.34 + rnd() * 0.46})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const n = rnd() < 0.62 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    growCrack(ctx, x2, y2, angle + (rnd() - 0.5) * 1.25, len * (0.55 + rnd() * 0.2), width * 0.68, depth - 1, rnd);
  }
  if (rnd() < 0.3) {
    growCrack(ctx, (x + x2) / 2, (y + y2) / 2, angle + (rnd() < 0.5 ? 1 : -1) * (1.1 + rnd() * 0.5), len * 0.3, width * 0.5, depth - 1, rnd);
  }
}

export function drawScreen(ctx, st) {
  const { stage, folds, broken, matte, sand, t = 0 } = st;
  const traits = st.traits || [];
  const hasT = (id) => traits.indexOf(id) >= 0;
  const onGreen = stage >= 5 || hasT('greenline') || hasT('fullgreen');
  const onDeadpx = stage >= 8 || hasT('deadpx');
  const onFlicker = stage >= 4 || hasT('flicker');
  const onLeak = stage >= 7 || hasT('leak');
  const onTouch = stage >= 6 || hasT('touch');
  const creaseBoost = hasT('crease') ? 1.55 : 1;
  const R = 54;
  const cx = CW / 2;

  ctx.save();
  // 圆角外保持透明（由 shader discard），露出机身本体
  ctx.clearRect(0, 0, CW, CH);
  roundRectPath(ctx, 0, 0, CW, CH, [R, R, R, R]);
  ctx.clip();

  // ---- 底色（哑光/亮面两种，带中心微亮）----
  const g = ctx.createRadialGradient(cx, CH * 0.42, 60, cx, CH * 0.5, CW * 0.78);
  if (matte) {
    g.addColorStop(0, '#1b1e24');
    g.addColorStop(0.55, '#12141a');
    g.addColorStop(1, '#0a0b0f');
  } else {
    g.addColorStop(0, '#0c0e13');
    g.addColorStop(0.55, '#08090d');
    g.addColorStop(1, '#040507');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);

  // ---- iOS Home 界面 ----
  if (!broken) {
    drawHome(ctx, st);
  }

  // ---- 折痕：柔和暗谷 + 两侧微高光 ----
  if (folds > 0) {
    const d = Math.min(Math.max((folds / 45) * creaseBoost, 0.1), 1);
    const w = 16 + d * 30;
    const grd = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.42, `rgba(0,0,0,${0.16 + d * 0.34})`);
    grd.addColorStop(0.5, `rgba(0,0,0,${0.26 + d * 0.42})`);
    grd.addColorStop(0.58, `rgba(0,0,0,${0.16 + d * 0.34})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(cx - w, 0, w * 2, CH);

    // 折痕脊线高光
    ctx.strokeStyle = `rgba(190,205,235,${0.05 + d * 0.13})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.42, 0);
    ctx.lineTo(cx - w * 0.42, CH);
    ctx.moveTo(cx + w * 0.42, 0);
    ctx.lineTo(cx + w * 0.42, CH);
    ctx.stroke();
  }

  // ---- 裂纹（从折线向外递归生长）----
  if (folds >= 2) {
    let seed = 7919 + folds * 131 + stage * 17;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const roots = Math.min(3 + Math.floor(folds / 6) + stage, 22);
    for (let i = 0; i < roots; i++) {
      const y = 20 + rnd() * (CH - 40);
      const dir = rnd() < 0.5 ? 0 : Math.PI;
      const spread = Math.min(folds / 40, 0.9);
      growCrack(ctx, cx + (rnd() - 0.5) * 10, y, dir + (rnd() - 0.5) * 0.9, 26 + rnd() * 90 * (0.35 + spread), 1.1 + rnd() * 0.9, 3 + Math.floor(stage / 3), rnd);
    }
    // 边缘起裂（从屏幕边框向内）
    const edgeRoots = Math.min(stage, 8);
    for (let i = 0; i < edgeRoots; i++) {
      const side = rnd() < 0.5 ? 0 : Math.PI;
      const y = rnd() * CH;
      growCrack(ctx, side === 0 ? 6 : CW - 6, y, side === 0 ? 0.15 + (rnd() - 0.5) * 0.5 : Math.PI - 0.15 + (rnd() - 0.5) * 0.5, 40 + rnd() * 70, 1.0 + rnd() * 0.7, 3, rnd);
    }
  }

  // ---- 绿线：OLED 坏线（核心亮芯 + 光晕 + 像素颗粒）----
  if (onGreen && !broken) {
    const lines = Math.min(stage - 4, 4);
    for (let i = 0; i < lines; i++) {
      const ox = cx + i * 4 * (i % 2 === 0 ? 1 : -1);
      const flick = 0.82 + Math.sin(t * 6 + i * 1.7) * 0.18;

      ctx.shadowColor = 'rgba(0,255,136,.95)';
      ctx.shadowBlur = 30 * flick;
      ctx.strokeStyle = `rgba(0,255,136,${0.3 * flick})`;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, CH);
      ctx.stroke();

      ctx.shadowBlur = 10 * flick;
      ctx.strokeStyle = `rgba(120,255,190,${0.8 * flick})`;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, CH);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(235,255,245,${0.9 * flick})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, CH);
      ctx.stroke();

      // 像素颗粒断续
      let s2 = 1234 + i * 97;
      const rnd2 = () => { s2 = (s2 * 16807) % 2147483647; return (s2 - 1) / 2147483646; };
      for (let k = 0; k < 26; k++) {
        const py = rnd2() * CH;
        ctx.fillStyle = `rgba(0,255,136,${0.25 + rnd2() * 0.5})`;
        ctx.fillRect(ox - 2 + rnd2() * 4, py, 2.5, 2 + rnd2() * 5);
      }
    }
  }

  // ---- 坏点 / 亮点团 ----
  if (onDeadpx && !broken) {
    let s3 = 4242 + stage * 37;
    const rnd3 = () => { s3 = (s3 * 16807) % 2147483647; return (s3 - 1) / 2147483646; };
    for (let i = 0; i < (stage - 7) * 45; i++) {
      const px = 8 + rnd3() * (CW - 16);
      const py = 8 + rnd3() * (CH - 16);
      const sz = 2 + rnd3() * 3.5;
      ctx.fillStyle = rnd3() < 0.82
        ? `rgba(0,255,136,${0.3 + rnd3() * 0.55})`
        : `rgba(255,90,120,${0.3 + rnd3() * 0.5})`;
      ctx.fillRect(px, py, sz, sz);
    }
  }

  // ---- 触控失灵：漂移的触点光斑 ----
  if (onTouch && !broken) {
    const n = Math.min(stage - 5, 4);
    for (let i = 0; i < n; i++) {
      const px = cx + Math.sin(t * 1.7 + i * 2.1) * (CW * 0.36);
      const py = CH / 2 + Math.cos(t * 2.3 + i * 1.4) * (CH * 0.33);
      const gr = ctx.createRadialGradient(px, py, 0, px, py, 52);
      gr.addColorStop(0, 'rgba(255,255,255,.5)');
      gr.addColorStop(0.35, 'rgba(255,255,255,.12)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(px, py, 52, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 闪屏：随机噪带 + 亮度跳变 ----
  if (onFlicker && !broken) {
    const f = (Math.sin(t * 23.1) + Math.sin(t * 41.7) + Math.sin(t * 7.3)) / 3;
    if (f > 0.35) {
      ctx.fillStyle = `rgba(0,255,136,${0.03 + (f - 0.35) * 0.16})`;
      ctx.fillRect(0, 0, CW, CH);

      let s4 = Math.floor(t * 60) * 7919;
      const rnd4 = () => { s4 = (s4 * 16807) % 2147483647; return (s4 - 1) / 2147483646; };
      for (let i = 0; i < 7; i++) {
        const y = rnd4() * CH;
        ctx.fillStyle = `rgba(${180 + rnd4() * 75},255,${200 + rnd4() * 55},${0.04 + rnd4() * 0.09})`;
        ctx.fillRect(0, y, CW, 3 + rnd4() * 34);
      }
    }
  }

  // ---- 漏液黑斑（不规则扩散）----
  if (onLeak && !broken) {
    let s5 = 8888 + stage * 13;
    const rnd5 = () => { s5 = (s5 * 16807) % 2147483647; return (s5 - 1) / 2147483646; };
    for (let i = 0; i < (stage - 6) * 4; i++) {
      const bx = rnd5() * CW;
      const by = rnd5() * CH;
      const br = 16 + rnd5() * 55;
      for (let k = 0; k < 3; k++) {
        const gr2 = ctx.createRadialGradient(
          bx + (rnd5() - 0.5) * br * 0.7,
          by + (rnd5() - 0.5) * br * 0.7,
          0, bx, by, br * (0.6 + k * 0.25)
        );
        gr2.addColorStop(0, 'rgba(0,0,0,.9)');
        gr2.addColorStop(0.65, 'rgba(2,4,8,.55)');
        gr2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr2;
        ctx.beginPath();
        ctx.arc(bx, by, br * (0.6 + k * 0.25), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- 屏幕起泡（膜下鼓包）----
  if (hasT('bubble') && !broken) {
    let sb = 20261;
    const rb = () => { sb = (sb * 16807) % 2147483647; return (sb - 1) / 2147483646; };
    for (let i = 0; i < 7; i++) {
      const bx = rb() * CW;
      const by = rb() * CH;
      const br = 20 + rb() * 46;
      const gr = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.1, bx, by, br);
      gr.addColorStop(0, 'rgba(210,225,255,.16)');
      gr.addColorStop(0.55, 'rgba(150,170,210,.07)');
      gr.addColorStop(1, 'rgba(0,0,0,.22)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,240,255,.13)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  // ---- 半屏失效（右侧压暗/失效）----
  if (hasT('halfdead') && !broken) {
    const hg = ctx.createLinearGradient(cx, 0, CW, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.35, 'rgba(0,0,0,.55)');
    hg.addColorStop(1, 'rgba(0,0,0,.88)');
    ctx.fillStyle = hg;
    ctx.fillRect(cx, 0, CW - cx, CH);

    let sd = 7771;
    const rd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(0,255,136,${0.1 + rd() * 0.4})`;
      ctx.fillRect(cx + rd() * (CW - cx), rd() * CH, 2.5, 2.5);
    }
  }

  // ---- 铰链进沙 ----
  if (sand) {
    let s6 = 31337;
    const rnd6 = () => { s6 = (s6 * 16807) % 2147483647; return (s6 - 1) / 2147483646; };
    for (let i = 0; i < 90; i++) {
      const px = cx + (rnd6() - 0.5) * 52;
      const py = rnd6() * CH;
      ctx.fillStyle = `rgba(208,180,118,${0.4 + rnd6() * 0.45})`;
      ctx.beginPath();
      ctx.arc(px, py, 0.8 + rnd6() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 报废：黑屏 + 放射状碎裂 + 折线爆闪 ----
  if (broken) {
    ctx.fillStyle = 'rgba(2,3,4,.93)';
    ctx.fillRect(0, 0, CW, CH);

    let s7 = 99991;
    const rnd7 = () => { s7 = (s7 * 16807) % 2147483647; return (s7 - 1) / 2147483646; };
    // 放射状主裂纹
    for (let i = 0; i < 26; i++) {
      const a = rnd7() * Math.PI * 2;
      growCrack(ctx, cx + (rnd7() - 0.5) * 20, CH / 2 + (rnd7() - 0.5) * 20, a, 90 + rnd7() * 260, 1.6 + rnd7() * 1.2, 4, rnd7);
    }
    // 玻璃碎屑高光
    for (let i = 0; i < 70; i++) {
      const px = rnd7() * CW;
      const py = rnd7() * CH;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + rnd7() * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + rnd7() * 26 - 13, py + rnd7() * 26 - 13);
      ctx.lineTo(px + rnd7() * 26 - 13, py + rnd7() * 26 - 13);
      ctx.closePath();
      ctx.fill();
    }
    // 折线爆闪
    ctx.strokeStyle = 'rgba(0,255,136,.95)';
    ctx.lineWidth = 8;
    ctx.shadowColor = 'rgba(0,255,136,1)';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(cx, CH - 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ---- 玻璃质感：反光带 + 噪点 + 暗角 ----
  const gloss = ctx.createLinearGradient(0, 0, CW * 0.85, CH);
  gloss.addColorStop(0, 'rgba(255,255,255,.055)');
  gloss.addColorStop(0.28, 'rgba(255,255,255,.012)');
  gloss.addColorStop(0.46, 'rgba(255,255,255,.04)');
  gloss.addColorStop(0.62, 'rgba(255,255,255,0)');
  gloss.addColorStop(1, 'rgba(255,255,255,.018)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, CW, CH);

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = noisePattern(ctx);
  ctx.fillRect(0, 0, CW, CH);
  ctx.globalAlpha = 1;

  const vig = ctx.createRadialGradient(cx, CH / 2, CH * 0.3, cx, CH / 2, CW * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, CW, CH);

  ctx.restore();
}

// ---------------- 外屏绘制（折叠时朝外那面）----------------
export function drawCover(ctx, st) {
  const { stage, broken, t = 0 } = st;
  const ct = st.traits || [];
  const onGreen = stage >= 5 || ct.indexOf('greenline') >= 0 || ct.indexOf('fullgreen') >= 0;
  ctx.save();
  ctx.clearRect(0, 0, SW, SH);
  roundRectPath(ctx, 0, 0, SW, SH, [56, 56, 56, 56]);
  ctx.clip();

  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, '#111317');
  g.addColorStop(1, '#08090c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);

  ctx.textAlign = 'center';
  if (!broken) {
    ctx.fillStyle = 'rgba(238,241,246,.92)';
    ctx.font = `600 96px ${CJK}`;
    ctx.fillText('9:41', SW / 2, SH * 0.20);

    ctx.fillStyle = 'rgba(186,192,202,.6)';
    ctx.font = `400 26px ${CJK}`;
    ctx.fillText('10月23日 星期五', SW / 2, SH * 0.255);

    // 小组件方块
    for (let i = 0; i < 2; i++) {
      const bx = 40 + i * (SW - 80) / 2 + 8;
      const bw = (SW - 80) / 2 - 16;
      ctx.fillStyle = 'rgba(28,32,38,.95)';
      roundRectPath(ctx, bx, SH * 0.33, bw, SH * 0.16, [22, 22, 22, 22]);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,128,140,.65)';
      ctx.font = `400 20px ${CJK}`;
      ctx.fillText(i === 0 ? '日历' : '天气', bx + bw / 2, SH * 0.40);
    }
  }

  if (onGreen && !broken) {
    ctx.strokeStyle = 'rgba(0,255,136,.85)';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(0,255,136,.9)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(SW / 2, 4);
    ctx.lineTo(SW / 2, SH - 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (broken) {
    ctx.fillStyle = 'rgba(3,3,5,.92)';
    ctx.fillRect(0, 0, SW, SH);
    let s = 555;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < 80; i++) {
      const x0 = rnd() * SW;
      const y0 = rnd() * SH;
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
      ctx.lineWidth = 0.8 + rnd() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (rnd() - 0.5) * SW, y0 + (rnd() - 0.5) * SH * 0.5);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------------- 组装 3D 手机 ----------------
export function createPhone() {
  const group = new THREE.Group();
  const leftPivot = new THREE.Group();
  const rightPivot = new THREE.Group();
  group.add(leftPivot, rightPivot);

  // 侧边钛金属
  const titanium = new THREE.MeshStandardMaterial({
    color: 0xc4c9d1, metalness: 0.96, roughness: 0.22, envMapIntensity: 1.25,
  });
  // 前后盖：磨砂玻璃（低金属度、高粗糙度，避免被环境反射染成蓝色）
  const glassBack = new THREE.MeshStandardMaterial({
    color: 0x2a2c31, metalness: 0.08, roughness: 0.86, envMapIntensity: 0.35,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x14171b, metalness: 0.7, roughness: 0.4,
  });

  const extrudeOpt = {
    depth: THICK, bevelEnabled: true, bevelThickness: BEVEL,
    bevelSize: BEVEL, bevelSegments: 2, curveSegments: 16,
  };

  // --- 机身两半 ---
  const lGeo = new THREE.ExtrudeGeometry(halfShell(HALF_W, HEIGHT, CORNER, true), extrudeOpt);
  lGeo.translate(0, 0, -THICK / 2);
  const lMesh = new THREE.Mesh(lGeo, [glassBack, titanium]);
  leftPivot.add(lMesh);

  const rGeo = new THREE.ExtrudeGeometry(halfShell(HALF_W, HEIGHT, CORNER, false), extrudeOpt);
  rGeo.translate(0, 0, -THICK / 2);
  const rMesh = new THREE.Mesh(rGeo, [glassBack, titanium]);
  rightPivot.add(rMesh);

  // --- 内屏：一整块连续柔性曲面（不跟随两半刚性旋转，自己做弯曲）---
  const inset = 0.030;
  const scrW = (HALF_W - inset) * 2 - 0.010;
  const scrH = HEIGHT - inset * 2;

  const SEG = 120;
  const scrGeo = new THREE.PlaneGeometry(scrW, scrH, SEG, 1);
  const posAttr = scrGeo.attributes.position;
  const baseX = new Float32Array(posAttr.count);
  for (let i = 0; i < posAttr.count; i++) baseX[i] = posAttr.getX(i);

  const canvasInner = makeCanvas(CW, CH);
  const texInner = new THREE.CanvasTexture(canvasInner);
  texInner.colorSpace = THREE.SRGBColorSpace;
  texInner.anisotropy = 8;

  const Z_SCREEN = THICK / 2 + 0.008;
  // 弯曲半径由机身厚度几何决定：弦长 THICK·sin(b) ↔ 圆心角 2b ⇒ R = THICK/2
  const BEND_R = THICK / 2 + 0.004;

  // 折叠时的「透视压缩 + 光学深度模糊 + 折线暗化」shader
  const screenMat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texInner },
      uFold: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uFold;
      varying vec2 vUv;

      void main() {
        float d = abs(vUv.x - 0.5);

        // 折线附近：内容被压缩（透视感）
        float squeeze = uFold * 0.16 * exp(-d * 7.0);
        vec2 uv = vec2(0.5 + (vUv.x - 0.5) * (1.0 - squeeze), vUv.y);

        // 渐变模糊：越靠近折线越糊
        float blur = uFold * (0.0016 + 0.011 * exp(-d * 8.0));
        vec4 col = vec4(0.0);
        float tot = 0.0;
        for (int i = -2; i <= 2; i++) {
          for (int j = -2; j <= 2; j++) {
            float w = 1.0 / (1.0 + abs(float(i)) + abs(float(j)));
            col += texture2D(uMap, uv + vec2(float(i), float(j)) * blur) * w;
            tot += w;
          }
        }
        col /= tot;

        // 折线暗化
        col.rgb *= (1.0 - uFold * 0.42 * exp(-d * 10.0));
        // 折线处的冷色光学偏移
        col.rgb += vec3(0.005, 0.016, 0.045) * uFold * exp(-d * 5.0);

        // 圆角裁切：透明区域直接丢弃，露出机身
        if (col.a < 0.5) discard;

        gl_FragColor = col;
      }
    `,
    side: THREE.DoubleSide,
    toneMapped: false,
    // 屏幕与机身表面只差几毫米，深度精度不足会被吃掉 → 直接不参与深度测试
    depthTest: false,
    depthWrite: false,
  });

  const screenMesh = new THREE.Mesh(scrGeo, screenMat);
  screenMesh.renderOrder = 10;
  group.add(screenMesh);

  const Z0 = THICK / 2 + 0.026;   // 屏幕基准面（高于机身正面，避免深度打架）
  const SCREEN_LIFT = 0.026;

  /**
   * 对称折叠。屏幕绕过铰链时形成「凸面」：铰链处略高于机身正面，
   * 两端平板段贴合机身正面（弧长不足的部分由屏幕边框吸收）。
   */
  function deformScreen(b) {
    const arr = posAttr.array;
    const ab = Math.abs(b);

    if (ab < 1e-4) {
      for (let i = 0; i < posAttr.count; i++) {
        arr[i * 3] = baseX[i];
        arr[i * 3 + 2] = Z0;
      }
    } else {
      const R = THICK / 2;              // 弯曲半径 = 机身半厚
      const rb = R * ab;
      const sinB = Math.sin(ab);
      const cosB = Math.cos(ab);
      const sgn = Math.sign(b);

      for (let i = 0; i < posAttr.count; i++) {
        const s = baseX[i];
        const a = Math.abs(s);
        let x, z;
        if (a <= rb) {
          const th = s / R;
          x = R * Math.sin(th);
          z = R * Math.cos(th) + SCREEN_LIFT;      // 凸面：铰链处最高
        } else {
          const sg = Math.sign(s);
          const u = a - rb;
          x = sg * (R * sinB + u * cosB);
          z = R * cosB + u * sinB + SCREEN_LIFT;   // 平板段贴合机身正面
        }
        arr[i * 3] = x;
        arr[i * 3 + 2] = sgn === 1 ? z : (2 * Z0 - z);
      }
    }
    posAttr.needsUpdate = true;
    scrGeo.computeVertexNormals();
  }
  deformScreen(0);

  // --- 背面由机身本体承担（磨砂玻璃），不再贴独立平面 ---

  // 左半背面：榴莲 logo
  const logoPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.44),
    new THREE.MeshBasicMaterial({ map: durianTexture(), transparent: true, toneMapped: false })
  );
  logoPlane.position.set(HALF_W / 2 + 0.005, -0.10, -THICK / 2 - 0.004);
  logoPlane.rotation.y = Math.PI;
  rightPivot.add(logoPlane);

  // 右半背面：外屏
  const coverCanvas = makeCanvas(SW, SH);
  const coverTex = new THREE.CanvasTexture(coverCanvas);
  coverTex.colorSpace = THREE.SRGBColorSpace;
  coverTex.anisotropy = 8;
  // 外屏必须按「单侧机身」尺寸算，否则会超出背板
  const coverW = HALF_W * 0.90;
  const coverH = Math.min(coverW * (SH / SW), HEIGHT * 0.94);
  const coverScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(coverW, coverH),
    new THREE.MeshBasicMaterial({
      map: coverTex, toneMapped: false, transparent: true, alphaTest: 0.5,
    })
  );
  // 外屏独占折叠后朝外的那一面（左半背面）
  coverScreen.position.set(-HALF_W / 2, 0, -THICK / 2 - 0.016);
  coverScreen.rotation.y = Math.PI;
  leftPivot.add(coverScreen);

  // 左半背面：立体摄像头模组（双摄 + 闪光灯）
  const camCX = HALF_W - 0.19;
  const camCY = HEIGHT / 2 - 0.20;
  const camZ = -THICK / 2;

  const camBaseMat = new THREE.MeshStandardMaterial({
    color: 0x212429, metalness: 0.25, roughness: 0.62, envMapIntensity: 0.5,
  });
  const camBase = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.29, 0.026), camBaseMat);
  camBase.position.set(camCX, camCY, camZ - 0.013);
  rightPivot.add(camBase);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x9299a2, metalness: 0.96, roughness: 0.22,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x04060a, metalness: 0.6, roughness: 0.06, envMapIntensity: 1.6,
    clearcoat: 1, clearcoatRoughness: 0.05,
  });

  for (let i = 0; i < 2; i++) {
    const ly = camCY + (i === 0 ? 0.062 : -0.062);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.018, 28), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(camCX, ly, camZ - 0.033);
    rightPivot.add(ring);

    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.020, 28), glassMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(camCX, ly, camZ - 0.037);
    rightPivot.add(lens);
  }

  // 闪光灯
  const flash = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16),
    new THREE.MeshStandardMaterial({ color: 0xf2e6c8, emissive: 0x3a3320, roughness: 0.4 })
  );
  flash.rotation.x = Math.PI / 2;
  flash.position.set(camCX - 0.072, camCY - 0.062, camZ - 0.030);
  rightPivot.add(flash);

  // --- 铰链 ---
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.020, HEIGHT * 0.98, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x6a7079, metalness: 0.98, roughness: 0.34 })
  );
  group.add(hinge);

  let curBend = 0;

  function setBend(angle) {
    curBend = angle;
    // 对称折叠：两块同时向中间收拢
    leftPivot.rotation.y = angle;
    rightPivot.rotation.y = -angle;
    deformScreen(angle);
    screenMat.uniforms.uFold.value = Math.min(Math.abs(angle) / (Math.PI / 2), 1.0);
  }

  function updateScreen(state) {
    const ci = canvasInner.getContext('2d');
    ci.clearRect(0, 0, CW, CH);
    drawScreen(ci, state);
    texInner.needsUpdate = true;

    const cc = coverCanvas.getContext('2d');
    cc.clearRect(0, 0, SW, SH);
    drawCover(cc, state);
    coverTex.needsUpdate = true;
  }

  return { group, setBend, updateScreen, getBend: () => curBend, leftPivot, rightPivot, coverCanvas, canvasInner, screenMesh };
}

/** 渐变环境贴图，让钛金属有反射 */
export function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(
    new THREE.BoxGeometry(16, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x12151b, side: THREE.BackSide })
  ));
  const mk = (w, h, color, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    scene.add(m);
  };
  mk(11, 11, 0xffffff, [0, 7.8, 0], [Math.PI / 2, 0, 0]);
  mk(8, 8, 0xa8bcff, [-7.7, 2, 2], [0, Math.PI / 2, 0]);
  mk(8, 8, 0xffd6ae, [7.7, 1, -2], [0, -Math.PI / 2, 0]);
  mk(13, 7, 0x1d2430, [0, -7.8, 0], [-Math.PI / 2, 0, 0]);
  const env = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  return env;
}
