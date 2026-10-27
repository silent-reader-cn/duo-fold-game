// 双语支持（zh / en）—— 所有面向玩家的文案都收在这一个文件里
//
// 判定顺序：URL 上的 ?lang=xx → localStorage 记住的选择 → 浏览器语言 → 兜底英文
// （中文浏览器默认中文，其它语言一律英文。?lang=en / ?lang=zh 可手动覆盖并记住）
//
// 用法：
//   t('hud.book')                  取当前语言文本
//   t('log.acLeft', { n: 2 })      填 {n} 占位
//   applyStatic()                  把 index.html 里 data-i18n* 标记的静态文案刷一遍

export const LANGS = ['zh', 'en'];
const STORE_KEY = 'duofold.lang';

// ================= 文案表：[中文, 英文] =================
const DICT = {
  // ---- 页面元信息 ----
  'meta.title': ['Duo Fold · 折叠耐力测试', 'Duo Fold · Fold Endurance Test'],
  'brand.sub': ['折叠耐力测试', 'FOLD TEST'],

  // ---- 顶栏 ----
  'hud.folds': ['折叠 <b>{n}</b> 次', '<b>{n}</b> folds'],
  'hud.traits': ['词条 {n} / 9', 'Traits {n} / 9'],
  'hud.traitsInit': ['词条 0 / 9', 'Traits 0 / 9'],
  'hud.book': ['成就', 'Awards'],
  'hud.gh': ['在 GitHub 上查看源码', 'View the source on GitHub'],

  // ---- 新手引导 ----
  'hint.swipeTitle': ['向右滑动', 'Swipe right'],
  'hint.swipeSub': ['按住机身 · 掰出第一折', 'Hold the body · bend the first fold'],
  'hint.holdTitle': ['长按不动', 'Press and hold'],
  'hint.holdSub': ['按住不放 · 松手即停', 'Keep holding · release to stop'],

  // ---- 底部道具 ----
  'item.fan': ['吹风机', 'Heat gun'],
  'item.sand': ['沙子', 'Sand'],
  'item.care': ['延保', 'CARE+'],
  'item.stop': ['收手 · 出成就卡', 'Cash out · make the card'],

  // ---- 延保说明（开局前摊开给玩家看的那块）----
  'care.bestLabel': ['本机最高', 'Device best'],
  'care.none': ['暂无记录', 'No record yet'],
  'care.rule2': ['8 阶 · 2 次', 'Stage 8 · 2'],
  'care.rule3': ['9 阶 · 3 次', 'Stage 9 · 3'],
  'care.rule4': ['10 阶 · 4 次', 'Stage 10 · 4'],

  // ---- 风险预告行 ----
  'risk.dead': ['已报废', 'DEAD'],
  'risk.settled': ['已结算', 'SETTLED'],
  'risk.next': [
    '下一折：碎裂 {b}%　升阶 {u}%　白折 {f}%',
    'Next fold — break {b}% · up {u}% · flat {f}%',
  ],

  // ---- 稀有度 ----
  'rar.common': ['普通', 'Common'],
  'rar.rare': ['稀有', 'Rare'],
  'rar.epic': ['史诗', 'Epic'],
  'rar.legendary': ['传说', 'Legendary'],
  'rar.banner.rare': ['稀有词条', 'RARE DEFECT'],
  'rar.banner.epic': ['史诗词条', 'EPIC DEFECT'],
  'rar.banner.legendary': ['传说词条', 'LEGENDARY DEFECT'],

  // ---- 稀有度横幅之外的腰带 ----
  'band.acSwap': ['已换机 · 剩 {n} 次', 'Swapped · {n} left'],
  'band.acEmpty': ['已换机 · 延保用尽', 'Swapped · CARE+ spent'],
  'band.acUpgrade': ['延保升级 · {n} 次', 'CARE+ upgraded · {n} swaps'],

  // ---- 延保按钮 ----
  'ac.titleUp': [
    '本机最高到过 {best} 阶，延保可升级到 {target} 次',
    'Best stage on this device: {best}. CARE+ can reach {target} swaps',
  ],
  'ac.titleLeft': ['本局还能自动换机 {n} 次', 'Auto swaps left this run: {n}'],
  'ac.subUp': ['↑ 升 {n} 次', '↑ {n} swaps'],
  'ac.subLeft': ['续命 ×{n}', 'Save ×{n}'],

  // ---- 日志：折叠 / 报废 / 升阶 / 延保 ----
  'log.holdLock': [
    '长按锁定：按住不放就一直折，松手即停。',
    'Hold locked: keep pressing to keep folding, release to stop.',
  ],
  'log.autoStop': ['自动折叠已停。', 'Auto-fold stopped.'],
  'log.snap': ['咔嚓——', 'SNAP —'],
  'log.break': ['「{name}」，{n} 次折叠。', '"{name}", after {n} folds.'],
  'log.support': ['客服：属人为损坏。', 'Support: user damage.'],
  'log.stageUp': ['升阶！现在是「{name}」。', 'Stage up! Now "{name}".'],
  'log.stage4': ['屏幕开始偶发闪烁。有点意思了。', 'The screen starts flickering. Now it gets interesting.'],
  'log.stage5': [
    '折线处窜出一缕荧光绿。有人开始夸它好看了。',
    'A thread of neon green runs along the crease. Some call it beautiful.',
  ],
  'log.stage9': ['这已经不能叫手机了。', 'You can hardly call this a phone anymore.'],
  'log.acLeft': [
    '这台机器还能再保 {n} 次。下次再裂，就是 7998 元。',
    'This one has {n} swaps left. The next crack costs 7998.',
  ],
  'log.acSpent': [
    '这一次延保也用完了。下次再裂，就是 7998 元。',
    'That was the last CARE+ swap. The next crack costs 7998.',
  ],
  'log.guarded': ['硬扛下来了。铰链再也合不严。', 'It survived — with a hinge that never closes flush again.'],
  'log.acUpgrade': [
    '延保升级成功：这台机器最多能续命 {to} 次（原本 {from} 次）。',
    'CARE+ upgraded: up to {to} swaps on this device (was {from}).',
  ],
  'log.stop': ['你把手机收回盒子里。{n} 次折叠，到此为止。', 'Back in the box. {n} folds, and that is that.'],
  'log.newRun': ['又一台新机。官方说这次改进了铰链。', 'Another new phone. The maker says the hinge is improved.'],
  'log.holdHint': ['按住机身，向两侧掰。', 'Hold the body and bend it sideways.'],
  'log.firstRun': ['新机到手。15999 元，和 15999 个不舍得。', 'New phone in hand. 15999, and 15999 reasons to be careful.'],

  // ---- 动作文案（logic.js 返回）----
  'act.ac': [
    '屏幕窜出一道绿线——延保自动生效，直接换机。品阶不倒扣。',
    'A green line shoots across the screen — CARE+ takes over and swaps the phone. Stage is kept.',
  ],
  'act.fan': [
    '吹风机加热，磨砂层被撕下——屏幕秒变亮面，折痕无处可藏。保修标记灰了。',
    'Heat gun applied, the matte layer peels away — the screen goes glossy and the creases have nowhere to hide. Warranty badge goes grey.',
  ],
  'act.sand': [
    '一小撮沙子进了铰链。它能帮你硬扛一折，代价是永远合不严、而且每次开合都咔哒响。',
    'A pinch of sand goes into the hinge. It buys one save, at the price of never closing flush and clicking on every fold.',
  ],

  // ---- 成就页 ----
  'book.title': ['成就', 'Awards'],
  'book.progress': ['已解锁 {u} / {t}', 'Unlocked {u} / {t}'],
  'book.progressInit': ['已解锁 0 / 25', 'Unlocked 0 / 25'],
  'book.stat.stage': ['最高品阶', 'Best stage'],
  'book.stat.folds': ['最多折叠', 'Most folds'],
  'book.stat.runs': ['折坏台数', 'Phones wrecked'],
  'book.stat.legendary': ['传说词条', 'Legendary'],
  'book.locked': ['尚未解锁', 'Not unlocked'],
  'book.close': ['关闭', 'Close'],

  // ---- 成绩卡（弹层）----
  'card.alt': ['成就卡片', 'Result card'],
  'card.save': ['保存图片', 'Save image'],
  'card.again': ['再来一台', 'One more phone'],

  // ---- 成绩卡（画布上的检测报告）----
  'card.reportSub': ['设备折叠耐久性检测报告', 'DEVICE FOLD ENDURANCE INSPECTION'],
  'card.gradeLabel': ['综合评级', 'OVERALL GRADE'],
  'card.afterFolds': ['次折叠后送检', 'folds, then sent for inspection'],
  'card.th.item': ['检测项', 'ITEM'],
  'card.th.result': ['结果', 'RESULT'],
  'card.th.verdict': ['判定', 'VERDICT'],
  'card.row.crease': ['屏幕折痕', 'Screen crease'],
  'card.row.touch': ['触控功能', 'Touch input'],
  'card.row.hinge': ['铰链结构', 'Hinge'],
  'card.row.surface': ['屏幕表面', 'Screen surface'],
  'card.row.warranty': ['保修状态', 'Warranty'],
  'card.val.irreversible': ['深度不可逆', 'Irreversible'],
  'card.val.visible': ['可见', 'Visible'],
  'card.val.slight': ['轻微', 'Slight'],
  'card.val.intermittent': ['间歇失效', 'Intermittent'],
  'card.val.normal': ['正常', 'Normal'],
  'card.val.debris': ['异物侵入', 'Debris inside'],
  'card.val.loose': ['松动', 'Loose'],
  'card.val.coating': ['涂层脱落', 'Coating gone'],
  'card.val.intact': ['完好', 'Intact'],
  'card.val.careUsed': ['已使用延保', 'CARE+ used'],
  'card.val.careUnused': ['未使用', 'Unused'],
  'card.val.fail': ['异常', 'FAIL'],
  'card.val.pass': ['合格', 'PASS'],
  'card.scan': ['扫码 · 你也来折一台', 'SCAN · FOLD IT YOURSELF'],
  'card.defects': ['检出故障项 {n}', 'Defects found · {n}'],
  'card.stamp1': ['人为损坏', 'USER DAMAGE'],
  'card.stamp2': ['不予保修', 'WARRANTY VOID'],
  'card.stamp3': ['NOT COVERED', '· NO APPEAL ·'],

  // ---- 手机屏幕（3D 内屏）----
  'screen.date': ['10月23日 星期五', 'Friday, October 23'],
  'screen.widgetCalendar': ['日历', 'Calendar'],
  'screen.widgetWeather': ['天气', 'Weather'],

  // ---- 启动守卫里会被模块带出来的错误 ----
  'boot.webgl': ['这台设备拿不到 WebGL2 上下文：{e}', 'This device could not provide a WebGL2 context: {e}'],
};

