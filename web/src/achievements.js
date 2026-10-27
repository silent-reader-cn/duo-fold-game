// 成就存档：存浏览器本地
const KEY = 'duofold.ach.v1';

const EMPTY = { traits: {}, bestStage: 0, bestFolds: 0, runs: 0, legendary: 0, clears: 0, acMax: 1, unseen: [] };

export function loadAch() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, traits: {}, unseen: [] };
    const d = JSON.parse(raw);
    return { ...EMPTY, ...d, traits: d.traits || {}, unseen: Array.isArray(d.unseen) ? d.unseen : [] };
  } catch (e) {
    return { ...EMPTY, traits: {}, unseen: [] };
  }
}

export function saveAch(a) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* 隐私模式下忽略 */ }
}

/** 延保上限：跨局保留的进度，读档时兜底到 1~4 */
export function loadAcMax() {
  const v = Math.floor(loadAch().acMax || 1);
  return Math.min(4, Math.max(1, v));
}

export function saveAcMax(n) {
  const a = loadAch();
  a.acMax = Math.min(4, Math.max(1, Math.floor(n || 1)));
  saveAch(a);
  return a.acMax;
}

/** 记录一局结束；首次解锁的词条进 unseen，用来在入口上点小红点 */
export function recordRun(game, isLegendary) {
  const a = loadAch();
  a.runs += 1;
  if (game.stage > a.bestStage) a.bestStage = game.stage;
  if (game.folds > a.bestFolds) a.bestFolds = game.folds;
  if (isLegendary) a.legendary += 1;
  for (const id of game.traits) {
    if (!traitCount(a, id) && !a.unseen.includes(id)) a.unseen.push(id);
    a.traits[id] = (a.traits[id] || 0) + 1;
  }
  saveAch(a);
  return a;
}

export function traitCount(a, id) {
  return (a && a.traits && a.traits[id]) || 0;
}

/** 还没看过的新解锁数量 */
export function unseenCount() {
  return loadAch().unseen.length;
}

/** 打开成就页就算看过了 */
export function markSeen() {
  const a = loadAch();
  if (!a.unseen.length) return 0;
  const n = a.unseen.length;
  a.unseen = [];
  saveAch(a);
  return n;
}
