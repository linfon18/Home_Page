---
title: MCT 的三种联机方案
description: OpenP2P 穿透、MCILM-Link 中继与 EasyTier 去中心化组网。
category: 项目说明
updated: 2026-11-23
tags: Minecraft, C#, 网络, EasyTier
---

MinecraftConnectTool 支持 OpenP2P NAT 穿透、MCILM-Link 中继和 EasyTier 去中心化组网。三种方案提供不同的连接路径，可以根据双方的网络环境选择。

## OpenP2P：NAT 穿透

双方先通过 OpenP2P 网关交换建链信息，再按连接策略尝试 UDP 或 TCP 打洞。穿透成功后，加入方在 Minecraft 里连接 MCT 给出的本地监听地址，游戏流量沿直连隧道送到房主开放的局域网端口。

NAT 映射和防火墙都会影响打洞结果。OpenP2P 上游也支持借用其他节点转发，MCT 的 MCILM-Link 模式则使用单独的中继服务。可以在[项目页的联机拓扑](/projects/)逐个切换这些场景。

## MCILM-Link：中继连接

MCILM-Link 提供中继路径。双方通过中继服务器通信，给无法直接连接的网络环境提供另一种方式。实际可用性仍取决于当前版本、配置和网络情况。

## EasyTier：去中心化组网

MCT 使用 EasyTier 和 Scaffolding，参与者通过房间码加入同一虚拟网络。网络内的设备通过虚拟 IP 寻址。能直连时，流量走对等链路。无法直连时，EasyTier 也可以通过可达的节点转发。

具体的房间创建、加入方式和配置以所用 MCT 版本的界面与说明为准。更换连接方案时，也要确认游戏版本、模组和主机开放的端口一致。

## 去哪里下载

公开版本见 [GitHub Releases](https://github.com/MCZLF/MinecraftConnectTool/releases)。具体功能和使用方法以对应版本的项目说明为准。

遇到问题可以去 [Issues](https://github.com/MCZLF/MinecraftConnectTool/issues)，说明系统版本、网络环境，并附上日志。

## 相关链接

- [项目仓库](https://github.com/MCZLF/MinecraftConnectTool)
- [MCT 官网](https://mct.loft.games/)
- [OpenP2P 中文文档](https://github.com/openp2p-cn/openp2p/blob/master/README-ZH.md)
- [个人仓库入口](https://github.com/linfon18/MinecraftConnectTool)
- [EasyTier 项目](https://github.com/EasyTier/EasyTier)
- [FastShareYourLog：分享 Minecraft 日志](https://github.com/linfon18/FastShareYourLog)