// ---- 品阶名 ----
const STAGES = [
  ['全新未拆封', 'Factory Sealed'],
  ['初见折痕', 'First Crease'],
  ['折痕明显', 'Visibly Creased'],
  ['偶发闪屏', 'Occasional Flicker'],
  ['一缕绿线', 'A Thread of Green'],
  ['触控时灵', 'Touch Works, Sometimes'],
  ['久经沙场', 'Battle-Worn'],
  ['战损成色', 'Certified Wreck'],
  ['厂商拒保', 'Warranty Void'],
  ['传奇·一掰就碎', 'Legendary · Folds Apart'],
];
STAGES.forEach(([zh, en], i) => { DICT[`stage.${i + 1}`] = [zh, en]; });

// ---- 25 条故障词条：id → [名称, 说明] ----
const TRAIT_TEXT = {
  crease: [['折痕加深', '折线在侧光下越来越明显'], ['Crease Deepens', 'The fold line shows more and more under side light']],
  greenline: [['一缕绿线', '折线处泛出一条 1mm 的绿'], ['A Thread of Green', 'A 1 mm green line seeps out along the crease']],
  paint: [['边缘掉漆', '钛边框开始掉色'], ['Edge Chipping', 'The titanium frame starts flaking']],
  rattle: [['铰链异响', '每次开合都咔哒一声'], ['Hinge Rattle', 'A click every time it opens or closes']],
  warm: [['轻微发烫', '高负载下烫手'], ['Running Warm', 'Gets hot to the touch under load']],
  dust: [['铰链进灰', '口袋里的碎屑攒在铰链口'], ['Grit in the Hinge', 'Pocket lint piles up in the hinge gap']],
  chad: [['小 A 壳翘起', '内屏边框的防尘麦拉翘了起来'], ['Peeled Dust Film', 'The dust-proof mylar on the inner bezel has lifted']],
  loose: [['合不严实', '铰链卡了沙，合上留一道缝'], ['Won’t Close Flush', 'Sand in the hinge leaves a gap when closed']],
  touch: [['触控漂移', '触点会自己乱跑'], ['Touch Drift', 'The touch point wanders on its own']],
  deadpx: [['坏点扩散', '绿色坏点开始蔓延'], ['Dead Pixels Spreading', 'Green dead pixels are spreading']],
  flicker: [['偶发闪屏', '屏幕时不时抽一下'], ['Random Flicker', 'The screen twitches now and then']],
  leak: [['内屏漏液', '角落渗出黑斑，报价四位数'], ['Inner Panel Leak', 'A dark blotch creeps in from the corner; the quote is four digits']],
  peel: [['保护膜起翘', '原厂膜从边角开始卷'], ['Film Lifting', 'The factory film curls away from the corners']],
  bulge: [['异物顶包', '屏下有个东西，一按就顶出鼓包'], ['Foreign Body Bulge', 'Something under the glass bulges when pressed']],
  fullgreen: [['绿线贯通', '整条折线都在发绿'], ['Green Line Across', 'The entire crease has gone green']],
  halfdead: [['半屏失效', '右边那一半不太行了'], ['Half Screen Dead', 'The right half is giving up']],
  bubble: [['折线起泡', '膜下鼓起了气泡，通常几小时内脱层'], ['Crease Bubbling', 'Bubbles under the film; delamination usually follows within hours']],
  hingeloosen: [['铰链松动', '机身能自己晃'], ['Loose Hinge', 'The body wobbles on its own']],
  delam: [['整屏脱层', 'OLED 层和玻璃分家了'], ['Full Delamination', 'The OLED layer and the glass have separated']],
  mattegone: [['磨砂膜脱落', '纳米纹理被撕了，屏幕变亮面'], ['Matte Coating Gone', 'The nano-texture is torn off; the screen turns glossy']],
  selfheal: [['假性自愈', '裂纹看着淡了一点——别信'], ['Fake Self-Healing', 'The cracks look fainter — do not believe it']],
  officially: [['官方拒保', '你已被列入人为损坏名单'], ['Officially Void', 'You are now on the user-damage list']],
  unbroken: [['越折越紧', '这台的铰链反而更结实了'], ['Tighter Every Fold', 'This hinge actually got sturdier']],
  freephone: [['免费换新', '检测为非人为，直接换机'], ['Free Replacement', 'Ruled not user damage; swapped on the spot']],
  noreport: [['无检测报告', '判定人为，但拒绝出具报告'], ['No Report Issued', 'Ruled user damage, but no report will be issued']],
};
for (const [id, [zh, en]] of Object.entries(TRAIT_TEXT)) {
  DICT[`trait.${id}.name`] = [zh[0], en[0]];
  DICT[`trait.${id}.desc`] = [zh[1], en[1]];
}

