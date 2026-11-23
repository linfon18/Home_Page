---
title: 雨水拦在终端顶部之前，先把两套坐标对齐
description: 用 getBoundingClientRect、DPR 和实际位图宽高推导 Canvas 变换，避免滚动条和取整造成偏移。
category: 网站开发
date: 2026-11-16
published: 2026-11-16T21:55:25+08:00
tags: 小站, Canvas, DPR, 天气
---

让雨点落到终端上时，碰撞已经可以用 `getBoundingClientRect()` 算。麻烦是同一组坐标交给 Canvas 画，画面里的水滴还可能偏一点。终端矩形在视口坐标中，Canvas 位图有自己的原点和分辨率。页面有滚动条、Canvas 带偏移或 DPR 不是整数时，我不能拿 `innerWidth × devicePixelRatio` 直接替代这两个量。

## 把视口原点搬到画布坐标

`trackViewportCanvas` 先读 Canvas 自己的 `b.x`、`b.y`、`b.width` 和 `b.height`。位图宽高用边界尺寸乘以限制后的 DPR 再取整。变换矩阵使用 `sx = canvas.width / b.width`、`sy = canvas.height / b.height`，这样能把取整后的像素数算回去。

```text
位图 x = (视口 x - b.x) × sx
位图 y = (视口 y - b.y) × sy
```

例如 Canvas 的左边在 `10px`，宽 `333px`，DPR 是 `1.5`。位图宽度取整为 `500`，`sx` 是 `500 / 333`。终端坐标 `x = 343` 正好映射到位图右边界 `500`，用 `1.5` 直接乘只有 `499.5`。偏移如果漏掉，Canvas 从 `10px` 起的区域就会整体错开。

## 什么时候重设位图

写 `canvas.width`、`canvas.height` 会擦掉已有内容和上下文状态。代码用位置、尺寸和位图宽高做签名，签名相同就早退。重设以后才写入 `setTransform`，把实际 CSS 矩形和比例记录进 `_viewport`。`ResizeObserver`、窗口 resize 和 `visualViewport.resize` 共用这一入口。

我会先把雨关掉，只画终端四角四个点，再检查桌面滚动条出现、页面缩放、手机旋转时点和边框是不是重合。这个观察比直接盯高速雨滴容易。然后才开碰撞，分别核对雨滴停在顶部、边框径流落在侧边。碰撞范围和实际绘制应使用相同的视口坐标。

[对应提交 · linfon18/Home_Page `aefa600`](https://github.com/linfon18/Home_Page/commit/aefa6006128a185c6307cc6f8a7fde33b28418f0)
