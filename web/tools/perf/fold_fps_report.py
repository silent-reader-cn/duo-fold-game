import json, sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

plt.rcParams['font.family'] = ['Microsoft YaHei', 'Segoe UI', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

OUTDIR = 'D:/projects/duo-fold-game/.preview'
INK, DIM, BG, PANEL = '#eef2f9', '#8b93a3', '#0b0f16', '#141c27'
ACC, WARN, BAD, OK, VIO = '#4aa3ff', '#ffb020', '#ff4d5e', '#22d39a', '#b76bff'


def load(name):
    return json.load(open(f'D:/tmp/duo-perf/{name}', encoding='utf-8'))


def intervals(buf):
    f = np.array(buf['frames'], dtype=float)
    return (f[1:] - f[0]) / 1000.0, np.diff(f)


def pooled(d):
    iv = np.concatenate([intervals(r['buf'])[1] for r in d['runs']])
    med = float(np.median(iv))
    return dict(fps=1000 / float(np.mean(iv)), iv=iv, med=med,
                p95=float(np.percentile(iv, 95)), p99=float(np.percentile(iv, 99)),
                jank=100 * float(np.mean(iv > med * 1.5)),
                over33=100 * float(np.mean(iv > 33.4)), max=float(iv.max()))


def a(key, buf):
    return np.array(buf.get(key, []) or [], dtype=float)


d = load('raw-mobile.json')
idle_iv = intervals(d['idle']['buf'])[1]
REFRESH = 1000 / float(np.median(idle_iv))

print('=' * 92)
print(f"环境  {d['viewport']['W']}x{d['viewport']['H']} @DPR{d['viewport']['DPR']}   GPU: {d['env']['gpu']}")
print(f"      绘制调用 {d['env']['calls']} / 三角形 {d['env']['triangles']}  WebGL2={d['env']['webgl2']}  "
      f"刷新上限 {REFRESH:.0f}Hz   目标节奏 {d['rate']} 折/秒（手动指针路径）")
print('=' * 92)
pi = pooled({'runs': [{'buf': d['idle']['buf']}]})
print(f"静止基线(3s): mean {pi['fps']:.0f}fps  frame p50 {pi['med']:.2f}ms  p99 {pi['p99']:.2f}ms")

all_iv = []
rows = []
for r in d['runs']:
    t, iv = intervals(r['buf'])
    all_iv.append(iv)
    med = float(np.median(iv))
    s = dict(fps=1000 / float(np.mean(iv)), med=med,
             p95=float(np.percentile(iv, 95)), p99=float(np.percentile(iv, 99)),
             jank=100 * float(np.mean(iv > med * 1.5)), over33=100 * float(np.mean(iv > 33.4)))
    rows.append((r, t, iv, s))
    scr, rnd, bnd = a('screen', r['buf']), a('render', r['buf']), a('bend', r['buf'])
    lt = r['buf'].get('longtasks') or []
    card = a('card', r['buf'])
    dur = r['durationMs'] / 1000
    print('-' * 92)
    print(f"第{r['run']}局 {r['foldsSent']}折 / {dur:.1f}s ({r['foldsSent']/dur:.2f}折/秒) → "
          f"断@{r['brokeAt']/1000:.1f}s 结算@{r['settleMs']/1000:.1f}s  阶段{r['state']['stage']} "
          f"词条{len(r['state']['traits'])}")
    print(f"  FPS   mean {s['fps']:.1f} | 帧间隔 p50 {s['med']:.2f} p95 {s['p95']:.1f} p99 {s['p99']:.1f} max {iv.max():.0f}ms")
    print(f"  掉帧  jank(>1.5x中位) {s['jank']:.1f}%   >20ms {100*np.mean(iv>20):.1f}%   >33ms {s['over33']:.1f}%")
    print(f"  每折主线程: updateScreen p50 {np.median(scr):.2f} p95 {np.percentile(scr,95):.2f} max {scr.max():.1f}ms "
          f"(x{len(scr)}) | render p50 {np.median(rnd):.2f} | setBend p50 {np.median(bnd):.2f}")
    print(f"  结算卡 makeCard+toDataURL {card[0]:.0f}ms | 长任务 {len(lt)} 个: "
          + ', '.join(f"{x['d']:.0f}ms@{(x['s']-r['buf']['t0'])/1000:.1f}s" for x in sorted(lt, key=lambda z: -z['d'])[:4]))
    m = r['metrics']
    print(f"  主线程/{dur:.0f}s: 任务 {100*m.get('TaskDuration',0)/dur:.0f}%  "
          f"脚本 {m.get('ScriptDuration',0):.2f}s  样式 {1000*m.get('RecalcStyleDuration',0):.0f}ms/"
          f"{m.get('RecalcStyleCount',0):.0f}次  布局 {1000*m.get('LayoutDuration',0):.0f}ms/{m.get('LayoutCount',0):.0f}次")
    marks = [(x['t'] - r['buf']['t0']) / 1000 for x in r['buf']['marks'] if x['k'] == 'fold:start']
    if len(marks) > 2:
        gaps = np.diff(marks)
        print(f"  折叠节拍: 间隔 p50 {np.median(gaps)*1000:.0f}ms  min {gaps.min()*1000:.0f}ms")

pooled_iv = np.concatenate(all_iv)
pm = float(np.median(pooled_iv))
print('=' * 92)
print(f"合计(3局): mean {1000/np.mean(pooled_iv):.1f}fps | p50 {1000/pm:.0f}fps | "
      f"p95帧间隔 {np.percentile(pooled_iv,95):.1f}ms | p99 {np.percentile(pooled_iv,99):.1f}ms | "
      f"jank {100*np.mean(pooled_iv>pm*1.5):.1f}% | >33ms {100*np.mean(pooled_iv>33.4):.1f}%")

# ============ 图1 ============
n = len(rows)
fig, axes = plt.subplots(n, 2, figsize=(16, 3.25 * n + 1.5), facecolor=BG,
                         gridspec_kw={'width_ratios': [3.3, 1]})
fig.suptitle(f'Duo-Fold Web · 手动折叠 2 次/秒 → 结算：帧率时间线   '
             f'(390×844 @DPR2, Intel Arc iGPU, 刷新上限 {REFRESH:.0f}Hz)',
             color=INK, fontsize=14, y=0.982)

for i, (r, t, iv, s) in enumerate(rows):
    fps = 1000 / iv
    ax = axes[i][0]
    ax.set_facecolor(PANEL)
    k = max(3, int(len(fps) / max(t[-1], 1) * 0.4))
    smooth = np.convolve(fps, np.ones(k) / k, mode='same')
    ax.fill_between(t, 0, fps, color=ACC, alpha=0.12, lw=0)
    ax.plot(t, fps, color=ACC, lw=0.5, alpha=0.42)
    ax.plot(t, smooth, color='#a8d4ff', lw=1.7)
    ax.axhline(REFRESH, color=DIM, ls=':', lw=1)
    ax.axhline(60, color=OK, ls='--', lw=1, alpha=0.8)
    ax.axhline(30, color=WARN, ls='--', lw=1, alpha=0.8)
    ax.text(0.4, REFRESH * 1.03, f'{REFRESH:.0f}Hz 上限', color=DIM, fontsize=8)
    ax.text(0.4, 62, '60', color=OK, fontsize=8)
    ax.text(0.4, 32, '30', color=WARN, fontsize=8)
    for mt in [(x['t'] - r['buf']['t0']) / 1000 for x in r['buf']['marks'] if x['k'] == 'fold:start']:
        ax.axvline(mt, color='#5b6a80', lw=0.5, alpha=0.35)
    for x in (r['buf'].get('longtasks') or []):
        st = (x['s'] - r['buf']['t0']) / 1000
        ax.add_patch(plt.Rectangle((st, 0), max(x['d'] / 1000, 0.12), REFRESH * 1.12,
                                   color=BAD, alpha=0.18, lw=0))
    brk = r['brokeAt'] / 1000
    ax.axvline(brk, color=VIO, lw=1.6)
    ax.annotate('碎裂', (brk, REFRESH * 0.38), color=VIO, fontsize=8.5, ha='right',
                xytext=(-4, 0), textcoords='offset points', fontweight='bold')
    st = t[-1]
    ax.axvline(st, color=WARN, lw=1.6)
    ax.annotate('结算卡', (st, REFRESH * 0.62), color=WARN, fontsize=8.5, ha='right',
                xytext=(-4, 0), textcoords='offset points', fontweight='bold')
    ax.set_ylim(0, REFRESH * 1.14)
    ax.set_xlim(0, st * 1.01)
    ax.grid(alpha=0.1, lw=0.6)
    ax.set_ylabel('FPS', color=DIM, fontsize=9)
    ax.tick_params(colors=DIM, labelsize=8)
    for sp in ax.spines.values():
        sp.set_color('#22303f')
    ax.set_title(f"第{i+1}局 · {r['foldsSent']}折/{r['durationMs']/1000:.0f}s · 均值 {s['fps']:.0f}fps · "
                 f"p1 {1000/np.percentile(iv,99):.0f}fps · jank {s['jank']:.0f}% · >33ms {s['over33']:.0f}%"
                 + ('   (灰竖线=每折, 红底=主线程长任务)' if i == 0 else ''),
                 color=INK, fontsize=10, loc='left')
    if i == n - 1:
        ax.set_xlabel('秒（自本局第一折起）', color=DIM, fontsize=9)

    ax2 = axes[i][1]
    ax2.set_facecolor(PANEL)
    ax2.hist(np.clip(iv, 0, 120), bins=np.arange(0, 122, 2), color=ACC, alpha=0.8, lw=0)
    ax2.axvline(1000 / REFRESH, color=DIM, ls=':', lw=1)
    ax2.axvline(16.7, color=OK, ls='--', lw=1)
    ax2.axvline(33.4, color=WARN, ls='--', lw=1)
    ax2.set_yscale('log')
    ax2.grid(alpha=0.1, lw=0.6)
    ax2.tick_params(colors=DIM, labelsize=8)
    for sp in ax2.spines.values():
        sp.set_color('#22303f')
    ax2.set_title(f"帧间隔分布  p95 {s['p95']:.0f}ms · p99 {s['p99']:.0f}ms",
                  color=INK, fontsize=9, loc='left')
    if i == n - 1:
        ax2.set_xlabel('帧间隔 (ms)  虚线 9.8 / 16.7 / 33.4', color=DIM, fontsize=8)

fig.tight_layout(rect=[0, 0, 1, 0.962])
p1 = f'{OUTDIR}/perf-mobile-fps.png'
fig.savefig(p1, dpi=130, facecolor=BG)
print('FIG', p1)

# ============ 图2 ============
CFG = [('基线', 'raw-mobile.json', ACC),
       ('A', 'raw-noexcite.json', '#7aa7d8'),
       ('B', 'raw-dpr1.json', '#7aa7d8'),
       ('C', 'raw-noscreen.json', OK),
       ('D', 'raw-noscene.json', VIO),
       ('桌面', 'raw-desktop.json', '#9aa0a8')]
stats = [(name, pooled(load(f)), c) for name, f, c in CFG]

fig2 = plt.figure(figsize=(16, 8.6), facecolor=BG)
gs = fig2.add_gridspec(2, 3, hspace=0.45, wspace=0.28)
fig2.suptitle('Duo-Fold Web · 前端性能归因（同一视口、同一手动折叠节奏，逐项 A/B 开关）',
              color=INK, fontsize=14, y=0.965)

ax = fig2.add_subplot(gs[0, 0]); ax.set_facecolor(PANEL)
xs = np.arange(len(stats))
bars = ax.bar(xs, [s[1]['fps'] for s in stats], 0.62, color=[s[2] for s in stats])
for b, s in zip(bars, stats):
    ax.text(b.get_x() + b.get_width() / 2, s[1]['fps'] + 1.5, f"{s[1]['fps']:.0f}",
            color=INK, fontsize=10, ha='center', fontweight='bold')
ax.axhline(REFRESH, color=DIM, ls=':', lw=1)
ax.axhline(60, color=OK, ls='--', lw=1)
ax.text(-0.45, REFRESH + 2.5, f'静止上限 {REFRESH:.0f}fps', color=DIM, fontsize=8, ha='left')
ax.set_xticks(xs); ax.set_xticklabels([s[0] for s in stats], color=DIM, fontsize=8.5)
ax.set_ylim(0, REFRESH * 1.2)
ax.set_ylabel('折叠期间平均 FPS', color=DIM, fontsize=9)
ax.set_title('平均帧率', color=INK, fontsize=11, loc='left')
ax.text(-0.45, -14, 'A 不写 --excite · B pixelRatio 2→1 · C 关屏幕纹理刷新 · D 关整个 3D 场景',
        color=DIM, fontsize=8, ha='left')
ax.grid(alpha=0.1, axis='y', lw=0.6); ax.tick_params(colors=DIM, labelsize=8)
for sp in ax.spines.values(): sp.set_color('#22303f')

ax = fig2.add_subplot(gs[0, 1]); ax.set_facecolor(PANEL)
ax.bar(xs - 0.19, [s[1]['jank'] for s in stats], 0.36, color=[s[2] for s in stats], label='jank > 1.5×中位帧')
ax.bar(xs + 0.19, [s[1]['over33'] for s in stats], 0.36, color='#5c6a7d', label='帧 > 33ms')
ax.set_xticks(xs); ax.set_xticklabels([s[0] for s in stats], color=DIM, fontsize=8)
ax.set_ylabel('掉帧占比 (%)', color=DIM, fontsize=9)
ax.set_title('掉帧比例（越低越好）', color=INK, fontsize=11, loc='left')
ax.legend(facecolor=PANEL, edgecolor='#22303f', labelcolor=INK, fontsize=8)
ax.grid(alpha=0.1, axis='y', lw=0.6); ax.tick_params(colors=DIM, labelsize=8)
for sp in ax.spines.values(): sp.set_color('#22303f')

ax = fig2.add_subplot(gs[0, 2]); ax.set_facecolor(PANEL)
ax.bar(xs, [s[1]['p95'] for s in stats], 0.62, color=[s[2] for s in stats])
for i, s in enumerate(stats):
    ax.text(i, s[1]['p95'] + 0.8, f"{s[1]['p95']:.0f}", color=INK, fontsize=9, ha='center')
ax.axhline(16.7, color=OK, ls='--', lw=1)
ax.axhline(33.4, color=WARN, ls='--', lw=1)
ax.text(len(stats) - 0.5, 17.5, '16.7ms', color=OK, fontsize=8, ha='right')
ax.text(len(stats) - 0.5, 34.2, '33.4ms', color=WARN, fontsize=8, ha='right')
ax.set_xticks(xs); ax.set_xticklabels([s[0] for s in stats], color=DIM, fontsize=8)
ax.set_ylabel('p95 帧间隔 (ms)', color=DIM, fontsize=9)
ax.set_title('95 分位帧间隔（尾延迟）', color=INK, fontsize=11, loc='left')
ax.grid(alpha=0.1, axis='y', lw=0.6); ax.tick_params(colors=DIM, labelsize=8)
for sp in ax.spines.values(): sp.set_color('#22303f')

ax = fig2.add_subplot(gs[1, 0]); ax.set_facecolor(PANEL)
scr = np.concatenate([a('screen', r['buf']) for r in d['runs']])
rnd = np.concatenate([a('render', r['buf']) for r in d['runs']])
bnd = np.concatenate([a('bend', r['buf']) for r in d['runs']])
sch = np.concatenate([a('card', r['buf']) for r in d['runs']])
names = ['屏幕画布\n整幅重绘', 'renderer\n.render()', 'setBend\n几何重算', '结算卡\n生成+编码']
vals = [np.median(scr), np.median(rnd), np.median(bnd), np.median(sch)]
mx = [np.percentile(scr, 95), np.percentile(rnd, 95), np.percentile(bnd, 95), np.percentile(sch, 95)]
cols = [BAD, ACC, '#7aa7d8', WARN]
ax.barh(names, vals, 0.55, color=cols)
ax.barh(names, np.array(mx) - np.array(vals), 0.55, left=vals, color=cols, alpha=0.35)
for i, v in enumerate(mx):
    ax.text(max(v, vals[i]) * 1.08, i, f"{vals[i]:.2f} → {mx[i]:.1f} ms", color=INK, fontsize=9, va='center')
ax.set_xscale('log'); ax.set_xlim(0.02, 3000)
ax.set_xlabel('单次调用耗时 ms（log）', color=DIM, fontsize=9)
ax.set_title('主线程单项开销：一次折叠 / 一次结算', color=INK, fontsize=11, loc='left')
ax.grid(alpha=0.1, axis='x', lw=0.6); ax.tick_params(colors=DIM, labelsize=8)
for sp in ax.spines.values(): sp.set_color('#22303f')

ax = fig2.add_subplot(gs[1, 1]); ax.set_facecolor(PANEL)
durs = np.array([r['durationMs'] / 1000 for r in d['runs']])
agg = {}
for key, lab in [('ScriptDuration', '脚本'), ('RecalcStyleDuration', '样式重算'),
                 ('LayoutDuration', '布局'), ('TaskOtherDuration', '其他主线程任务')]:
    agg[lab] = sum(r['metrics'].get(key, 0) for r in d['runs'])
total = max(sum(agg.values()), 1e-6)
bottom = np.zeros(1)
for (lab, v), c in zip(agg.items(), [ACC, VIO, WARN, '#5c6a7d']):
    ax.bar([0], [v], 0.5, bottom=bottom, color=c, label=f'{lab} {100*v/total:.0f}%')
    bottom += v
ax.bar([1], [durs.sum()], 0.5, color='#33404f')
ax.text(0, total * 1.02, f'{total:.1f}s', color=INK, fontsize=9, ha='center')
ax.text(1, durs.sum() * 1.02, f'{durs.sum():.1f}s', color=INK, fontsize=9, ha='center')
ax.set_ylim(0, durs.sum() * 1.12)
ax.set_xticks([0, 1]); ax.set_xticklabels(['主线程实际占用', '整局总时长'], color=DIM, fontsize=9)
ax.set_ylabel('秒（3 局累计）', color=DIM, fontsize=9)
ax.set_title('主线程时间去向（Performance.getMetrics）', color=INK, fontsize=11, loc='left')
ax.legend(facecolor=PANEL, edgecolor='#22303f', labelcolor=INK, fontsize=8)
ax.grid(alpha=0.1, axis='y', lw=0.6); ax.tick_params(colors=DIM, labelsize=8)
for sp in ax.spines.values(): sp.set_color('#22303f')

ax = fig2.add_subplot(gs[1, 2]); ax.set_facecolor(PANEL)
tb = []
ip = []
for r, t, iv, s in rows:
    off = len(tb)
    tb += list(t)
    ip += list(iv)
tb = np.array(tb); ip = np.array(ip)
marks_all = np.sort(np.array([(x['t'] - r['buf']['t0']) / 1000 for r in d['runs']
                              for x in r['buf']['marks'] if x['k'] == 'fold:start']))
phase = np.array([np.min(np.abs(marks_all - x)) for x in tb])
bins = np.arange(0, 0.65, 0.05)
slowsel = ip > 30
ax.hist(phase[~slowsel], bins=bins, color='#2c3a4b', label='正常帧 (<30ms)', density=True)
ax.hist(phase[slowsel], bins=bins, color=BAD, alpha=0.75, label='掉帧 (>30ms)', density=True)
ax.set_xlabel('与本折按下时刻的间隔 (s)', color=DIM, fontsize=9)
ax.set_ylabel('归一化密度', color=DIM, fontsize=9)
ax.set_title(f'掉帧相对折叠动作的时序（掉帧占 {100*slowsel.mean():.0f}%）', color=INK, fontsize=11, loc='left')
ax.legend(facecolor=PANEL, edgecolor='#22303f', labelcolor=INK, fontsize=8)
ax.grid(alpha=0.1, lw=0.6); ax.tick_params(colors=DIM, labelsize=8)
for sp in ax.spines.values(): sp.set_color('#22303f')

p2 = f'{OUTDIR}/perf-mobile-attribution.png'
fig2.savefig(p2, dpi=130, facecolor=BG)
print('FIG', p2)