// ---- 随机台词 ----
const QUOTES = {
  'q.broken.0': ['客服：属人为损坏。', 'Support: user damage.'],
  'q.broken.1': ['检测结论：非人为。但屏幕还是裂了。', 'Verdict: not user damage. The screen is still cracked.'],
  'q.broken.2': ['已为您安排更换新机。新机同样易碎。', 'A replacement has been arranged. It is just as fragile.'],
  'q.broken.3': ['我们对您的不便深表遗憾。（本条为全部赔偿）', 'We deeply regret the inconvenience. (This message is the entire compensation.)'],
  'q.late.0': ['它还能折。大概。', 'It still folds. Probably.'],
  'q.late.1': ['这不是手机，是一段经历。', 'It is not a phone anymore. It is an experience.'],
  'q.late.2': ['别问保修，问就是人为。', 'Do not ask about the warranty. The answer is user damage.'],
  'q.normal.0': ['你确实没用力。它确实碎了。（预告）', 'You really were gentle. It really broke. (Foreshadowing.)'],
  'q.normal.1': ['建议购买延保。', 'We recommend CARE+.'],
  'q.normal.2': ['折痕还在可接受范围内。今天。', 'The creases are still acceptable. Today.'],
  'q.normal.3': ['形态完好，心情复杂。', 'Structurally fine. Emotionally complicated.'],
  'q.flat.0': ['这一折……什么也没发生。但折痕更深了。', 'That fold went nowhere. The crease got deeper, though.'],
  'q.flat.1': ['咔哒。还是那样。', 'Click. Same as before.'],
  'q.flat.2': ['你怀疑自己是不是折反了。', 'You wonder whether you bent it the wrong way.'],
  'q.flat.3': ['屏幕的光比刚才暗了一点点。', 'The screen is a little dimmer than it was.'],
  'q.flat.4': ['没有升级。风险倒是涨了。', 'No upgrade. The risk went up, though.'],
};
Object.assign(DICT, QUOTES);

