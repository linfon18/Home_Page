---
title: APPconfig.json 保存失败以后，MCT 到底用了哪份配置
description: 把进程内状态、存储目录选择和 JSON 落盘分别列出来，排查首次启动向导里的写入异常。
category: Minecraft 联机
date: 2026-09-15
published: 2026-09-15T18:51:03+08:00
tags: MCT, C#, 配置, 文件系统
---

MCT 的首次启动向导有个“一键跳过”，点完得保存一份配置。解压目录里如果已有一个只读的 `APPconfig.json`，以前这条路径可能一路抛回界面。我改这段以后最关心两件事。应用能不能继续运行，以及下次启动到底从哪儿读。

## 读属性、写文件和换根目录是三个动作

`TrySaveConfigFile` 先建父目录，再在目标文件存在时清 `FileAttributes.ReadOnly`，最后才用 `File.WriteAllText`。它接住 `IOException` 和 `UnauthorizedAccessException`。把只读属性清掉能处理带这个标记的文件，目录本身不可写时依旧会失败。

主目录失败、且当前还没选系统 Temp 时，调用 `LocalStorageService.Configure(SystemTemp, migrateExistingData: false)`，重算 `ConfigFilePath` 后再写同一份 JSON。这里的 `false` 很容易看漏。这条故障恢复路径不搬原目录里的其他数据。两处都失败时 `_configCache` 仍保留传入配置，本次运行继续用内存值。

```text
原目录可写               原路径写入成功
原目录失败、Temp 可写     切换根目录并重写这份 JSON
两处都不可写              设置只在当前进程的内存中
```

## 手工核对时多重启一次

我会给一个设置填容易认出来的值，保存后先从界面上读回来，再退进程重开。只看第一步容易把内存缓存当成落盘成功。在有正常写权限的文件上分别试“带只读属性”和“父目录不允许写入”。前者可以在原位置修正。后者要确认代码真的读取了新的 `ConfigFilePath`，也要检查是否突然指向一个新建、没有旧数据的根目录。

如果后面想解决突然断电留半截 JSON，得另外改落盘方式。`lock (LockObj)` 管的是这个进程内的写入者，无法让 `WriteAllText` 中途遇到的退出变成一次完整更新。可以先写到同目录的临时文件，确认内容，再根据目标系统支持的替换语义切换文件。重命名前终止进程、重命名后立即重启、另一个进程正在读取，是这项改动需要单独测的三种情况。

[对应提交 · MCZLF/MinecraftConnectTool `ceccec9a`](https://github.com/MCZLF/MinecraftConnectTool/commit/ceccec9a85416244c703ed65c959816f28093aa1)
