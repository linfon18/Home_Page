---
title: 启动核心抛异常时，先把开始按钮还回来
description: 记下一条 EasyTier 启动失败路径，分别核对 UI、全局运行状态和外部进程。
category: Minecraft 联机
date: 2026-09-09
published: 2026-09-09T20:14:57+08:00
tags: MCT, C#, Avalonia, 状态机
---

`OpenRoom` 点下去后先更新运行状态，再调用 `StartHostAsync`。若服务返回 `false`，原来就有一条回退路径。若服务直接抛异常，`await` 之后的回退根本进不去。界面看起来像核心正在跑，再点一次也没入口。

这次把异常记进日志，并让它和 `false` 走同一条回退分支。分支恢复开始与停止按钮，关掉进度，设置错误徽章，并把 `P2PStateService` 里的运行状态重置。`JoinRoom` 也这样处理。回归可以用两个替身，一份直接返回 `false`，一份等到 UI 已经显示启动中再抛。两次都检查按钮状态和全局状态，接着尝试再开一次房。

如果核心本来已经起了一半，还得看服务能否回收进程和转发规则。UI 回到空闲只说明用户可以重试。旧进程仍在时，下一次也可能因为端口被占而失败。

[对应提交 · MCZLF/MinecraftConnectTool `e2ca7cc`](https://github.com/MCZLF/MinecraftConnectTool/commit/e2ca7cc8d63d78e0d87c50940eb6def6e8217ec3)
