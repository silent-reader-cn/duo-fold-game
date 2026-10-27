import { drawScreen } from './phone.js';
import { RARITY } from './logic.js';
import { t, getLang } from './i18n.js';

const SC = '"PingFang SC","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif';
const LATIN = '"Helvetica Neue",Helvetica,"Segoe UI",Arial,system-ui,sans-serif';
// 英文版别硬套中文字体栈：拉丁字形在 PingFang 里虽然能出，但字重和字距都不对
const CJK = getLang() === 'en' ? LATIN : SC;
const MONO = '"SF Mono","Consolas","Roboto Mono",monospace';

/** 正多角星（几何花）：外径 / 内径交替连点 */
function starPoly(ctx, cx, cy, rOut, rIn, points, stroke, lw, fill) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 ? rIn : rOut;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/** 菱形（古典花带上最基础的那个形） */
function diamond(ctx, cx, cy, r, stroke, lw, fill) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/** 横向花带：双细线 + 中间菱形串，两端可加八角星徽（传说的分隔线用它替代一根直线） */
function flourishBand(ctx, x0, y, w, skin, withMedallion) {
  ctx.save();
  ctx.strokeStyle = rgba(skin.fill, 0.38);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 30, y - 3); ctx.lineTo(x0 + w - 30, y - 3);
  ctx.moveTo(x0 + 30, y + 3); ctx.lineTo(x0 + w - 30, y + 3);
  ctx.stroke();
  for (let x = x0 + 46; x <= x0 + w - 46; x += 30) diamond(ctx, x, y, 5.5, null, 0, rgba(skin.fill, 0.55));
  if (withMedallion) {
    starPoly(ctx, x0, y, 14, 6.5, 8, skin.ink, 1.5, rgba(skin.fill, 0.16));
    starPoly(ctx, x0 + w, y, 14, 6.5, 8, skin.ink, 1.5, rgba(skin.fill, 0.16));
  }
  ctx.restore();
}

/** 纵向边带：和横向花带同一族语言——双细线 + 连珠菱形，古典且小尺寸下也看得懂 */
function marginPattern(ctx, x, y0, y1, skin, kind) {
  ctx.save();
  const classic = kind === 'classic';
  const step = 62;
  // 双细线（传说）/ 单细线（史诗）
  ctx.strokeStyle = rgba(skin.fill, classic ? 0.28 : 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 7, y0); ctx.lineTo(x - 7, y1);
  ctx.moveTo(x + 7, y0); ctx.lineTo(x + 7, y1);
  if (!classic) ctx.moveTo(x + 7, y0), ctx.lineTo(x - 7, y0), ctx.lineTo(x - 7, y1), ctx.lineTo(x + 7, y1);
  ctx.stroke();

  let alt = 0;
  for (let y = y0 + step / 2; y < y1; y += step, alt++) {
    if (classic) {
      // 菱形与八角星交替成珠链
      if (alt % 2 === 0) {
        diamond(ctx, x, y, 7.5, null, 0, rgba(skin.fill, 0.45));
        diamond(ctx, x, y, 12, rgba(skin.fill, 0.26), 1, null);
      } else {
        starPoly(ctx, x, y, 7, 3, 8, rgba(skin.fill, 0.34), 1, null);
      }
    } else {
      diamond(ctx, x, y, 5, rgba(skin.fill, 0.3), 1.1, null);
    }
  }
  ctx.restore();
}

/** 满版底纹：传说八芒星格，史诗菱格网，都用极低透明度，只做质感不抢字 */
function patternField(ctx, W, H, skin, kind) {
  ctx.save();
  if (kind === 'classic') {
    const step = 116;
    for (let gy = step / 2, row = 0; gy < H; gy += step, row++) {
      for (let gx = (row % 2 ? step : step / 2); gx < W; gx += step) {
        starPoly(ctx, gx, gy, 17, 7, 8, rgba(skin.fill, 0.075), 1, null);
        diamond(ctx, gx, gy, 3.5, null, 0, rgba(skin.fill, 0.07));
      }
    }
  } else if (kind === 'geo') {
    const step = 88;
    ctx.strokeStyle = rgba(skin.fill, 0.085);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -H; i < W + H; i += step) {
      ctx.moveTo(i, 0); ctx.lineTo(i + H, H);
      ctx.moveTo(i, 0); ctx.lineTo(i - H, H);
    }
    ctx.stroke();
    for (let gy = step; gy < H; gy += step) {
      for (let gx = step; gx < W; gx += step) diamond(ctx, gx, gy, 4.5, null, 0, rgba(skin.fill, 0.09));
    }
  }
  ctx.restore();
}

