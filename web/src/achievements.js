// 成就手册：存浏览器本地
const KEY = 'duofold.ach.v1';

const EMPTY = { traits: {}, bestStage: 0, bestFolds: 0, runs: 0, legendary: 0, clears: 0 };

export function loadAch() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, traits: {} };
    const d = JSON.parse(raw);
    return { ...EMPTY, ...d, traits: d.traits || {} };
  } catch (e) {
    return { ...EMPTY, traits: {} };
  }
}

export function saveAch(a) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* 隐私模式下忽略 */ }
}

/** 记录一局结束 */
export function recordRun(game, isLegendary) {
  const a = loadAch();
  a.runs += 1;
  if (game.stage > a.bestStage) a.bestStage = game.stage;
  if (game.folds > a.bestFolds) a.bestFolds = game.folds;
  if (isLegendary) a.legendary += 1;
  for (const id of game.traits) {
    a.traits[id] = (a.traits[id] || 0) + 1;
  }
  saveAch(a);
  return a;
}

export function traitCount(a, id) {
  return (a && a.traits && a.traits[id]) || 0;
}
