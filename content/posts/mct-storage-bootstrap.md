---
title: 数据目录也能改，程序第一次启动要去哪读设置
description: 拆开 MCT 的引导配置和运行数据目录，给迁移、设置缓存和主题初始化排出顺序。
category: Minecraft 联机
date: 2026-07-23
published: 2026-07-23T20:18:48+08:00
tags: MCT, C#, 配置, 数据迁移
---

MCT 原来把核心和数据放在系统 Temp。改到程序目录旁边后，我又想留一个自定义位置给用户。事情就变成先找到配置才能知道配置在哪。这个环节最容易被“把旧路径换成新路径”糊过去。

## 先保留一个能直接算出来的路径

`LocalStorageService` 把 `MCTStorage.json` 放在用户目录下的 `MCTStorageConfig`。程序知道用户目录，就能先读出存储模式。实际数据按模式选根目录。程序旁边是 `MCTConfig`，系统 Temp 对应老的 `MCZLFAPP`，自定义模式使用填写好的路径。

从这个根再展开目录。`Temp/APPconfig.json` 是应用设置，`Temp/APPLog.ini` 是运行日志，EasyTier 用根下的 `ET`，主题配置落在根下的 `theme.json`。Link、P2P、日志和探针入口往同一个服务收口，免得界面保存到新位置，一个后台组件还在老目录写。

## 改路径时还得清缓存

`ConfigService` 原来拿着一份固定的配置文件位置。新版本可以在持有内部锁时把 `_configCache` 清掉，重取 `ConfigFilePath`，并初始化目标目录。主题也有它自己的初始化时机。首次启动向导可以先套预览主题，正常运行读取主题的入口仍然在主题服务。仅把根路径字符串改掉，已经缓存的对象不会跟着变化。

这里我会重点试两次启动。第一次用旧目录的 `APPconfig.json` 测自动兼容时的选择。第二次改成自定义目录，在旧、新目录分别放一个不同值，核对渲染模式引导、正常设置页和运行日志是不是认同一个根。迁移中途失败时，还要分头检查引导文件在哪、数据已经复制了多少、下一次启动会选哪个根。三项对不上，重试时就可能看起来像配置凭空没了。

[对应提交 · MCZLF/MinecraftConnectTool `ed3980e8`](https://github.com/MCZLF/MinecraftConnectTool/commit/ed3980e82a2414422a81d85269465d311a0cf0ca)
