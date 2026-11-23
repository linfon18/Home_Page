---
title: 扫 Minecraft 模组时，什么时候能复用上次的 MD5
description: 从运行中的实例定位 mods，给 JAR 并行计算摘要，并追踪缓存命中和文件修改之间的边界。
category: Minecraft 联机
date: 2026-11-21
published: 2026-11-21T23:16:52+08:00
tags: MCT, C#, Minecraft, 缓存
---

拿两个客户端的 `mods` 目录比文件名，有时会把同名的不同版本判成一样。我给清单加了文件摘要，代价是第一次扫描需要把每个 JAR 读一遍。一套整合包在同一个 MCT 进程里可能反复检测，这时才有缓存可省。

## 扫的是正在跑的实例

`MinecraftModScanner` 先从运行中的 Java 进程识别实例，再检查该实例目录里的 `mods`。Windows 的启动参数用 `CommandLineToArgvW` 拆分，Linux 从 `/proc/<pid>/cmdline` 按空字节拆分。这里按空格拆就会把 `--gameDir` 后面带空格的路径截断。

`mods` 只枚举顶层 `.jar`，最多 1,024 项。`FileStamp.Read()` 还会检查 JAR 是否是重解析点。扫描用 `Parallel.ForEachAsync`，并行度取处理器数量与 4 的较小值，每个任务只写结果数组里自己那一格。完成后按文件名作序数排序，结果的顺序与线程结束先后无关。进度不是每算一个就发一次，在锁内累计，满 125ms 或全部完成才报告。

## 目录、文件戳和缓存值

磁盘缓存按完整路径的 SHA-256 命名，记录内部用 `Length`、`LastWriteTimeUtc.Ticks`、`CreationTimeUtc.Ticks` 判断内容是否可能变了。哈希走 `MD5.HashDataAsync` 读文件流。未命中时，计算前后各读一次文件戳。若两次不相等，直接报“扫描时模组文件发生变化”，避免把刚算出的值存到旧戳下面。

```text
jar 路径相同，三项文件戳相同     尝试复用 32 位十六进制摘要
路径相同，JAR 变长              重新读文件计算
后台计算期间文件戳发生变化       放弃这一轮结果
缓存文件长度或摘要格式不合规      当成未命中
```

这里的 32 位是 32 个十六进制字符。缓存只服务当前 MCT 进程，目录名有 PID 和 GUID，主动退出时会尝试清理。命中所依赖的文件戳是启发式判断。可在临时目录里用两个等长测试文件，分别指定相同修改时间，再对照文件戳与实际摘要。只要文件戳能全部重合，就仍有误命中可能。MD5 在这个功能里用来比对已有文件差异，无法给 JAR 做来源认证。

[对应提交 · MCZLF/MinecraftConnectTool `5056120`](https://github.com/MCZLF/MinecraftConnectTool/commit/50561209c7b18dcf9e7f18dc62d8c183e2c8120b)
