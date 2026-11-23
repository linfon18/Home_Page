---
title: 给 .log 加右键菜单，路径里有空格也得能用
description: 记录 FastShareYourLog 如何限定文件类型，以及我会用哪种文件名检查参数有没有拆散。
category: 桌面工具
date: 2026-02-15
published: 2026-02-15T21:51:45+08:00
tags: Windows, 注册表, Avalonia
---

我希望在 Minecraft 的日志上右键就能分享，平时点图片和压缩包时看不到这个菜单。FastShareYourLog 把入口挂到当前用户的 `Software\Classes\SystemFileAssociations\.log\shell\ShareLog`，子键 `command` 才是点下去要执行的东西。禁用时也只清理 `ShareLog` 这一支。

这里要照顾两条路径。一条指向正在运行的程序，一条是资源管理器替换进去的 `%1`。检查命令时我会把程序放在带空格的目录里，再选一个叫 `server logs\latest run.log` 的文件。两边都加引号，程序才能在一个参数里接到完整文件名。只拿 `C:\test.log` 试，很容易把问题留给真正用它的人。

窗口拿到参数后还有一层文件检查。这样哪怕从终端手工启动，入口也会检查文件还在不在、后缀对不对。设置界面遇到非 Windows 系统会直接返回；Avalonia 能画出同一个窗口，资源管理器右键菜单依然是 Windows 自己的接口。

[对应提交 · linfon18/FastShareYourLog `6b9a3b5`](https://github.com/linfon18/FastShareYourLog/commit/6b9a3b5eaa1ca781c6f0b704b4e684ece6d22f54)
