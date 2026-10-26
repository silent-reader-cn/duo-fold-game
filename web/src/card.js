import { drawScreen } from './phone.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const CJK = '"PingFang SC","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif';

/**
 * 生成成就卡片（1080x1440）
 * st: { stage, stageName, stageMax, folds, fan, sand, ac, broken, quote, serial }
 */
export function makeCard(st) {
  const W = 1080;
  const H = 1440;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // 背景
  ctx.fillStyle = '#090a0c';
  ctx.fillRect(0, 0, W, H);

  // 顶部荧光边
  ctx.fillStyle = '#00ff88';
  ctx.fillRect(0, 0, W, 5);

  const m = 80;

  // 页眉
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6f747c';
  ctx.font = `400 32px ${CJK}`;
  ctx.fillText('iPHONE DUO', m, 128);

  ctx.fillStyle = '#eef0f4';
  ctx.font = `400 30px ${CJK}`;
  ctx.fillText('折叠耐力测试', m, 178);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#5c6169';
  ctx.font = `400 24px ${CJK}`;
  ctx.fillText(st.serial, W - m, 128);

  // ---- 手机图形 ----
  const pw = 620;
  const ph = 443;          // 1.4:1 阔屏
  const px = (W - pw) / 2;
  const py = 232;

  // 机身
  const bodyGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
  bodyGrad.addColorStop(0, '#d6dae1');
  bodyGrad.addColorStop(0.45, '#9aa0a9');
  bodyGrad.addColorStop(1, '#c6cad2');
  ctx.save();
  roundRect(ctx, px - 11, py - 11, pw + 22, ph + 22, 30);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.restore();

  // 屏幕内容
  const sc = document.createElement('canvas');
  sc.width = 1024;
  sc.height = 731;
  drawScreen(sc.getContext('2d'), {
    stage: st.stage,
    folds: st.folds,
    broken: st.broken,
    matte: st.fan === 0,
    sand: st.sand > 0,
  });

  ctx.save();
  roundRect(ctx, px, py, pw, ph, 22);
  ctx.clip();
  ctx.drawImage(sc, px, py, pw, ph);
  ctx.restore();

  // 折线高光
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, py);
  ctx.lineTo(W / 2, py + ph);
  ctx.stroke();

  // ---- 品阶 ----
  ctx.textAlign = 'center';
  ctx.fillStyle = st.broken ? '#ff5252' : '#eef0f4';
  ctx.font = `700 80px ${CJK}`;
  ctx.fillText(st.stageName, W / 2, 790);

  ctx.fillStyle = '#00ff88';
  ctx.font = `400 27px ${CJK}`;
  ctx.fillText(`STAGE ${String(st.stage).padStart(2, '0')} / ${String(st.stageMax).padStart(2, '0')}`, W / 2, 840);

  // ---- 折叠次数 ----
  ctx.fillStyle = '#eef0f4';
  ctx.font = `700 168px ${CJK}`;
  ctx.fillText(String(st.folds), W / 2, 1010);

  ctx.fillStyle = '#6f747c';
  ctx.font = `400 32px ${CJK}`;
  ctx.fillText('次折叠', W / 2, 1060);

  // ---- 道具 ----
  ctx.fillStyle = '#5f646c';
  ctx.font = `400 25px ${CJK}`;
  ctx.fillText(`吹风机 ×${st.fan}     沙子 ×${st.sand}     AppleCare+ ×${st.ac}`, W / 2, 1140);

  // 分割线
  ctx.strokeStyle = 'rgba(60,64,72,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(m, 1200);
  ctx.lineTo(W - m, 1200);
  ctx.stroke();

  // ---- 评语 ----
  ctx.fillStyle = st.broken ? '#00ff88' : '#dfe3ea';
  ctx.font = `400 30px ${CJK}`;
  ctx.fillText(st.quote, W / 2, 1272);

  return c;
}
