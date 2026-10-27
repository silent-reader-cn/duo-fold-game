// 数值系统 —— 参数直接沿用 Godot 版跑过 3 万次模拟的那一套
// 面向玩家的文字（品阶名 / 词条 / 台词）全部走 i18n，这里只留 id 与数值
import { t, pick } from './i18n.js';

/** 品阶名（1~10） */
export function stageNameOf(stage) {
  return t(`stage.${stage}`);
}

export const MAX_STAGE = 10;

// 三次方曲线：前段几乎安全，后段加速崩塌
const CURVE_DIV = 92;      // 尺度系数，越大越耐折
const STAGE_PENALTY = 0.0010;
const UP_BASE = 0.45;
const UP_DECAY = 0.75;
const GRACE_FOLDS = 2;

export const FAN_MAX = 1;   // 百分百触发词条，只能赌一次
export const SAND_MAX = 1;

// ================= 延保（CARE+）=================
// 单局最多能自动换机几次，随「本机达到过的最高品阶」解锁：
// 8 阶 → 2 次，9 阶 → 3 次，10 阶 → 4 次。升级要玩家在折叠数为 0 时自己点。
export const AC_LEVEL_MAX = 4;

export function acLevelFor(bestStage) {
  const s = Math.max(0, Math.floor(bestStage || 0));
  return Math.min(AC_LEVEL_MAX, Math.max(1, s - 6));
}

// ================= 长按充能（自动折叠）=================
// 手感参数：按住不动多久启动，以及充能过程中每一下震动的强度与间隔。
// 强度递增、间隔递减 —— 脉冲越来越密、越来越重，最后一下最强，启动瞬间不再补震。
export const HOLD_MS = 820;
export const HOLD_FIRST_DELAY = 130;   // 首下缓闸，避免正常拖拽白挨一下

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function holdPulseMs(progress) {
  return Math.round(5 + clamp01(progress) * 32);
}

export function holdPulseGap(progress) {
  return Math.round(150 - clamp01(progress) * 88);
}


// ================= 词条系统 =================
// 权重是按"该稀有度每个词条"给的，再按词条数量累加：
// 池内 7 普通 / 7 稀有 / 5 史诗 / 5 传说（道具专属已排除）
// 目标：传说占比约 2.9%，配合 fold 的词条触发率，约 100 折能撞到一次
export const RARITY = {
  common: { get label() { return t('rar.common'); }, color: '#9aa0a8', weight: 62 },
  rare: { get label() { return t('rar.rare'); }, color: '#4aa3ff', weight: 34 },
  epic: { get label() { return t('rar.epic'); }, color: '#b76bff', weight: 16 },
  legendary: { get label() { return t('rar.legendary'); }, color: '#ffb020', weight: 7.5 },
};

// 词条池只留 id + 稀有度；名称与说明按当前语言从 i18n 取（getter，切语言后自动跟着变）
const TRAIT_DEFS = [
  // ---- 普通：外观开始不对劲 ----
  ['crease', 'common'],
  ['greenline', 'common'],
  ['paint', 'common'],
  ['rattle', 'common'],
  ['warm', 'common'],
  ['dust', 'common'],
  ['chad', 'common'],

  // ---- 稀有：功能开始受损 ----
  ['loose', 'rare'],
  ['touch', 'rare'],
  ['deadpx', 'rare'],
  ['flicker', 'rare'],
  ['leak', 'rare'],
  ['peel', 'rare'],
  ['bulge', 'rare'],

  // ---- 史诗：结构性损伤 ----
  ['fullgreen', 'epic'],
  ['halfdead', 'epic'],
  ['bubble', 'epic'],
  ['hingeloosen', 'epic'],
  ['delam', 'epic'],

  // ---- 传说：荒诞级 ----
  ['mattegone', 'legendary'],
  ['selfheal', 'legendary'],
  ['officially', 'legendary'],
  ['unbroken', 'legendary'],
  ['freephone', 'legendary'],
  ['noreport', 'legendary'],
];

export const TRAITS = TRAIT_DEFS.map(([id, rarity]) => ({
  id,
  rarity,
  get name() { return t(`trait.${id}.name`); },
  get desc() { return t(`trait.${id}.desc`); },
}));

export const TRAIT_MAP = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

export class Game {
  constructor() { this.reset(); }

  reset() {
    this.folds = 0;
    this.stage = 1;
    this.broken = false;
    this.finished = false;
    this.breakBonus = 0;
    this.nextUpMult = 1;
    this.sandShield = false;
    this.fanSafe = false;
    this.acShield = false;
    this.fanUsed = 0;
    this.sandUsed = 0;
    this.acUsed = 0;
    // 延保上限是跨局保留的进度，换机时不能被打回 1
    this.acMax = this.acMax || 1;
    this.traits = [];
  }

  has(id) { return this.traits.includes(id); }

  /** 必定授予词条，返回本次新获得的列表 */
  grant(...ids) {
    const got = [];
    for (const id of ids) {
      if (!this.traits.includes(id) && TRAIT_MAP[id]) {
        this.traits.push(id);
        got.push(TRAIT_MAP[id]);
      }
    }
    return got;
  }

