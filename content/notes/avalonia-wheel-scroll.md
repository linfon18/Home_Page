---
title: 鼠标停在下拉框上，设置页就滚不动了
description: Avalonia 里把关闭的 ComboBox 上的滚轮位移交回外层 ScrollViewer。
category: Minecraft 联机
date: 2026-08-17
published: 2026-08-17T12:16:48+08:00
tags: MCT, Avalonia, 滚轮
---

从上往下滚设置页，指针经过下拉框，页面突然像到底了一样。手往旁边挪一点又能滚。这种问题我会先看同一个位置的控件开着和关着时，应该由谁处理滚轮。

这个提交只接管关闭的 `ComboBox`。展开时还要浏览选项，直接返回，让下拉列表自己处理。关闭时把事件标为已处理，沿视觉树找最近的 `ScrollViewer`。拿到它以后，横向位置保留，纵向用 `Offset.Y - Delta.Y * 48`。页面能滚的最大距离是 `Extent.Height - Viewport.Height`，先跟零取大值，再把目标位置夹在这个范围内。

所以我会分三处试：页中间经过关闭的框，打开下拉列表在选项上滚，以及页面已经到底时继续滚。最后一种不该多出空白。这里还有个边界，处理标志写在查找祖先之前，这个控件以后如果移出滚动容器，滚轮也会被吃掉；复用这段事件代码时要留意它挂在哪儿。

[对应提交 · MCZLF/MinecraftConnectTool `51db587`](https://github.com/MCZLF/MinecraftConnectTool/commit/51db58798856874043d5673821af28a1d8d56c16)
