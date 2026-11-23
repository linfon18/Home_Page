---
title: AppImage 打包成了一个文件，为什么还要 .NET
description: 读一遍 MCT 的 Linux 和 macOS 构建参数，区分包格式、单文件发布、运行时依赖和上传范围。
category: Minecraft 联机
date: 2026-08-02
published: 2026-08-02T21:31:38+08:00
tags: MCT, .NET, AppImage, GitHub Actions
---

我调 MCT 的 Linux 与 macOS 构建时遇到几个听起来都像“把程序装进一个文件”的选项。真正下载下来跑的时候，各管各的。这个提交把两条发布线都切到 `--self-contained false`，同时启用 `PublishSingleFile`。前者决定 .NET 运行时由哪边提供，后者控制发布器怎么装应用文件。

以 Linux 工作流为例，`dotnet publish` 针对矩阵中的 RID 产出程序，再用 `appimagetool` 将 `AppDir` 包起来。`ARCH` 表示 AppImage 要标明的目标架构。打包工具自己是 x86_64 版本，在 runner 上执行。它跟最终产物的目标架构是两回事。把程序放进 AppImage 不会另外帮应用装一份原本未发布的 .NET 运行时。

我改这里时顺手把下载来的 `appimagetool-x86_64.AppImage` 放进 `tools/`，成品写进 `artifacts/`。两者都叫 `.AppImage`，用根目录的 `./*.AppImage` 做上传匹配时，就会连工具一起捎走。上传范围改成 `artifacts/*.AppImage` 后，矩阵每次传的是自己的成品。

验包时我会看三处。先确认产物文件名与 RID，再解出目录核对应用和运行时文件，最后放在有目标 .NET 运行时的机器上试启动。有两个同架构的测试环境时，可以在没装运行时那份再跑一次，用它确认文档中需要安装什么。归档下载成功和双击能运行，中间还隔着这几步。

[对应提交 · MCZLF/MinecraftConnectTool `5334978a`](https://github.com/MCZLF/MinecraftConnectTool/commit/5334978ac5eae1713c194f622ed41882cd7a94dd)