// ---- iOS 桌面 App 名 ----
const APP_NAMES = {
  camera: ['相机', 'Camera'],
  messages: ['信息', 'Messages'],
  music: ['音乐', 'Music'],
  maps: ['地图', 'Maps'],
  mail: ['邮件', 'Mail'],
  settings: ['设置', 'Settings'],
  calendar: ['日历', 'Calendar'],
  weather: ['天气', 'Weather'],
  clock: ['时钟', 'Clock'],
  notes: ['备忘录', 'Notes'],
  facetime: ['FaceTime', 'FaceTime'],
  robinhood: ['股票', 'Stocks'],
  wallet: ['钱包', 'Wallet'],
  files: ['文件', 'Files'],
  shazam: ['识曲', 'Shazam'],
  health: ['健康', 'Health'],
  photos: ['照片', 'Photos'],
  appstore: ['App Store', 'App Store'],
  google_translate: ['翻译', 'Translate'],
  calculator: ['计算器', 'Calculator'],
  safari: ['Safari', 'Safari'],
  phone: ['电话', 'Phone'],
  compass: ['指南针', 'Compass'],
  google_drive: ['云盘', 'Drive'],
};
for (const [id, [zh, en]] of Object.entries(APP_NAMES)) DICT[`app.${id}`] = [zh, en];

