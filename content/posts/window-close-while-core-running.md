---
title: 标题栏点了关闭，联机核心应该先停在哪里
description: 拆解 Avalonia 的同步 Closing、异步选择窗口和共享的核心清理任务。
category: Minecraft 联机
date: 2026-10-17
published: 2026-10-17T14:02:19+08:00
tags: MCT, C#, Avalonia, 进程
---

MCT 有窗口、后台联机核心，还有一个全局停止按钮。只要核心在跑，点击关闭就可能是两个不同的意思。用户想退出，或者只想把窗口收起来。这里真正麻烦的是 `Closing` 要同步给出结果，选择和核心清理却都需要等待。

## 先取消当前关闭，再开始等待

`OnWindowClosing` 遇到活跃核心会立即设置 `e.Cancel = true`，再启动 `HandleCloseRequestAsync()`。如果直接在事件里先 `await` 弹窗，到了恢复执行时窗口可能已经关了。`_closeRequestPending` 从开始等待一直保留到 `finally`，连点关闭时第二个事件只负责取消，不再开一份弹窗。

用户选了退出，处理函数先等待 `StopCoresForExitAsync()`，再设 `_allowClose = true` 并重新调用 `Close()`。第二次触发 `Closing` 时凭这面标记走最终关闭。取消对话框会从处理函数返回，`finally` 释放 pending 状态，下次仍能点关闭。选缩进托盘只收窗口并保留核心。没有可用托盘的情况会降为窗口最小化。

## 两个按钮可能等的是同一件事

全局停止按钮和退出处理会用 `StopCoresForExitAsync()` 拿到 `_stopAllCoresTask`。如果已有未完成的清理就复用它。比如点了停止核心，随后马上点退出，第二个入口可以等第一次清理，避免两边都找进程并尝试结束。

排这条路径时，我会让清理先挂住，再连续点两次关闭。此时窗口仍在，也只能有一次清理。把清理改成失败，预期窗口恢复可操作并给出错误；再点一次应该创建新的清理任务。最后测进入托盘再恢复，确认界面恢复后仍能看到实际运行的联机核心。仅检查窗口是否消失，分不清这是符合预期的后台联机，还是意外丢失了窗口。

[对应提交 · MCZLF/MinecraftConnectTool `55e5db1`](https://github.com/MCZLF/MinecraftConnectTool/commit/55e5db120b186ca22eb396c34bf28f9b72da936f)
