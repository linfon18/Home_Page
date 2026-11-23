---
title: 只撤掉首页大头像，怎么确认没顺手退掉别的功能
description: 这次回退有两个提交号可以对照。仓库恢复后，还要看线上 HTML 究竟引用了什么。
category: 小站开发
date: 2026-11-23
published: 2026-11-23T22:21:08+08:00
tags: Git, EdgeOne, 静态部署
---

那个点阵大头像我看了一眼就想回退。要撤的是加封面的 `9782de7`。再往前的 `d23be72` 已经有“第一次进首页才播开场”和文章跳转，这些得留着。

我用 `git revert --no-edit 9782de7` 追加一个反向提交。因为当时它正好是最顶上那个改动，可以直接用 `git diff --exit-code d23be72 HEAD` 对照前一版。没差异，说明两个提交记录下来的文件树一样，历史里仍然看得到中间试过什么。如果中间又进了其他人的修改，就应当逐项看差异，不能再把整棵树相等当目标。

推过去以后再看首页响应。HTML 里原有的 `home-profile`、`home-console` 应该在，已经撤掉的 `portrait-cover` 和 `portrait-field.js` 应该消失。这个检查比盯着一次推送成功提示更直接，因为 GitHub 的分支先更新，EdgeOne 返回给访客的页面还可能是前一次构建。

[对应提交 · linfon18/Home_Page `7e187fb`](https://github.com/linfon18/Home_Page/commit/7e187fb514650e020444c4b2d8e76b533486560d)
