---
title: 核心已经全停了，房间管理按钮怎么还在
description: 页面缓存让旧 ViewModel 活得比进程久，停核心时也要收好三个页面的界面状态。
category: Minecraft 联机
date: 2026-10-20
published: 2026-10-20T12:27:56+08:00
tags: MCT, Avalonia, 状态管理
---

MCT 的 P2P、Link、EasyTier 页面可以来回切。切走的页进了缓存，下次再点进去还能接着用。反过来，核心全停了，缓存里的 ViewModel 也不会自己知道该把房间管理入口藏起来。

这个提交在全停流程里调用 `ResetStoppedCorePageStates()`。查每个页面时先看当前页，再从页面缓存取。P2P 将 `IsPlayerListConnected` 设为 `false`，Link 调用自己的 `ResetStoppedState()`，EasyTier 将 `IsETRunningForPanel` 设为 `false`。没有创建过的页面可以跳过，没必要为了关按钮临时造一个页面。

容易漏测的路径是从 P2P 切去设置，再停掉全部核心，最后回到 P2P。只盯着触发停止动作的当前页，看不到被缓存的旧值。按钮还亮着时我会先区分两件事：核心进程是不是真的还在，以及这个入口到底绑定了哪个对象的哪个字段。

[对应提交 · MCZLF/MinecraftConnectTool `9fd0b08`](https://github.com/MCZLF/MinecraftConnectTool/commit/9fd0b08533c07fc1b28c3ffb7aee5a632c2602d6)
