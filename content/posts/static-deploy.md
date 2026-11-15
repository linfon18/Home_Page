---
title: 这个站怎么部署
description: EdgeOne 静态托管，只有 Node.js 14 也能构建。
category: 站点说明
tags: EdgeOne, Node.js, 静态网站
---

这版网站的构建环境只需要 Node.js 14 或更新版本，不需要安装 Python、Hugo 或 npm 依赖。

## 构建

在项目根目录执行 `bash 部署.sh build`，或者直接执行 `node build.js`。

构建结果在 `dist` 目录。每个页面都有自己的 HTML，直接访问子页面、刷新页面都不依赖单页应用路由。

## EdgeOne 配置

- 框架预设：Other
- 根目录：项目根目录
- 安装命令：`bash 部署.sh install`
- 构建命令：`bash 部署.sh build`
- 输出目录：`dist`

仓库根目录的 `edgeone.json` 已设置构建命令、安装命令、`dist` 输出目录和 Node.js 14.21.3，部署时覆盖控制台对应设置。原来的 `bash deploy.sh build` 命令也保留了，控制台手动配置时，输出目录应填写 `dist`。

`index.html` 不在源码根目录，而是由构建生成在 `dist/index.html`。如果构建成功后首页仍显示旧版 404，而 `/dist/index.html` 可以打开，说明发布的是仓库根目录。确认输出目录为 `dist` 后重新部署即可；不需要把生成的首页提交到源码根目录。

## 本地看效果

运行 `node server.js`，浏览器打开 `http://127.0.0.1:4173`。

## 头像与图标

构建会从 GitHub 获取头像，再生成圆角站点图标。网络不可用时，用仓库里保存的真实头像快照。站内头像在访问时也会尝试同步 GitHub。

## 加一条记录

在 `content/posts`（文章）或 `content/notes`（笔记）里新建 Markdown 文件，在文件头填写标题、简介、分类和标签，正文正常写 Markdown。下一次构建会自动生成详情页和索引卡片，站内搜索也会收录全文、标题、简介与标签。

不需要改页面模板，也不需要创建额外的路由。
