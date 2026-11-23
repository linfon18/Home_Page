---
title: 日志窗口已经限长了，为什么 MCT 还是能卡死
description: 从字符串快照和 Dispatcher 队列拆开算，复现为什么只限制显示行数仍能积压大量日志。
category: Minecraft 联机
date: 2026-08-30
published: 2026-08-30T13:25:13+08:00
tags: MCT, C#, Avalonia, 日志
---

调联机核心时，最难看的日志往往也是刷得最快的。MCT 三种模式都有输出窗口。以前这里把新内容拼到一条长字符串里，超过长度再裁。假设只显示最近一阵的输出，看着好像有内存上限。翻到 `b83e3acd` 的改动才容易看出背后还有另一条队列，就是后台回调投给 UI 线程的工作。

## 两个上限分别限制什么

改动给 P2P、Link 和 EasyTier 都设了 `MaxLogEntries = 1_000` 与 `MaxUiLogEntryLength = 4_000`。先缩单条，再入队，满了从头丢。这里的 4,000 是 .NET 字符串长度使用的 UTF-16 码元，大量 emoji 或其他补充平面字符不能按“4,000 个字”解释。粗算一下，1,000 条各占 4,000 码元，单看字符数据就可能接近 8 MB。队列中的字符串、合并后的字符串和控件内部缓存还各有开销。这个上限只约束预览，不适合拿来估算整个程序的工作集。

另一个变化是 `_uiLogUpdateQueued`。后台收到一条后持锁入队。只有从“没有刷新任务”变成“有刷新任务”的那条消息安排一次更新。如果已经在 UI 线程，就直接 `FlushUiLog()`。走后台入口才调用 `Dispatcher.UIThread.Post()`。刷新回调持锁清标记再组装最新文本，之后再到来的消息可以安排下一次刷新。

## 我用两个数字对这段逻辑

下面把“UI 忙到暂时不处理消息”单独拿出来。它模拟的是投递次数和预览保留量，跟 Avalonia 在某台机器上的渲染耗时是两回事。用 Python 3 直接跑。

```python
from collections import deque

def burst(count, coalesce):
    tail = deque(maxlen=1_000)
    posted = 0
    flush_pending = False
    for i in range(count):
        tail.append(i)
        if not coalesce or not flush_pending:
            posted += 1
            flush_pending = True
    return posted, len(tail), tail[0], tail[-1]

print(burst(50_000, False))
print(burst(50_000, True))
```

第一行是 `(50000, 1000, 49000, 49999)`，第二行是 `(1, 1000, 49000, 49999)`。两种情况下都只保留最后 1,000 条。如果给每条投递都提前截下一份窗口字符串，调度队列里还会留住一串历史快照。这个模型只数了回调，没把那些字符串算进去。

## 这次改完仍要看什么

合并刷新还有一次全量拼接。如果生产者本来就在 UI 线程，每条都立即刷新，前面的 50,000 对 1 就不适用。真要看刷屏负载，我会分别记录后台产生条数、UI 回调条数、回调里的合并耗时和截断次数。磁盘仍保留的日志和窗口为了显示而裁掉的日志也应分开看，免得排查时拿预览当完整记录。

[对应提交 · MCZLF/MinecraftConnectTool `b83e3acd`](https://github.com/MCZLF/MinecraftConnectTool/commit/b83e3acd74ea7f89be002d5df30dfe794bf80869)
