
import { Game, TRAIT_MAP, RARITY } from '../src/logic.js';

const RUNS = 60000;

function play(useItems) {
  const g = new Game();
  let fanDone = false, sandDone = false;
  let guard = 0;
  while (!g.broken && guard++ < 400) {
    // 玩家策略：瓶颈期用吹风机、危险时用沙子
    if (useItems && !fanDone && g.stage >= 4 && g.upChance() < 0.30) {
      g.useFan(); fanDone = true;
    }
    if (useItems && !sandDone && g.breakChance() > 0.30) {
      g.useSand(); sandDone = true;
    }
    g.fold();
  }
  return g;
}

function stats(useItems) {
  const stages = [];
  let highBoth = 0, highAny = 0, legendary = 0, maxTraits = 0;
  const rarityCount = { common: 0, rare: 0, epic: 0, legendary: 0 };

  for (let i = 0; i < RUNS; i++) {
    const g = play(useItems);
    stages.push(g.stage);
    const hasFan = g.has('mattegone');
    const hasSand = g.has('loose');
    if (g.stage >= 7 && hasFan && hasSand) highBoth++;
    if (g.stage >= 7 && (hasFan || hasSand)) highAny++;
    if (g.traits.some((id) => TRAIT_MAP[id].rarity === 'legendary')) legendary++;
    maxTraits = Math.max(maxTraits, g.traits.length);
    for (const id of g.traits) rarityCount[TRAIT_MAP[id].rarity]++;
  }

  stages.sort((a, b) => a - b);
  const avg = stages.reduce((a, b) => a + b, 0) / RUNS;
  return {
    avgStage: avg.toFixed(2),
    median: stages[Math.floor(RUNS / 2)],
    p7plus: (stages.filter((s) => s >= 7).length / RUNS * 100).toFixed(1),
    legendary: (legendary / RUNS * 100).toFixed(2),
    highBoth: (highBoth / RUNS * 100).toFixed(3),
    highAny: (highAny / RUNS * 100).toFixed(2),
    maxTraits,
    rarityPerRun: Object.fromEntries(Object.entries(rarityCount).map(([k, v]) => [k, (v / RUNS).toFixed(1)])),
  };
}

console.log('=== 不用道具 ===');
console.log(JSON.stringify(stats(false), null, 0));
console.log('');
console.log('=== 用吹风机+沙子 ===');
console.log(JSON.stringify(stats(true), null, 0));
