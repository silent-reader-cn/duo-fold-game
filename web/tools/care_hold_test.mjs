// 回归测试：延保（CARE+）上限解锁 + 长按充能手感参数
// 只测纯逻辑（logic.js），不碰 DOM，可直接 node tools/care_hold_test.mjs
import {
  Game,
  acLevelFor,
  AC_LEVEL_MAX,
  HOLD_MS,
  HOLD_FIRST_DELAY,
  holdPulseMs,
  holdPulseGap,
} from '../src/logic.js';

let pass = 0;
let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const ok = (label, cond, extra = '') => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL ${label} ${extra}`); }
};

// ---------- 1. 解锁表：本机历史最高品阶 -> 单局最多续命次数 ----------
[0, 1, 5, 6, 7].forEach((s) => eq(`acLevelFor(${s})`, acLevelFor(s), 1));
eq('acLevelFor(8)', acLevelFor(8), 2);
eq('acLevelFor(9)', acLevelFor(9), 3);
eq('acLevelFor(10)', acLevelFor(10), 4);
eq('acLevelFor(11) 封顶', acLevelFor(11), AC_LEVEL_MAX);

// ---------- 2. 升级只能在折叠数为 0 时发生 ----------
const g = new Game();
eq('初始 acMax', g.acMax, 1);
eq('初始剩几次', g.acLeft, 1);
eq('folds=0 升到 2', g.upgradeAc(2), { from: 1, to: 2 });
eq('同档重复点无效', g.upgradeAc(2), 0);
eq('直跳到 4', g.upgradeAc(9), { from: 2, to: 4 });
g.folds = 3;
eq('折叠中不能升级', g.upgradeAc(10), 0);
eq('越界请求被夹到上限', g.upgradeAc(99), 0);

// ---------- 3. 换机后上限保留、次数归零 ----------
g.acUsed = 2;
g.reset();
eq('reset 保留 acMax', g.acMax, 4);
eq('reset 清零 acUsed', g.acUsed, 0);
eq('reset 后剩余', g.acLeft, 4);

// ---------- 4. 碎裂时延保依次生效，用完才真碎 ----------
const orig = Math.random;
Math.random = () => 0;   // 必定碎裂
const g2 = new Game();
g2.acMax = 3;
const seq = [];
for (let i = 0; i < 4; i++) {
  g2.folds = 10;         // 跳过 grace，确保走碎裂分支
  const r = g2.fold();
  seq.push(r.result === 'ac' ? `ac${r.left}` : r.result);
}
const g3 = new Game();
g3.folds = 10;
const legacy = [g3.fold().result, g3.fold().result];
Math.random = orig;

eq('三次延保后第四次真碎', seq, ['ac2', 'ac1', 'ac0', 'break']);
eq('acUsed 记满', g2.acUsed, 3);
eq('用尽后剩余为 0', g2.acLeft, 0);
eq('acMax=1 时保留老行为', legacy, ['ac', 'break']);

// ---------- 5. 长按充能：强度递增、间隔递减 ----------
let prevMs = 0;
let prevGap = 1e9;
for (let i = 0; i <= 10; i++) {
  const p = i / 10;
  const ms = holdPulseMs(p);
  const gap = holdPulseGap(p);
  ok(`p=${p} 震动变强`, ms > prevMs, `ms=${ms} prev=${prevMs}`);
  ok(`p=${p} 间隔变短`, gap < prevGap, `gap=${gap} prev=${prevGap}`);
  prevMs = ms;
  prevGap = gap;
}
ok('起手最轻', holdPulseMs(0) <= 6, String(holdPulseMs(0)));
ok('收尾最重', holdPulseMs(1) >= 36, String(holdPulseMs(1)));
ok('进度越界被夹紧', holdPulseMs(9) === holdPulseMs(1) && holdPulseGap(-3) === holdPulseGap(0));

// 按真实时间轴走一遍：脉冲数量、最后一下的强度与位置
let t = HOLD_FIRST_DELAY;
const plan = [];
while (t < HOLD_MS) {
  const p = t / HOLD_MS;
  plan.push({ at: Math.round(t), ms: holdPulseMs(p) });
  t += holdPulseGap(p);
}
const last = plan[plan.length - 1];
ok('至少 5 下脉冲', plan.length >= 5, `n=${plan.length}`);
ok('最后一下落在启动前 120ms 内', HOLD_MS - last.at <= 120, `at=${last.at}`);
ok('最后一下最强', plan.every((s) => s.ms <= last.ms), JSON.stringify(plan));
ok('间隔确实在收缩', plan[plan.length - 1].at - plan[plan.length - 2].at < plan[1].at - plan[0].at);

console.log('充能脉冲时间轴:', plan.map((s) => `${s.at}ms:${s.ms}ms`).join('  '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
