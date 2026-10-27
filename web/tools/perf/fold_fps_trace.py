import json, sys
from collections import defaultdict

path = sys.argv[1] if len(sys.argv) > 1 else 'D:/tmp/duo-perf/trace-mobiletrace.json'
d = json.load(open(path, encoding='utf-8'))
ev = d['traceEvents']
print('events', len(ev))

# 找渲染进程主线程
thread_names = {}
for e in ev:
    if e.get('ph') == 'M' and e.get('name') == 'thread_name':
        thread_names[(e['pid'], e['tid'])] = e['args']['name']
main = [k for k, v in thread_names.items() if v == 'CrRendererMain']
print('CrRendererMain:', main)
if not main:
    sys.exit('no main thread')
mpid, mtid = main[0]

X = [e for e in ev if e.get('ph') == 'X' and e.get('pid') == mpid and e.get('tid') == mtid]
print('complete events on main thread:', len(X))

t0 = min(e['ts'] for e in X)
for e in X:
    e['t'] = (e['ts'] - t0) / 1e6
    e['d'] = e.get('dur', 0) / 1000.0          # ms

agg = defaultdict(lambda: {'n': 0, 'tot': 0.0, 'max': 0.0})
for e in X:
    a = agg[e['name']]
    a['n'] += 1
    a['tot'] += e['d']
    a['max'] = max(a['max'], e['d'])

span = max(e['t'] for e in X)
run_tasks = sum(e['d'] for e in X if e['name'] in ('RunTask', 'ThreadControllerImpl::RunTask', 'ThreadControllerImpl::RunTask'))
print(f'span {span:.1f}s   main-thread busy(sum RunTask) {run_tasks:.0f}ms  = {100*run_tasks/(span*1000):.0f}%')
print('-' * 96)
print(f"{'name':44s} {'count':>7s} {'total ms':>10s} {'avg ms':>8s} {'max ms':>8s} {'%busy':>7s}")
for name, a in sorted(agg.items(), key=lambda kv: -kv[1]['tot'])[:28]:
    print(f"{name[:44]:44s} {a['n']:7d} {a['tot']:10.1f} {a['tot']/a['n']:8.2f} {a['max']:8.1f} "
          f"{100*a['tot']/max(run_tasks,1):6.1f}%")

GROUPS = {
    'JS 执行 (v8 / FunctionCall / Timer / EventDispatch)': ('v8', 'FunctionCall', 'TimerFire', 'EventDispatch',
        'EvaluateScript', 'FireAnimationFrame', 'RunMicrotasks', 'v8.compile', 'CompileScript', 'MinorGC', 'MajorGC', 'V8.GC'),
    '样式/布局 (UpdateLayoutTree / Layout / PrePaint)': ('UpdateLayoutTree', 'Layout', 'PrePaint', 'StyleRecalcInvalidationTracking',
        'ScheduleStyleRecalculation', 'InvalidateLayout'),
    '绘制/合成 (Paint / Layerize / Commit / Rasterize)': ('Paint', 'Layerize', 'Commit', 'Rasterize', 'CompositeLayers',
        'CompositeLayers', 'ImageDecodeTask', 'Decode Image', 'PaintImage'),
    'WebGL / GPU': ('GPUTask', 'Canvas2DLayerBridge', 'WebGL', 'DrawFrame', 'CopyTexture'),
}
tot_all = sum(a['tot'] for a in agg.values())
print('-' * 96)
for g, keys in GROUPS.items():
    s = sum(a['tot'] for n, a in agg.items() if any(k.lower() in n.lower() for k in keys))
    print(f"{g:52s} {s:9.0f} ms  {100*s/max(tot_all,1):5.1f}% of traced main-thread work")

print('-' * 96)
print('最长的 18 个主线程事件：')
for e in sorted(X, key=lambda x: -x['d'])[:18]:
    print(f"  {e['d']:8.1f}ms @ {e['t']:7.2f}s  {e['name']}"
          + ('  ' + str(e.get('args', {}).get('data', {}).get('functionName', '')) if e['name'] == 'FunctionCall' else '')
          + ('  ' + str(e.get('args', {}).get('beginData', {}).get('url', ''))[:60] if e['name'] == 'FunctionCall' else ''))

print('-' * 96)
print('FunctionCall 按耗时 top12（含 url:line）：')
fc = defaultdict(float)
for e in X:
    if e['name'] == 'FunctionCall':
        dd = e.get('args', {}).get('data', {}) or {}
        k = f"{dd.get('functionName') or '(anon)'}  {str(dd.get('url', '')).split('/')[-1]}:{dd.get('lineNumber', '')}"
        fc[k] += e['d']
for k, v in sorted(fc.items(), key=lambda kv: -kv[1])[:12]:
    print(f"  {v:8.1f}ms  {k}")

print('-' * 96)
print('事件调度 (EventDispatch) 按 type top10：')
ed = defaultdict(lambda: [0, 0.0, 0.0])
for e in X:
    if e['name'] == 'EventDispatch':
        ty = (e.get('args', {}).get('data', {}) or {}).get('type', '?')
        ed[ty][0] += 1
        ed[ty][1] += e['d']
        ed[ty][2] = max(ed[ty][2], e['d'])
for ty, (n, tot, mx) in sorted(ed.items(), key=lambda kv: -kv[1][1])[:10]:
    print(f"  {ty:22s} n={n:5d} total={tot:8.1f}ms avg={tot/n:6.2f}ms max={mx:7.1f}ms")
