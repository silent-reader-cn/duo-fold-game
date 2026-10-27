import { drawScreen } from './phone.js';
import { RARITY } from './logic.js';

const CJK = '"PingFang SC","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif';
const MONO = '"SF Mono","Consolas","Roboto Mono",monospace';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
  const H = 1960;   // 检测报告句式更长，需要更多纵向空间
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
  const accent = st.broken ? '#ff4d5e' : topRarity ? RARITY[topRarity].color : '#00ff88';
  const gr = grade(st);

  // ================= 底色 =================
  const bg = ctx.createLinearGradient(0, 0, W * 0.35, H);
  bg.addColorStop(0, '#101419');
  bg.addColorStop(0.5, '#0a0d11');
  bg.addColorStop(1, '#05070a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 技术网格底纹
  ctx.strokeStyle = 'rgba(255,255,255,.028)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 54) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 54) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 主色光晕
  const halo = ctx.createRadialGradient(W / 2, 620, 40, W / 2, 660, 660);
  halo.addColorStop(0, accent + '44');
  halo.addColorStop(0.45, accent + '12');
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

  // 外框（双线）
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  rr(ctx, 24, 24, W - 48, H - 48, 26);
  ctx.stroke();
  ctx.strokeStyle = accent + '30';
  ctx.lineWidth = 1;
  rr(ctx, 32, 32, W - 64, H - 64, 22);
  ctx.stroke();

  // ================= 报告页眉 =================
  ctx.textAlign = 'left';
  ctx.fillStyle = accent;
  ctx.font = `700 26px ${CJK}`;
  ctx.fillText('DEVICE INSPECTION REPORT', m, 106);

  ctx.fillStyle = 'rgba(150,158,172,.85)';
  ctx.font = `400 22px ${MONO}`;
  ctx.fillText('设备折叠耐久性检测报告', m, 142);

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

  // 分隔线
  ctx.fillStyle = accent + '66';
  ctx.fillRect(m, 166, W - m * 2, 1.5);

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
  ctx.fillText('综合评级', m, badgeY + 32);
  ctx.fillStyle = gr.color;
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
  ctx.fillText('次折叠后送检', W / 2, foldY + 48);

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
    ['检测项', '结果', '判定', true],
    ['屏幕折痕', st.stage >= 6 ? '深度不可逆' : st.stage >= 3 ? '可见' : '轻微', st.stage >= 6 ? '异常' : '合格'],
    ['触控功能', st.stage >= 6 ? '间歇失效' : '正常', st.stage >= 6 ? '异常' : '合格'],
    ['铰链结构', st.sand > 0 ? '异物侵入' : st.stage >= 8 ? '松动' : '正常', st.sand > 0 || st.stage >= 8 ? '异常' : '合格'],
    ['屏幕表面', st.fan > 0 ? '涂层脱落' : '完好', st.fan > 0 ? '异常' : '合格'],
    ['保修状态', st.ac > 0 ? '已使用延保' : '未使用', '—'],
  ];

  const rowH = 46;
  ctx.font = `400 21px ${CJK}`;
  rows.forEach((row, i) => {
    const y = tY + i * rowH;
    const isHead = i === 0;
    if (isHead) {
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(tx0, y - 30, tw, rowH);
    } else if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,.018)';
      ctx.fillRect(tx0, y - 30, tw, rowH);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = isHead ? 'rgba(150,158,172,.85)' : 'rgba(196,203,214,.92)';
    ctx.font = `${isHead ? 600 : 400} 20px ${CJK}`;
    ctx.fillText(row[0], tx0 + 18, y);

    ctx.textAlign = 'center';
    ctx.fillStyle = isHead ? 'rgba(150,158,172,.85)' : 'rgba(170,178,192,.85)';
    ctx.fillText(row[1], tx0 + tw * 0.62, y);

    ctx.textAlign = 'right';
    const bad = row[2] === '异常';
    ctx.fillStyle = isHead ? 'rgba(150,158,172,.85)' : bad ? '#ff5c6c' : 'rgba(120,190,150,.9)';
    ctx.font = `${isHead ? 600 : 700} 20px ${CJK}`;
    ctx.fillText(row[2], tx0 + tw - 18, y);
  });

  // ================= 词条 =================
  let chipY = tY + rows.length * rowH + 34;
  if (traits.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(120,128,142,.75)';
    ctx.font = `400 19px ${CJK}`;
    ctx.fillText(`检出故障项 ${traits.length}`, m, chipY);

    ctx.textAlign = 'center';
    let cx = m;
    let cy = chipY + 18;
    for (const t of traits) {
      const rar = RARITY[t.rarity] || RARITY.common;
      ctx.font = `600 21px ${CJK}`;
      const tw2 = ctx.measureText(t.name).width + 34;
      if (cx + tw2 > W - m) { cx = m; cy += 50; }
      rr(ctx, cx, cy, tw2, 38, 19);
      ctx.fillStyle = rar.color + '20';
      ctx.fill();
      ctx.strokeStyle = rar.color + '80';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = rar.color;
      ctx.fillText(t.name, cx + tw2 / 2, cy + 26);
      cx += tw2 + 12;
    }
    chipY = cy + 76;
  }

  // ================= 结论 =================
  const quoteY = Math.min(Math.max(chipY + 30, H - 300), H - 240);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(120,128,142,.7)';
  ctx.font = `400 19px ${MONO}`;
  ctx.fillText('INSPECTION CONCLUSION', W / 2, quoteY - 32);

  ctx.fillStyle = st.broken ? '#ff5c6c' : 'rgba(200,208,220,.95)';
  ctx.font = `400 27px ${CJK}`;
  ctx.fillText(st.quote, W / 2, quoteY);

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
  ctx.font = `700 25px ${CJK}`;
  ctx.fillText('人为损坏', 0, -6);
  ctx.font = `700 20px ${CJK}`;
  ctx.fillText('不予保修', 0, 26);
  ctx.font = `400 13px ${MONO}`;
  ctx.fillText('NOT COVERED', 0, 52);
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
  ctx.fillStyle = 'rgba(120,128,142,.6)';
  ctx.font = `400 17px ${MONO}`;
  ctx.fillText('DUO FOLD · INSPECTION DIVISION', W - m, bcY + 28);
  ctx.fillText(st.serial, W - m, bcY + 52);

  return c;
}
