import { drawScreen } from './phone.js';
import { RARITY } from './logic.js';

const CJK = '"PingFang SC","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 生成成就卡片
 * st: { stage, stageName, stageMax, folds, fan, sand, ac, broken, quote, serial, traits }
 * traits: [{ id, name, rarity }]
 */
export function makeCard(st) {
  const W = 1080;
  const H = 1720;   // 预留两行词条区，评语与水印永不重叠
  const SS = 2;                       // 超采样
  const c = document.createElement('canvas');
  c.width = W * SS;
  c.height = H * SS;
  const ctx = c.getContext('2d');
  ctx.scale(SS, SS);

  const traits = st.traits || [];
  // 主色调 = 已获得词条里的最高稀有度
  const order = { common: 0, rare: 1, epic: 2, legendary: 3 };
  let topRarity = null;
  for (const t of traits) {
    if (!topRarity || order[t.rarity] > order[topRarity]) topRarity = t.rarity;
  }
  const accent = st.broken ? '#ff4d5e'
    : topRarity ? RARITY[topRarity].color
    : '#00ff88';
  const accentSoft = accent + '55';

  // ---------- 背景 ----------
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, '#0d1016');
  bg.addColorStop(0.45, '#080a0e');
  bg.addColorStop(1, '#040507');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 主色径向光晕（从卡片中上部散开）
  const halo = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 560, 620);
  halo.addColorStop(0, accentSoft);
  halo.addColorStop(0.42, accent + '16');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // 斜向光带
  ctx.save();
  ctx.globalAlpha = 0.06;
  const beam = ctx.createLinearGradient(0, H, W, 0);
  beam.addColorStop(0, 'rgba(255,255,255,0)');
  beam.addColorStop(0.5, '#ffffff');
  beam.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(-100, H * 0.72);
  ctx.lineTo(W * 0.6, -50);
  ctx.lineTo(W * 0.78, -50);
  ctx.lineTo(-100, H * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 噪点
  ctx.save();
  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
  }
  ctx.restore();

  // 外框
  ctx.strokeStyle = accent + '3a';
  ctx.lineWidth = 2;
  rr(ctx, 26, 26, W - 52, H - 52, 30);
  ctx.stroke();

  const m = 76;

  // ---------- 页眉 ----------
  ctx.textAlign = 'left';
  ctx.fillStyle = accent;
  ctx.font = `700 30px ${CJK}`;
  ctx.fillText('iPHONE DUO', m, 122);

  ctx.fillStyle = 'rgba(150,158,172,.85)';
  ctx.font = `400 27px ${CJK}`;
  ctx.fillText('折叠耐力测试', m, 166);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(110,118,132,.8)';
  ctx.font = `400 24px ${CJK}`;
  ctx.fillText(st.serial, W - m, 122);

  // 页眉下的细线
  const hl = ctx.createLinearGradient(m, 0, W - m, 0);
  hl.addColorStop(0, accent + '90');
  hl.addColorStop(0.6, accent + '20');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(m, 196, W - m * 2, 2);

  // ---------- 手机 ----------
  const pw = 660;
  const ph = Math.round(pw / 1.4);
  const px = (W - pw) / 2;
  const py = 244;

  // 机身阴影/光边
  ctx.save();
  ctx.shadowColor = accent + '88';
  ctx.shadowBlur = 54;
  rr(ctx, px - 12, py - 12, pw + 24, ph + 24, 34);
  const frame = ctx.createLinearGradient(px, py, px + pw, py + ph);
  frame.addColorStop(0, '#e8ecf2');
  frame.addColorStop(0.4, '#9ba2ad');
  frame.addColorStop(0.65, '#cfd5de');
  frame.addColorStop(1, '#7d848f');
  ctx.fillStyle = frame;
  ctx.fill();
  ctx.restore();

  // 屏幕内容
  const sc = document.createElement('canvas');
  sc.width = 1024 * 2;
  sc.height = 731 * 2;
  const sctx = sc.getContext('2d');
  sctx.scale(2, 2);
  drawScreen(sctx, {
    stage: st.stage,
    folds: st.folds,
    broken: st.broken,
    matte: st.fan === 0,
    sand: st.sand > 0,
    traits: traits.map((t) => t.id),
  });

  ctx.save();
  rr(ctx, px, py, pw, ph, 26);
  ctx.clip();
  ctx.drawImage(sc, px, py, pw, ph);
  // 屏幕内的冷色反光
  const gl = ctx.createLinearGradient(px, py, px + pw * 0.6, py + ph);
  gl.addColorStop(0, 'rgba(160,200,255,.10)');
  gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  gl.addColorStop(1, 'rgba(0,0,0,.18)');
  ctx.fillStyle = gl;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  // ---------- 品阶 ----------
  const nameY = py + ph + 118;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 40;
  ctx.fillStyle = st.broken ? '#ff5c6c' : '#f4f7fb';
  ctx.font = `800 92px ${CJK}`;
  ctx.fillText(st.stageName, W / 2, nameY);
  ctx.restore();

  // STAGE 进度格
  const barY = nameY + 44;
  const segW = 46;
  const gap = 11;
  const totalW = st.stageMax * segW + (st.stageMax - 1) * gap;
  let bx = (W - totalW) / 2;
  for (let i = 1; i <= st.stageMax; i++) {
    const on = i <= st.stage;
    ctx.fillStyle = on ? accent : 'rgba(255,255,255,.10)';
    if (on) {
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      rr(ctx, bx, barY, segW, 9, 5);
      ctx.fill();
      ctx.restore();
    } else {
      rr(ctx, bx, barY, segW, 9, 5);
      ctx.fill();
    }
    bx += segW + gap;
  }
  ctx.fillStyle = 'rgba(140,148,162,.9)';
  ctx.font = `600 26px ${CJK}`;
  ctx.fillText(`STAGE ${String(st.stage).padStart(2, '0')} / ${String(st.stageMax).padStart(2, '0')}`, W / 2, barY + 46);

  // ---------- 折叠次数 ----------
  const foldY = barY + 236;   // 与上方 STAGE 行拉开，避免大字顶部和它贴住
  ctx.save();
  ctx.shadowColor = accent + 'cc';
  ctx.shadowBlur = 56;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 190px ${CJK}`;
  ctx.fillText(String(st.folds), W / 2, foldY);
  ctx.restore();

  ctx.fillStyle = 'rgba(150,158,172,.9)';
  ctx.font = `400 32px ${CJK}`;
  ctx.fillText('次折叠', W / 2, foldY + 52);

  // ---------- 数据格 ----------
  const statsY = foldY + 120;
  const items = [
    { k: '吹风机', v: st.fan > 0 ? `×${st.fan}` : '未用' },
    { k: '沙子', v: st.sand > 0 ? `×${st.sand}` : '未用' },
    { k: 'AppleCare+', v: st.ac > 0 ? '已用' : '未用' },
  ];
  const cellW = 232;
  const cellGap = 26;
  let sx = (W - (cellW * 3 + cellGap * 2)) / 2;
  for (const it of items) {
    rr(ctx, sx, statsY, cellW, 96, 18);
    ctx.fillStyle = 'rgba(255,255,255,.045)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = 'rgba(140,148,162,.9)';
    ctx.font = `400 23px ${CJK}`;
    ctx.fillText(it.k, sx + cellW / 2, statsY + 38);
    ctx.fillStyle = it.v === '未用' ? 'rgba(105,112,124,.85)' : accent;
    ctx.font = `700 30px ${CJK}`;
    ctx.fillText(it.v, sx + cellW / 2, statsY + 76);
    sx += cellW + cellGap;
  }

  // ---------- 词条 ----------
  let chipY = statsY + 150;
  if (traits.length) {
    ctx.fillStyle = 'rgba(120,128,142,.75)';
    ctx.font = `400 22px ${CJK}`;
    ctx.textAlign = 'left';
    ctx.fillText(`故障词条 ${traits.length}`, m, chipY - 22);

    ctx.textAlign = 'center';
    let cx = m;
    let cy = chipY;
    for (const t of traits) {
      const rar = RARITY[t.rarity] || RARITY.common;
      ctx.font = `600 24px ${CJK}`;
      const tw = ctx.measureText(t.name).width + 40;
      if (cx + tw > W - m) { cx = m; cy += 56; }
      rr(ctx, cx, cy, tw, 42, 21);
      ctx.fillStyle = rar.color + '22';
      ctx.fill();
      ctx.strokeStyle = rar.color + '88';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = rar.color;
      ctx.fillText(t.name, cx + tw / 2, cy + 29);
      cx += tw + 14;
    }
    chipY = cy + 82;
  }

  // ---------- 评语 ----------
  // 评语固定在水印上方；词条多时允许上移，但绝不压到水印
  const markY = H - 76;
  const quoteY = Math.min(Math.max(chipY + 52, H - 210), markY - 52);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(180,188,202,.92)';
  ctx.font = `400 30px ${CJK}`;
  ctx.fillText(st.quote, W / 2, quoteY);

  // 底部标记
  ctx.fillStyle = accent + '70';
  ctx.font = `600 20px ${CJK}`;
  ctx.fillText('DUO FOLD · 折叠耐力测试', W / 2, markY);

  return c;
}
