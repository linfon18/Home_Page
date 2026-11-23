---
title: 关闭 MCT 核心时，叫 link 的进程不一定是我的
description: 记录用可执行文件路径缩小清理范围的实现，以及目录分隔符和大小写的边界。
category: Minecraft 联机
date: 2026-10-17
published: 2026-10-17T14:02:19+08:00
tags: MCT, C#, 进程
---

一键停所有核心时，同一个名字能找到多个进程。一台机器上同时开了两份工具，找到 `link` 就结束，很容易把另一份也带走。MCT 的 `CoreProcessOwnership.IsManaged` 给这个入口加了第二层判断，从 `MainModule.FileName` 取可执行文件路径，并核对它是否位于当前数据根目录下。

比较前先对根路径和进程路径做 `Path.GetFullPath`。根的尾巴统一成一个目录分隔符。假设根叫 `C:\MCT\Data`，字符串 `C:\MCT\Database\link.exe` 同样以 `C:\MCT\Data` 开头，接上反斜杠以后才分得开。Windows 用 `OrdinalIgnoreCase`，另外的系统用 `Ordinal`。进程已经退出、取不到模块路径或访问失败时，返回 `false`。

```text
根目录              C:\MCT\Data\
同目录              C:\MCT\Data\Temp\link.exe
碰巧同前缀          C:\MCT\Database\link.exe
另一份解压目录      D:\test\MCT\Temp\link.exe
```

这个判断处理的是路径归属。两个实例用同一个数据根时，路径条件区分不了是谁启动了进程。要把范围再收紧，可以从启动时拿到的进程对象开始记录归属，并考虑进程退出后的清理。路径判断在这里只能做第二道过滤。

[对应提交 · MCZLF/MinecraftConnectTool `55e5db12`](https://github.com/MCZLF/MinecraftConnectTool/commit/55e5db120b186ca22eb396c34bf28f9b72da936f)
