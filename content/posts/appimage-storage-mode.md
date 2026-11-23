---
title: AppImage 跑起来以后，配置该往哪写
description: 首次启动向导、设置页和真正解析路径的地方，都要认识同一种只读运行环境。
category: Minecraft 联机
date: 2026-08-02
published: 2026-08-02T21:53:49+08:00
tags: MCT, Linux, AppImage
---

MCT 有个“存到程序目录”的选项。在解压版里，程序和数据放在一个文件夹挺方便，整个复制走就行。到了 AppImage，程序看到的目录可能是只读挂载点，界面里能选中它，等要落盘时才发现不能写。

## 默认值还不够

这个提交用两个条件识别环境：系统是 Linux，`APPIMAGE` 环境变量也有内容。命中后将默认存储切到 `SystemTemp`，其他环境仍默认 `AppDirectory`。设置选项多了 `IsEnabled`，首次向导和设置页都能把“程序目录”显示成不可用。

光把选项置灰还漏了一条路。如果之前用解压版保存过配置，文件里可能早就写了 `AppDirectory`。用户这次根本不用打开设置页，程序自己就会读出这个值。于是 `StorageMode` 的读取和实际解析存储目录时也要检查 `IsStorageModeAllowed`，不适用的值回到当前环境的默认选项。

## 我会这样核对

先在普通 Linux 解压目录选择程序目录保存，再带着这份旧设置启动 AppImage。分别看向导的选中项、设置页显示值和实际创建文件的位置。三处应该能对上。临时目录有被系统清理的可能，排查“升级后配置怎么没了”时，得先确认上次运行用的到底是哪种存储模式。

[对应提交 · MCZLF/MinecraftConnectTool `55291ac`](https://github.com/MCZLF/MinecraftConnectTool/commit/55291acfcf9db7409872c8ffa6b2b007c57b3beb)
