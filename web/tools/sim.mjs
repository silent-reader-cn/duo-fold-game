// 曲线调参模拟：目标中位寿命 ≈ 30 折，风险加速上升
const RUNS = 200000;
const MAX_STAGE = 10;

const CONFIGS = [
  { name: 'G', div: 95, sp: 0.0015, upBase: 0.48, upDecay: 0.76 },
  { name: 'H', div: 100, sp: 0.0012, upBase: 0.46, upDecay: 0.75 },
  { name: 'I', div: 105, sp: 0.0018, upBase: 0.50, upDecay: 0.77 },
  { name: 'J', div: 92, sp: 0.0010, upBase: 0.45, upDecay: 0.75 },
  { name: 'K', div: 112, sp: 0.0020, upBase: 0.52, upDecay: 0.78 },
  { name: 'L', div: 88, sp: 0.0007, upBase: 0.44, upDecay: 0.74 },
];

function run(cfg) {
  const lives = [];
  const finals = [];
  let lv10 = 0;
  let lv7 = 0;

  for (let r = 0; r < RUNS; r++) {
    let folds = 0;
    let stage = 1;
    let broken = false;

    while (!broken && folds < 400) {
      folds += 1;
      let p = Math.pow(folds / cfg.div, 3) + cfg.sp * Math.pow(stage - 1, 2);
      if (folds <= 2) p *= 0.2;
      p = Math.min(Math.max(p, 0), 0.95);

      let pu = 0;
      if (stage < MAX_STAGE) {
        pu = Math.min(Math.max(cfg.upBase * Math.pow(cfg.upDecay, stage - 1), 0), 0.95);
      }

      const x = Math.random();
      if (x < p) { broken = true; break; }
      if (stage < MAX_STAGE && x < p + pu) stage += 1;
    }

    lives.push(folds);
    finals.push(stage);
    if (stage >= 10) lv10 += 1;
    if (stage >= 7) lv7 += 1;
  }

  lives.sort((a, b) => a - b);
  const sum = lives.reduce((a, b) => a + b, 0);
  const avgStage = finals.reduce((a, b) => a + b, 0) / RUNS;
  const p50 = lives[Math.floor(RUNS * 0.5)];
  const p10 = lives[Math.floor(RUNS * 0.1)];
  const p90 = lives[Math.floor(RUNS * 0.9)];
  const p99 = lives[Math.floor(RUNS * 0.99)];

  // 第 30 折时的单次碎裂率（不含阶数惩罚的裸曲线参考）
  const raw30 = Math.pow(30 / cfg.div, 3);

  console.log(
    `${cfg.name} div=${cfg.div} sp=${cfg.sp} up=${cfg.upBase}/${cfg.upDecay} | ` +
    `均值 ${(sum / RUNS).toFixed(1)} | 中位 ${p50} | 10%分位 ${p10} | 90%分位 ${p90} | 99%分位 ${p99} | ` +
    `平均阶 ${avgStage.toFixed(2)} | 7阶+ ${(lv7 / RUNS * 100).toFixed(1)}% | 传奇 ${(lv10 / RUNS * 100).toFixed(2)}% | ` +
    `裸P(30)=${(raw30 * 100).toFixed(1)}%`
  );
}

console.log(`目标：中位 ≈ 30 折，曲线三次方加速`);
console.log('');
for (const c of CONFIGS) run(c);