// ================= 语言判定 =================
function normalize(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s.startsWith('zh')) return 'zh';
  if (s.startsWith('en')) return 'en';
  return null;
}

function detect() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    const fromUrl = normalize(q);
    if (fromUrl) { try { localStorage.setItem(STORE_KEY, fromUrl); } catch (e) {} return fromUrl; }
  } catch (e) { /* 无 search 的环境忽略 */ }

  try {
    const saved = normalize(localStorage.getItem(STORE_KEY));
    if (saved) return saved;
  } catch (e) { /* 隐私模式 */ }

  // 浏览器语言：按偏好顺序找第一个支持的语言；都不认识就走英文
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const list = [].concat(nav.languages || [], nav.language || [], nav.userLanguage || []);
  for (const l of list) {
    const n = normalize(l);
    if (n) return n;
  }
  return 'en';
}

let lang = (typeof window !== 'undefined' && normalize(window.__duoLang)) || detect();

export function getLang() { return lang; }

const listeners = [];
/** 订阅语言变化（供界面重绘用；当前没有切换入口，保留给将来） */
export function onLangChange(fn) {
  if (typeof fn === 'function') listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function setLang(next) {
  const n = normalize(next);
  if (!n || n === lang) return lang;
  lang = n;
  try { localStorage.setItem(STORE_KEY, n); } catch (e) { /* 忽略 */ }
  applyStatic();
  listeners.forEach((fn) => { try { fn(lang); } catch (e) { /* 别让一个订阅拖垮全站 */ } });
  return lang;
}

// ================= 取词 =================
export function t(key, params) {
  const entry = DICT[key];
  if (!entry) return key;   // 少一条翻译不该让整页崩，直接把 key 显示出来好定位
  let s = entry[lang === 'en' ? 1 : 0] ?? entry[0] ?? key;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
  }
  return s;
}

/** 从一组 key 里随机取一条（台词用） */
export function pick(keys) {
  return t(keys[Math.floor(Math.random() * keys.length)]);
}

// ================= 静态文案刷新 =================
/**
 * 把 index.html 上打了标记的元素刷成本语言：
 *   data-i18n="key"               → textContent
 *   data-i18n-html="key"          → innerHTML（含 <b> 之类的模板）
 *   data-i18n-attr="attr:key,..." → 指定属性（aria-label / title 等）
 */
export function applyStatic(root) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;
  const scope = root || doc;

  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr').split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s && s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });

  const html = doc.documentElement;
  html.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
  html.setAttribute('data-lang', lang);
  doc.title = t('meta.title');
  // 静态文案就位后再把界面放出来（见 style.css 的 html.i18n-wait）
  html.classList.remove('i18n-wait');
}

// 模块一加载就刷一遍：此刻 index.html 的 DOM 已经解析完（module 是 defer 的）
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyStatic(), { once: true });
  } else {
    applyStatic();
  }
}