  /** 爆词条：越往后越容易爆，稀有度按权重抽 */
  rollTrait() {
    if (this.traits.length >= 9) return null;
    const chance = 0.22 + this.folds * 0.009;
    if (Math.random() > chance) return null;

    const ITEM_ONLY = ['mattegone', 'loose'];
    const pool = TRAITS.filter((t) => !this.traits.includes(t.id) && !ITEM_ONLY.includes(t.id));
    if (!pool.length) return null;

    const total = pool.reduce((s, t) => s + RARITY[t.rarity].weight, 0);
    let r = Math.random() * total;
    for (const t of pool) {
      r -= RARITY[t.rarity].weight;
      if (r <= 0) {
        this.traits.push(t.id);
        return t;
      }
    }
    return null;
  }

  get stageName() { return stageNameOf(this.stage); }

  breakChance(extra = 0) {
    const f = this.folds + extra;
    let p = Math.pow(f / CURVE_DIV, 3)
      + STAGE_PENALTY * Math.pow(this.stage - 1, 2)
      + this.breakBonus;
    if (f <= GRACE_FOLDS) p *= 0.2;
    return Math.min(Math.max(p, 0), 0.95);
  }

  upChance() {
    if (this.stage >= MAX_STAGE) return 0;
    const p = UP_BASE * Math.pow(UP_DECAY, this.stage - 1) * this.nextUpMult;
    return Math.min(Math.max(p, 0), 0.95);
  }

  /** 折一次。返回 { result, text } */
  fold() {
    this.folds += 1;
    const pBreak = this.breakChance();
    const pUp = this.upChance();
    this.nextUpMult = 1;

    let shielded = false;
    if (this.sandShield) { this.sandShield = false; shielded = true; }
    const safe = this.fanSafe;
    this.fanSafe = false;
    const guarded = shielded || safe;

    const r = Math.random();

    // 碎裂
    if (!guarded && r < pBreak) {
      // 延保自动生效：不需要手动开启，碎裂瞬间自动换机（上限随品阶升级）
      const acLeft = (this.acMax || 1) - this.acUsed;
      if (acLeft > 0) {
        this.acUsed += 1;
        this.acShield = false;
        return {
          result: 'ac',
          left: (this.acMax || 1) - this.acUsed,
          text: t('act.ac'),
        };
      }
      this.broken = true;
      this.finished = true;
      return { result: 'break' };
    }

    // 升阶
    let leveled = false;
    if (this.stage < MAX_STAGE) {
      leveled = guarded
        ? r < pUp
        : (r >= pBreak && r < pBreak + pUp);
    }
    const trait = this.rollTrait();

    if (leveled) {
      this.stage += 1;
      return { result: 'up', stage: this.stage, trait };
    }

    return { result: guarded ? 'guarded' : 'flat', trait };
  }

  useFan() {
    if (this.broken || this.finished || this.fanUsed >= FAN_MAX) return null;
    this.fanUsed += 1;
    this.nextUpMult = 2.5;
    this.fanSafe = true;
    this.breakBonus += 0.15;   // 高风险：换进度 + 专属词条
    const gained = this.grant('mattegone', 'crease');
    return {
      text: t('act.fan'),
      gained,
    };
  }

  useSand() {
    if (this.broken || this.finished || this.sandUsed >= SAND_MAX) return null;
    this.sandUsed += 1;
    this.sandShield = true;
    this.breakBonus += 0.13;   // 高风险：换一次免死 + 专属词条
    const gained = this.grant('loose', 'rattle');
    return {
      text: t('act.sand'),
      gained,
    };
  }

  // 延保已改为自动生效，不再手动开启
  useAC() {
    return null;
  }

  /** 还剩几次自动换机 */
  get acLeft() {
    return Math.max(0, (this.acMax || 1) - this.acUsed);
  }

  /** 折叠数为 0 时才能升级延保上限；target 由本机最高品阶算出 */
  upgradeAc(target) {
    if (this.folds !== 0 || this.broken || this.finished) return 0;
    const t = Math.min(AC_LEVEL_MAX, Math.max(1, Math.floor(target || 0)));
    if (t <= (this.acMax || 1)) return 0;
    const from = this.acMax || 1;
    this.acMax = t;
    return { from, to: t };
  }

  stop() {
    if (this.broken || this.finished) return false;
    this.finished = true;
    return true;
  }

  pickQuote() {
    if (this.broken) {
      return pick(['q.broken.0', 'q.broken.1', 'q.broken.2', 'q.broken.3']);
    }
    if (this.stage >= 7) {
      return pick(['q.late.0', 'q.late.1', 'q.late.2']);
    }
    return pick(['q.normal.0', 'q.normal.1', 'q.normal.2', 'q.normal.3']);
  }
}

/** 白折（什么也没发生）的随机嘴碎 */
export function flatLine() {
  return pick(['q.flat.0', 'q.flat.1', 'q.flat.2', 'q.flat.3', 'q.flat.4']);
}
