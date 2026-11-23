---
title: EasyTier 一直报同一个错，我用 128 个位置给日志去重
description: 用队列和集合实现按首次出现淘汰的错误去重，顺便算清它能忘掉哪些错误。
category: Minecraft 联机
date: 2026-07-09
published: 2026-07-09T21:51:32+08:00
tags: MCT, EasyTier, 日志, 数据结构
---

EasyTier 向多个 peer 重试时，同一类连接错误能把 UI 刷满。MCT 先判断是否为错误，再归一化。普通消息照原样走。错误会去掉 `错误:` 或 `[ET]` 前缀。遇到 `connect to peer error` 时，还有针对 `ip_version` 和错误附加括号内容的处理。归一化以后才查重复，输出时仍显示原消息。

里面两种容器各干一件事。`HashSet<string>` 用 `OrdinalIgnoreCase` 查键，`Queue<string>` 记首次进入的顺序。再次遇到已有键就提前返回，键的位置不会挪到队尾。超过 128 个不同的错误时，从队首拿走一个，同时从集合删掉它。会话重置时清掉两个容器。

我用缩小到 3 个位置的例子走一遍。`A B C A D A` 进入时，第四条重复的 A 被压住。D 到来以后淘汰最早的 A，最后一条 A 又会显示。这个行为和按最近使用时间淘汰的 LRU 不一样。一个错误即使又出现一百次，只要其余新错误挤够了位置，它就会再次露头。

```text
输入     A B C A D A
显示     A B C   D A
最后三个键       C D A
```

还有个取舍是错误键粒度。去掉一个字段之前，可以先拿两条真实输出并排看看。去掉地址一类会变化的字段有助于压重复。如果把能区分两个失败原因的字段也一起拿掉，随后就很难从 UI 判断发生过几种故障。需要保留变化量时，可以给相同键累加计数，第一次和最后一次各存一份。

[对应提交 · MCZLF/MinecraftConnectTool `14357382`](https://github.com/MCZLF/MinecraftConnectTool/commit/143573829ba0cc0953ad4ecb768870a9726654ce)