/** 底部徽记：正中的八角花，替代空着的那块黑 */
function medallion(ctx, cx, cy, skin, r) {
  starPoly(ctx, cx, cy, r, r * 0.45, 8, skin.ink, 1.6, rgba(skin.fill, 0.10));
  starPoly(ctx, cx, cy, r * 0.46, r * 0.22, 4, rgba(skin.fill, 0.85), 1.3, null);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = skin.ink; ctx.fill();
}

/** 先按原字号排，超宽就缩字号，缩到下限还超就按词/字折行（英文长句原本会直接溢出画布） */
function fitBlock(ctx, text, maxW, fontFn, start, min, maxLines) {
  for (let s = start; s >= min; s--) {
    ctx.font = fontFn(s);
    if (ctx.measureText(text).width <= maxW) return { size: s, lines: [text] };
  }
  ctx.font = fontFn(min);
  const tokens = /\s/.test(text) ? text.split(/(\s+)/).filter(Boolean) : [...text];
  const lines = [];
  let cur = '';
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const next = cur + tk;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur.trim());
      if (lines.length === maxLines - 1) { cur = tokens.slice(i).join('').trim(); break; }
      cur = tk.trim();
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur.trim());
  return { size: min, lines: lines.slice(0, maxLines) };
}

/** 词条前的标记也用形状分档：普通圆点 / 稀有带环圆点 / 史诗菱形 / 传说带芯八角星 */
function rarMark(ctx, cx, cy, rarity, skin) {
  if (rarity === 'legendary') {
    starPoly(ctx, cx, cy, 8, 3.4, 8, skin.ink, 1.2, rgba(skin.fill, 0.35));
  } else if (rarity === 'epic') {
    diamond(ctx, cx, cy, 6.4, skin.ink, 1.4, rgba(skin.fill, 0.3));
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, rarity === 'rare' ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = skin.ink; ctx.fill();
    if (rarity === 'rare') {
      ctx.beginPath(); ctx.arc(cx, cy, 7.6, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(skin.fill, 0.6); ctx.lineWidth = 1; ctx.stroke();
    }
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 稀有度皮肤：canvas 读不到 CSS 变量，这里的颜色与 style.css 的 .book-trait.r-* 一一对应
// ink=文字/圆点主色（提亮版） l1..l2=描边渐变 fill=底色+辉光 lw=描边粗细 glow=辉光半径
// 渐变端点都收在同一个色相里（不跑青、不跑洋红），贴着 RARITY[].color 这个「代表色」
const RSKIN = {
  common:    { ink: '#cbd2dc', l1: '#b9c2d0', l2: '#7d8595', fill: [154, 160, 168], lw: 1.6, glow: 0,
               bg1: [23, 27, 33], mid: [13, 16, 20], bg2: [7, 9, 12] },
  rare:      { ink: '#7cc8ff', l1: '#9ad8ff', l2: '#2f7ff0', fill: [74, 163, 255], lw: 2.0, glow: 15,
               bg1: [24, 38, 56], mid: [12, 18, 28], bg2: [6, 9, 15] },
  epic:      { ink: '#cf9bff', l1: '#d9a6ff', l2: '#7f3fd8', fill: [183, 107, 255], lw: 2.4, glow: 24,
               bg1: [33, 25, 46], mid: [16, 12, 25], bg2: [7, 6, 12] },
  legendary: { ink: '#ffd15c', l1: '#ffe08a', l2: '#e08a15', fill: [255, 176, 32], lw: 3.0, glow: 34,
               bg1: [39, 32, 18], mid: [18, 14, 9], bg2: [8, 7, 4] },
};
// 碎裂 / 无词条时也得有自己的一套，别让外框和整卡底色掉成灰白
const BROKEN_SKIN = { ink: '#ff9aa4', l1: '#ffc2c8', l2: '#d0323f', fill: [255, 77, 94], lw: 2.4, glow: 22,
                      bg1: [38, 20, 24], mid: [19, 11, 13], bg2: [8, 5, 6] };
const CLEAN_SKIN  = { ink: '#7dffbd', l1: '#a6ffd4', l2: '#00b862', fill: [0, 255, 136], lw: 2.0, glow: 16,
                      bg1: [19, 33, 27], mid: [10, 18, 15], bg2: [5, 9, 8] };
const RAR_DESC = { legendary: 0, epic: 1, rare: 2, common: 3 };
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
const rgbStr = ([r, g, b]) => `rgb(${r},${g},${b})`;

/** 综合评级：品阶 + 折叠数 + 稀有词条权重 */
function grade(st) {
  const cnt = (r) => (st.traits || []).filter((t) => t.rarity === r).length;
  const score =
    st.stage * 9 +
    Math.min(st.folds, 120) * 0.34 +
    cnt('legendary') * 16 +
    cnt('epic') * 6 +
    cnt('rare') * 2;
  if (score >= 132) return { g: 'S', color: '#ffb020' };
  if (score >= 108) return { g: 'A', color: '#b76bff' };
  if (score >= 82) return { g: 'B', color: '#4aa3ff' };
  if (score >= 52) return { g: 'C', color: '#00ff88' };
  return { g: 'D', color: '#8d939e' };
}

/**
 * 生成成就卡片 —— 版式做成「设备检测报告」
 * st: { stage, stageName, stageMax, folds, fan, sand, ac, broken, quote, serial, traits }
 */
export function makeCard(st) {
  const W = 1080;
  const H = 2020;   // 表格行与词条胶囊都加高了一档，纵向再放 60
  const SS = 2;
  const c = document.createElement('canvas');
  c.width = W * SS;
  c.height = H * SS;
  const ctx = c.getContext('2d');
  ctx.scale(SS, SS);

  const traits = st.traits || [];
  const order = { common: 0, rare: 1, epic: 2, legendary: 3 };
  let topRarity = null;
  for (const t of traits) {
    if (!topRarity || order[t.rarity] > order[topRarity]) topRarity = t.rarity;
  }
  // 代表色：外框、刻度、页眉、整卡底色全部由它派生，四档不再是同一张蓝黑底
  const accent = st.broken ? '#ff4d5e' : topRarity ? RARITY[topRarity].color : '#00ff88';
  const skinMain = st.broken ? BROKEN_SKIN : topRarity ? RSKIN[topRarity] : CLEAN_SKIN;
  const gr = grade(st);

  // ================= 底色（整卡染色）=================
  const bg = ctx.createLinearGradient(0, 0, W * 0.35, H);
  bg.addColorStop(0, rgbStr(skinMain.bg1));
  bg.addColorStop(0.5, rgbStr(skinMain.mid));
  bg.addColorStop(1, rgbStr(skinMain.bg2));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 技术网格底纹
  ctx.strokeStyle = 'rgba(255,255,255,.022)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 54) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 54) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 主色光晕
  const halo = ctx.createRadialGradient(W / 2, 620, 40, W / 2, 660, 660);
  halo.addColorStop(0, rgba(skinMain.fill, 0.30));
  halo.addColorStop(0.45, rgba(skinMain.fill, 0.11));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // 噪点
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.3, 1.3);
  }
  ctx.restore();

  const m = 68;

  // 外框（双线）：描边走「最高稀有度」的渐变，越稀有越粗越亮，还带一圈外发光
  const frameSkin = skinMain;
  // 花纹分档：传说=古典（回纹/花带/徽记），史诗=几何菱格，稀有=双线，普通=素面
  const orn = topRarity ? { legendary: 'classic', epic: 'geo', rare: 'line', common: 'none' }[topRarity] : 'none';

  if (orn === 'classic' || orn === 'geo') patternField(ctx, W, H, frameSkin, orn);
  const fg = ctx.createLinearGradient(24, 24, W - 24, H - 24);
  fg.addColorStop(0, frameSkin.l1);
  fg.addColorStop(0.34, 'rgba(255,255,255,.30)');
  fg.addColorStop(0.64, frameSkin.l2);
  fg.addColorStop(1, frameSkin.l1);
  ctx.save();
  if (frameSkin.glow) {
    ctx.shadowColor = rgba(frameSkin.fill, 0.9);
    ctx.shadowBlur = frameSkin.glow;
  }
  ctx.strokeStyle = fg;
  ctx.lineWidth = frameSkin.lw + 0.6;
  rr(ctx, 24, 24, W - 48, H - 48, 26);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = rgba(frameSkin.fill, 0.20);
  ctx.lineWidth = 1;
  rr(ctx, 32, 32, W - 64, H - 64, 22);
  ctx.stroke();
  // 高稀有度再加一道内双线 + 两侧边带，古典器物那种「复框」味道
  if (orn === 'classic' || orn === 'geo') {
    ctx.strokeStyle = rgba(frameSkin.fill, 0.13);
    ctx.lineWidth = 1;
    rr(ctx, 44, 44, W - 88, H - 88, 18);
    ctx.stroke();
  }
  if (orn !== 'none') {
    marginPattern(ctx, 50, 250, H - 250, frameSkin, orn === 'classic' ? 'classic' : 'geo');
    marginPattern(ctx, W - 50, 250, H - 250, frameSkin, orn === 'classic' ? 'classic' : 'geo');
  }

  // ================= 报告页眉 =================
  ctx.textAlign = 'left';
  ctx.fillStyle = skinMain.ink;
  ctx.font = `700 26px ${CJK}`;
  ctx.fillText('DEVICE INSPECTION REPORT', m, 106);

  ctx.fillStyle = 'rgba(150,158,172,.85)';
  ctx.font = `400 22px ${MONO}`;
  ctx.fillText(t('card.reportSub'), m, 142);

  // 编号 + 日期（右）
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(120,128,142,.8)';
  ctx.font = `400 20px ${MONO}`;
  ctx.fillText(st.serial, W - m, 106);
  const d = new Date();
  ctx.fillStyle = 'rgba(120,128,142,.55)';
  ctx.font = `400 18px ${MONO}`;
  ctx.fillText(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    W - m, 138
  );

  // 分隔线：传说/史诗换成花带，稀有双线，普通单线
  if (orn === 'classic') flourishBand(ctx, m, 171, W - m * 2, frameSkin, true);
  else if (orn === 'geo') flourishBand(ctx, m, 171, W - m * 2, frameSkin, false);
  else if (orn === 'line') {
    ctx.fillStyle = accent + '55';
    ctx.fillRect(m, 168, W - m * 2, 1.2);
    ctx.fillRect(m, 173, W - m * 2, 0.8);
  } else {
    ctx.fillStyle = accent + '66';
    ctx.fillRect(m, 170, W - m * 2, 1.5);
  }

  // ================= 评级徽章 =================
  const badgeX = W - m - 92;
  const badgeY = 196;
  ctx.save();
  ctx.shadowColor = gr.color;
  ctx.shadowBlur = 46;
  rr(ctx, badgeX, badgeY, 92, 92, 20);
  const bgr = ctx.createLinearGradient(badgeX, badgeY, badgeX + 92, badgeY + 92);
  bgr.addColorStop(0, gr.color + '3a');
  bgr.addColorStop(1, 'rgba(8,10,14,.9)');
  ctx.fillStyle = bgr;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = gr.color;
  ctx.lineWidth = 2;
  rr(ctx, badgeX, badgeY, 92, 92, 20);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = gr.color;
  ctx.font = `800 54px ${CJK}`;
  ctx.fillText(gr.g, badgeX + 46, badgeY + 66);
  ctx.font = `400 12px ${MONO}`;
  ctx.fillStyle = gr.color + 'cc';
  ctx.fillText('GRADE', badgeX + 46, badgeY + 84);

  // 评级说明（徽章左侧）
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(140,148,162,.75)';
  ctx.font = `400 19px ${CJK}`;
  ctx.fillText(t('card.gradeLabel'), m, badgeY + 32);
  // 品阶名跟卡面代表色一致；评级色只留在右边的 GRADE 徽章里，两个色轴不打架
  ctx.fillStyle = skinMain.ink;
  ctx.font = `700 30px ${CJK}`;
  ctx.fillText(st.stageName, m, badgeY + 74);

  // ================= 设备照（取证角标）=================
  const pw = 700;
  const ph = Math.round(pw / 1.4);
  const px = (W - pw) / 2;
  const py = 336;

  // 机身
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.85)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 16;
  rr(ctx, px - 11, py - 11, pw + 22, ph + 22, 30);
  const frame = ctx.createLinearGradient(px, py, px + pw, py + ph);
  frame.addColorStop(0, '#e9edf3');
  frame.addColorStop(0.42, '#979eaa');
  frame.addColorStop(0.68, '#ccd2dc');
  frame.addColorStop(1, '#767d88');
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.restore();

  // 屏幕
  const sc = document.createElement('canvas');
  sc.width = 1024 * 2;
  sc.height = 731 * 2;
  const sctx = sc.getContext('2d');
  sctx.scale(2, 2);
  drawScreen(sctx, {
    stage: st.stage,
    folds: st.folds,
    // 展示「碎裂前最后一次折叠」：屏还亮着、满身伤痕
    broken: false,
    matte: st.fan === 0,
    sand: st.sand > 0,
    traits: traits.map((t) => t.id),
  });

  ctx.save();
  rr(ctx, px, py, pw, ph, 24);
  ctx.clip();
  ctx.drawImage(sc, px, py, pw, ph);
  const gl = ctx.createLinearGradient(px, py, px + pw * 0.55, py + ph);
  gl.addColorStop(0, 'rgba(170,205,255,.10)');
  gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  gl.addColorStop(1, 'rgba(0,0,0,.20)');
  ctx.fillStyle = gl;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  // 取证角标（四角 L 形）
  ctx.strokeStyle = accent + 'bb';
  ctx.lineWidth = 3;
  const L = 34;
  const off = 26;
  const corners = [
    [px - off, py - off, 1, 1],
    [px + pw + off, py - off, -1, 1],
    [px - off, py + ph + off, 1, -1],
    [px + pw + off, py + ph + off, -1, -1],
  ];
  for (const [cx0, cy0, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx0 + sx * L, cy0);
    ctx.lineTo(cx0, cy0);
    ctx.lineTo(cx0, cy0 + sy * L);
    ctx.stroke();
  }

  // ================= 结论区：折叠次数 =================
  const foldY = py + ph + 202;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = accent + 'cc';
  ctx.shadowBlur = 50;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 176px ${CJK}`;
  ctx.fillText(String(st.folds), W / 2, foldY);
  ctx.restore();

  ctx.fillStyle = 'rgba(150,158,172,.9)';
  ctx.font = `400 28px ${CJK}`;
  ctx.fillText(t('card.afterFolds'), W / 2, foldY + 48);

  // STAGE 刻度尺
  const barY = foldY + 96;
  const segW = 44;
  const gap = 10;
  const totalW = st.stageMax * segW + (st.stageMax - 1) * gap;
  let bx = (W - totalW) / 2;
  for (let i = 1; i <= st.stageMax; i++) {
    const on = i <= st.stage;
    ctx.fillStyle = on ? accent : 'rgba(255,255,255,.12)';
    if (on) {
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 12;
      rr(ctx, bx, barY, segW, 7, 4);
      ctx.fill();
      ctx.restore();
    } else {
      rr(ctx, bx, barY, segW, 7, 4);
      ctx.fill();
    }
    bx += segW + gap;
  }
  ctx.fillStyle = 'rgba(135,143,157,.9)';
  ctx.font = `600 22px ${MONO}`;
  ctx.fillText(`STAGE ${String(st.stage).padStart(2, '0')} / ${String(st.stageMax).padStart(2, '0')}`, W / 2, barY + 40);

  // ================= 检测项表格 =================
  const tY = barY + 86;
  const tx0 = m;
  const tw = W - m * 2;
  const rows = [
    { head: true, a: t('card.th.item'), b: t('card.th.result'), c: t('card.th.verdict') },
    {
      a: t('card.row.crease'),
      b: st.stage >= 6 ? t('card.val.irreversible') : st.stage >= 3 ? t('card.val.visible') : t('card.val.slight'),
      bad: st.stage >= 6,
    },
    {
      a: t('card.row.touch'),
      b: st.stage >= 6 ? t('card.val.intermittent') : t('card.val.normal'),
      bad: st.stage >= 6,
    },
    {
      a: t('card.row.hinge'),
      b: st.sand > 0 ? t('card.val.debris') : st.stage >= 8 ? t('card.val.loose') : t('card.val.normal'),
      bad: st.sand > 0 || st.stage >= 8,
    },
    {
      a: t('card.row.surface'),
      b: st.fan > 0 ? t('card.val.coating') : t('card.val.intact'),
      bad: st.fan > 0,
    },
    {
      a: t('card.row.warranty'),
      b: st.ac > 0 ? t('card.val.careUsed') : t('card.val.careUnused'),
      dash: true,
    },
  ];

  const rowH = 52;   // 46 → 52：手机上看导出图时，行距太密根本读不进去
  ctx.font = `400 22px ${CJK}`;
  rows.forEach((row, i) => {
    const y = tY + i * rowH;
    const isHead = !!row.head;
    if (isHead) {
      ctx.fillStyle = 'rgba(255,255,255,.055)';
      ctx.fillRect(tx0, y - 34, tw, rowH);
    } else if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.02)';
      ctx.fillRect(tx0, y - 34, tw, rowH);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = isHead ? 'rgba(163,171,184,.92)' : 'rgba(214,220,230,.96)';
    ctx.font = `${isHead ? 600 : 400} 22px ${CJK}`;
    ctx.fillText(row.a, tx0 + 18, y);

    ctx.textAlign = 'center';
    ctx.fillStyle = isHead ? 'rgba(163,171,184,.92)' : 'rgba(188,196,210,.94)';
    ctx.fillText(row.b, tx0 + tw * 0.62, y);

    // 判定列：异常红 / 合格绿 / 无事可判（保修那条）灰
    const verdict = isHead ? row.c : row.dash ? '—' : row.bad ? t('card.val.fail') : t('card.val.pass');
    ctx.textAlign = 'right';
    ctx.fillStyle = isHead || row.dash
      ? 'rgba(163,171,184,.92)'
      : row.bad ? '#ff6b7a' : 'rgba(126,232,178,.95)';
    ctx.font = `${isHead ? 600 : 700} 22px ${CJK}`;
    ctx.fillText(verdict, tx0 + tw - 18, y);
  });

  // ================= 词条 =================
  let chipY = tY + rows.length * rowH + 34;
  if (traits.length) {
    // 高稀有度排前面：一眼先看到最珍贵的那几条
    const chips = [...traits].sort((a, b) => RAR_DESC[a.rarity] - RAR_DESC[b.rarity]);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(163,171,184,.92)';
    ctx.font = `600 21px ${CJK}`;
    ctx.fillText(t('card.defects', { n: traits.length }), m, chipY);

    // 右上：按稀有度统计，各自颜色，省得人去数
    ctx.textAlign = 'right';
    let rx = W - m;
    for (const rk of ['legendary', 'epic', 'rare', 'common']) {
      const n = traits.filter((x) => x.rarity === rk).length;
      if (!n) continue;
      const sk = RSKIN[rk];
      const label = `${RARITY[rk].label} ×${n}`;
      ctx.font = `600 19px ${CJK}`;
      ctx.fillStyle = sk.ink;
      ctx.fillText(label, rx, chipY - 2);
      rx -= ctx.measureText(label).width + 24;
    }

    const CH = 46;          // 胶囊高：38 → 46，字号跟着能上到 23
    let cx = m;
    let cy = chipY + 22;
    for (const tr of chips) {
      const sk = RSKIN[tr.rarity] || RSKIN.common;
      ctx.font = `600 23px ${CJK}`;
      const tw2 = ctx.measureText(tr.name).width + 56;   // 左形状标记 + 两侧留白
      if (cx + tw2 > W - m) { cx = m; cy += CH + 12; }

      const g = ctx.createLinearGradient(cx, cy, cx + tw2, cy + CH);
      g.addColorStop(0, sk.l1);
      g.addColorStop(1, sk.l2);
      rr(ctx, cx, cy, tw2, CH, 13);
      ctx.fillStyle = rgba(sk.fill, 0.17);
      ctx.fill();
      // 越高档描边越粗，还带一层自发光
      if (sk.glow) {
        ctx.save();
        ctx.shadowColor = rgba(sk.fill, 0.85);
        ctx.shadowBlur = sk.glow;
        ctx.strokeStyle = g;
        ctx.lineWidth = sk.lw;
        rr(ctx, cx, cy, tw2, CH, 13);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = g;
        ctx.lineWidth = sk.lw;
        rr(ctx, cx, cy, tw2, CH, 13);
        ctx.stroke();
      }

      rarMark(ctx, cx + 22, cy + CH / 2, tr.rarity, sk);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = sk.ink;
      ctx.fillText(tr.name, cx + 38, cy + CH / 2 + 1);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      cx += tw2 + 12;
    }
    chipY = cy + CH + 36;
  }

  // ================= 结论 =================
  // 结论靠左，右侧整段留给印章：长短句都不会被章压住
  const quoteY = Math.min(Math.max(chipY + 30, H - 300), H - 240);
  const quoteMaxW = W - m - 320;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(150,158,172,.8)';
  ctx.font = `400 20px ${MONO}`;
  ctx.fillText('INSPECTION CONCLUSION', m, quoteY - 32);

  const qb = fitBlock(ctx, st.quote, quoteMaxW, (s) => `400 ${s}px ${CJK}`, 29, 23, 2);
  ctx.fillStyle = st.broken ? '#ff6b7a' : 'rgba(214,220,230,.97)';
  ctx.font = `400 ${qb.size}px ${CJK}`;
  qb.lines.forEach((ln, i) => ctx.fillText(ln, m, quoteY + i * (qb.size + 12)));
  ctx.textAlign = 'center';

  // ================= 印章 =================
  const sx0 = W - 252;
  const sy0 = H - 236;
  ctx.save();
  ctx.translate(sx0, sy0);
  ctx.rotate(-0.22);
  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = '#e03b4a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e03b4a';
  ctx.textAlign = 'center';
  // 英文的章面词更长，字号得收一档，否则会顶出圆环
  const en = getLang() === 'en';
  ctx.font = `700 ${en ? 19 : 25}px ${CJK}`;
  ctx.fillText(t('card.stamp1'), 0, -6);
  ctx.font = `700 ${en ? 17 : 20}px ${CJK}`;
  ctx.fillText(t('card.stamp2'), 0, 26);
  ctx.font = `400 13px ${MONO}`;
  ctx.fillText(t('card.stamp3'), 0, 52);
  // 磨损痕迹
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    ctx.arc((Math.random() - 0.5) * 170, (Math.random() - 0.5) * 170, Math.random() * 4 + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ================= 底部条码 =================
  const bcY = H - 112;
  ctx.save();
  ctx.globalAlpha = 0.5;
  let bxp = m;
  let seed = 20261026;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  while (bxp < m + 300) {
    const w = rnd() > 0.5 ? 2 : 4;
    ctx.fillStyle = 'rgba(220,226,236,.75)';
    ctx.fillRect(bxp, bcY, w, 40);
    bxp += w + (rnd() > 0.5 ? 3 : 6);
  }
  ctx.restore();

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(140,148,163,.72)';
  ctx.font = `400 18px ${MONO}`;
  ctx.fillText('DUO FOLD · INSPECTION DIVISION', W - m, bcY + 28);
  ctx.fillText(st.serial, W - m, bcY + 54);

  // 底部正中一枚八角花徽记，高稀有度才画
  if (orn !== 'none') medallion(ctx, W / 2, H - 166, frameSkin, orn === 'classic' ? 28 : 22);

  return c;
}
