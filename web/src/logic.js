// 数值系统 —— 参数直接沿用 Godot 版跑过 3 万次模拟的那一套
export const STAGE_NAMES = [
  '全新未拆封', '初见折痕', '折痕明显', '偶发闪屏', '一缕绿线',
  '触控时灵', '久经沙场', '战损成色', '苹果拒保', '传奇·一掰就碎',
];
export const MAX_STAGE = 10;

// 三次方曲线：前段几乎安全，后段加速崩塌
const CURVE_DIV = 92;      // 尺度系数，越大越耐折
const STAGE_PENALTY = 0.0010;
const UP_BASE = 0.45;
const UP_DECAY = 0.75;
const GRACE_FOLDS = 2;

export const FAN_MAX = 1;   // 百分百触发词条，只能赌一次
export const SAND_MAX = 1;


// ================= 词条系统 =================
export const RARITY = {
  common: { label: '普通', color: '#9aa0a8', weight: 78 },
  rare: { label: '稀有', color: '#4aa3ff', weight: 18 },
  epic: { label: '史诗', color: '#b76bff', weight: 3.85 },
  legendary: { label: '传说', color: '#ffb020', weight: 0.3 },
};

export const TRAITS = [
  // ---- 普通：外观开始不对劲 ----
  { id: 'crease', name: '折痕加深', rarity: 'common', desc: '折线在侧光下越来越明显' },
  { id: 'greenline', name: '一缕绿线', rarity: 'common', desc: '折线处泛出一条 1mm 的绿' },
  { id: 'paint', name: '边缘掉漆', rarity: 'common', desc: '钛边框开始掉色' },
  { id: 'rattle', name: '铰链异响', rarity: 'common', desc: '每次开合都咔哒一声' },
  { id: 'warm', name: '轻微发烫', rarity: 'common', desc: '高负载下烫手' },
  { id: 'dust', name: '铰链进灰', rarity: 'common', desc: '口袋里的碎屑攒在铰链口' },
  { id: 'chad', name: '小 A 壳翘起', rarity: 'common', desc: '内屏边框的防尘麦拉翘了起来' },

  // ---- 稀有：功能开始受损 ----
  { id: 'loose', name: '合不严实', rarity: 'rare', desc: '铰链卡了沙，合上留一道缝' },
  { id: 'touch', name: '触控漂移', rarity: 'rare', desc: '触点会自己乱跑' },
  { id: 'deadpx', name: '坏点扩散', rarity: 'rare', desc: '绿色坏点开始蔓延' },
  { id: 'flicker', name: '偶发闪屏', rarity: 'rare', desc: '屏幕时不时抽一下' },
  { id: 'leak', name: '内屏漏液', rarity: 'rare', desc: '角落渗出黑斑，报价四位数' },
  { id: 'peel', name: '保护膜起翘', rarity: 'rare', desc: '原厂膜从边角开始卷' },
  { id: 'bulge', name: '异物顶包', rarity: 'rare', desc: '屏下有个东西，一按就顶出鼓包' },

  // ---- 史诗：结构性损伤 ----
  { id: 'fullgreen', name: '绿线贯通', rarity: 'epic', desc: '整条折线都在发绿' },
  { id: 'halfdead', name: '半屏失效', rarity: 'epic', desc: '右边那一半不太行了' },
  { id: 'bubble', name: '折线起泡', rarity: 'epic', desc: '膜下鼓起了气泡，通常几小时内脱层' },
  { id: 'hingeloosen', name: '铰链松动', rarity: 'epic', desc: '机身能自己晃' },
  { id: 'delam', name: '整屏脱层', rarity: 'epic', desc: 'OLED 层和玻璃分家了' },

  // ---- 传说：荒诞级 ----
  { id: 'mattegone', name: '磨砂膜脱落', rarity: 'legendary', desc: '纳米纹理被撕了，屏幕变亮面' },
  { id: 'selfheal', name: '假性自愈', rarity: 'legendary', desc: '裂纹看着淡了一点——别信' },
  { id: 'officially', name: '官方拒保', rarity: 'legendary', desc: '你已被列入人为损坏名单' },
  { id: 'unbroken', name: '越折越紧', rarity: 'legendary', desc: '这台的铰链反而更结实了' },
  { id: 'freephone', name: '免费换新', rarity: 'legendary', desc: '检测为非人为，直接换机' },
  { id: 'noreport', name: '无检测报告', rarity: 'legendary', desc: '判定人为，但拒绝出具报告' },
];

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

  get stageName() { return STAGE_NAMES[this.stage - 1]; }

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
      if (this.acShield) {
        this.acShield = false;
        this.acUsed += 1;
        this.stage = Math.max(1, this.stage - 1);
        return { result: 'ac', text: '屏幕窜出一道绿线——AppleCare+ 挡下了，换机。标签被降一阶。' };
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
      text: '吹风机加热，磨砂层被撕下——屏幕秒变亮面，折痕无处可藏。保修标记灰了。',
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
      text: '一小撮沙子进了铰链。它能帮你硬扛一折，代价是永远合不严、而且每次开合都咔哒响。',
      gained,
    };
  }

  useAC() {
    if (this.broken || this.finished || this.acShield || this.acUsed >= 1) return null;
    this.acUsed += 1;
    this.acShield = true;
    return '你花 2599 元买了 AppleCare+。碎裂时能免死一次，但标签要降一阶。';
  }

  stop() {
    if (this.broken || this.finished) return false;
    this.finished = true;
    return true;
  }

  pickQuote() {
    if (this.broken) {
      const arr = [
        '客服：属人为损坏。',
        '检测结论：非人为。但屏幕还是裂了。',
        '已为您安排更换新机。新机同样易碎。',
        '我们对您的不便深表遗憾。（本条为全部赔偿）',
      ];
      return arr[Math.floor(Math.random() * arr.length)];
    }
    if (this.stage >= 7) {
      const arr = ['它还能折。大概。', '这不是手机，是一段经历。', '别问保修，问就是人为。'];
      return arr[Math.floor(Math.random() * arr.length)];
    }
    const arr = [
      '你确实没用力。它确实碎了。（预告）',
      '建议购买 AppleCare+。',
      '折痕还在可接受范围内。今天。',
      '形态完好，心情复杂。',
    ];
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

export const FLAT_LINES = [
  '这一折……什么也没发生。但折痕更深了。',
  '咔哒。还是那样。',
  '你怀疑自己是不是折反了。',
  '屏幕的光比刚才暗了一点点。',
  '没有升级。风险倒是涨了。',
];
