---
title: Mac 构建明明有 .app，下载下来为什么是一堆文件
description: 记一次 GitHub Actions 产物打包修正，先看归档根目录里装了什么。
category: Minecraft 联机
date: 2026-08-14
published: 2026-08-14T17:55:53+08:00
tags: MCT, macOS, GitHub Actions
---

Mac 版的 `MinecraftConnectTool.app` 看起来像一个文件，打开包内容其实是一整棵目录。构建机上这棵目录摆得好好的，发布步骤把哪一层交给 artifact，又是另一回事。

我在工作流里加了 `zip -r "MinecraftConnectTool_${{ matrix.rid }}.zip" "MinecraftConnectTool.app"`，然后把上传路径指向生成的 ZIP。这样构建矩阵里的每个 RID 有自己的文件名，压缩包根下也保留 `MinecraftConnectTool.app/` 这一层。只压包里的内容，用户拿到的第一层就可能变成 `Contents/`。

检查时用 `unzip -l` 看归档列表就够了。第一层是 `.app`，可执行文件还在它下面的 `Contents/MacOS/`，再到目标机器解压启动。签名、公证和 CPU 架构是另外几项检查。这次提交直接修的是目录结构，光凭打出了 ZIP 还不能证明那些环节也都通过。

[对应提交 · MCZLF/MinecraftConnectTool `46f2afe`](https://github.com/MCZLF/MinecraftConnectTool/commit/46f2afe4a31aa194d938ca91c68647d952050b2d)
