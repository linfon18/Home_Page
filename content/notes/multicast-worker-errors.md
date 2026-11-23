---
title: Minecraft 局域网广播，发不出去时在哪收尾
description: 记录 ServerPost 中 UDP 绑定、发送失败和局域网发现的排查顺序。
category: Minecraft 联机
date: 2026-09-03
published: 2026-09-03T13:32:59+08:00
tags: MCT, C#, UDP, 多播
---

`Server_Post.Post_Main` 绑定传入的本地 UDP 端口，然后往 `224.0.2.60:4445` 发 Minecraft 局域网公告，公告的 `[AD]` 里放房间端口。循环里每次发送后睡 100ms，帧数上限大概是每秒十条。多播 TTL 设为 2，能走多远还看这条链路是否转发多播。

绑定或配置 socket 可能还没进入循环就失败，所以外层有一处异常出口。发送时遇到 `SocketException`，循环内单独写失败原因，再退出。两处都清 `isRunning`，离开 `using UdpClient` 就释放本次 socket。我排查时会先看报错来自初始化还是 `Send`。如果发送端无报错、游戏列表却看不到房间，可以在接收端过滤 UDP 4445，先确认入站公告，再检查公告里的端口能否连接。发现和实际入服各用一条路径。

[对应提交 · MCZLF/MinecraftConnectTool `4fae899`](https://github.com/MCZLF/MinecraftConnectTool/commit/4fae8994119342ef8bd7d6d9fc7d00ad4e483b4c)
