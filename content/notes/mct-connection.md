---
title: MCT 的三种联机方案
description: OpenP2P 穿透、MCILM-Link 中继与 EasyTier 去中心化组网。
category: 项目说明
updated: 2026-11-15
tags: Minecraft, C#, 网络, EasyTier
---

MinecraftConnectTool 支持 OpenP2P NAT 穿透、MCILM-Link 中继和 EasyTier 去中心化组网。三种方案提供不同的连接路径，可以根据双方的网络环境选择。

## OpenP2P：NAT 穿透

OpenP2P 负责 NAT 穿透，尝试建立点对点连接。双方的网络环境会影响穿透结果，并不是所有环境都能直连。

## MCILM-Link：中继连接

MCILM-Link 提供中继路径。双方通过中继服务器通信，给无法直接连接的网络环境提供另一种方式。实际可用性仍取决于当前版本、配置和网络情况。

## EasyTier：去中心化组网

EasyTier 是另一种联机方案，通过去中心化组网把参与联机的设备连接起来，用于 Minecraft 联机。它和 OpenP2P 穿透、MCILM-Link 中继一同提供选择。

具体的房间创建、加入方式和配置以所用 MCT 版本的界面与说明为准。更换连接方案时，也要确认游戏版本、模组和主机开放的端口一致。

## 去哪里下载

公开版本见 [GitHub Releases](https://github.com/MCZLF/MinecraftConnectTool/releases)。具体功能和使用方法以对应版本的项目说明为准。

遇到问题可以去 [Issues](https://github.com/MCZLF/MinecraftConnectTool/issues)，说明系统版本、网络环境，并附上日志。

## 相关链接

- [项目仓库](https://github.com/MCZLF/MinecraftConnectTool)
- [个人仓库入口](https://github.com/linfon18/MinecraftConnectTool)
- [EasyTier 项目](https://github.com/EasyTier/EasyTier)
- [FastShareYourLog：分享 Minecraft 日志](https://github.com/linfon18/FastShareYourLog)
