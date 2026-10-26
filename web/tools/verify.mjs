// 用真实 Game 类验证曲线（不复制公式）
import { Game } from '../src/logic.js';

const RUNS = 100000;
const g = new Game();
const lives = [];
const finals = [];
let lv7 = 0, lv10 = 0;

for (let i = 0; i < RUNS; i++) {
  g.reset();
  let guard = 0;
  while (!g.broken && guard++ < 500) g.fold();
  lives.push(g.folds);
  finals.push(g.stage);
  if (g.stage >= 7) lv7++;
  if (g.stage >= 10) lv10++;
}

lives.sort((a, b) => a - b);
const sum = lives.reduce((a, b) => a + b, 0);
const avgStage = finals.reduce((a, b) => a + b, 0) / RUNS;

console.log('=== 真实代码验证（10 万局）===');
console.log('平均寿命', (sum / RUNS).toFixed(1), '折');
console.log('中位', lives[RUNS / 2], '| 10% 分位', lives[Math.floor(RUNS * 0.1)], '| 90% 分位', lives[Math.floor(RUNS * 0.9)], '| 99% 分位', lives[Math.floor(RUNS * 0.99)]);
console.log('平均最终阶', avgStage.toFixed(2), '/ 10');
console.log('7 阶+', (lv7 / RUNS * 100).toFixed(1) + '%', '| 传奇', (lv10 / RUNS * 100).toFixed(2) + '%');

console.log('');
console.log('=== 单次碎裂概率曲线（无道具、1 阶）===');
const parts = [];
for (let n = 5; n <= 90; n += 5) {
  const p = Math.min(Math.pow(n / 92, 3), 0.95) * 100;
  parts.push(`${n}折:${p.toFixed(1)}%`);
}
console.log(parts.join('  '));

console.log('');
console.log('=== 累计存活率 ===');
const cum = [];
let alive = 1;
for (let n = 1; n <= 80; n++) {
  const p = Math.min(Math.pow(n / 92, 3), 0.95);
  alive *= (1 - p);
  if (n % 10 === 0) cum.push(`${n}折:${(alive * 100).toFixed(0)}%`);
}
console.log(cum.join('  '));
