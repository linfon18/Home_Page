---
title: 静态站资源的版本号，为什么取文件内容
description: 记录小站构建时给脚本、样式和头像加版本号的顺序，以及 CDN 缓存还要看什么。
category: 网站开发
date: 2026-11-15
published: 2026-11-15T20:26:29+08:00
tags: 小站, Node.js, CDN, 缓存
---

小站重新部署时，HTML 换了，浏览器还有可能用旧样式。`build.js` 在资源已经写入 `dist` 后遍历 HTML，把存在的本地 `/assets/` 引用加上 `?v=`。版本取目标文件的 SHA-256 前 12 个十六进制字符。正文更新但脚本字节没变时，旧缓存还能用。脚本一改，新的 HTML 引用新的 URL。

构建流程先尝试同步 GitHub 头像并生成圆角 favicon，再算会写进 HTML 的版本号。否则头像文件和标识的对应关系会差一轮。这段代码只扫描 HTML 里的 `href` 和 `src`。CSS 内的 `url()`、运行时拼出的路径，以及本来已经带查询参数的引用都不在覆盖范围内。

检查时我会对同一份资源构建两次，在输出 HTML 中找同一个版本号。随后只改那份资源的一点内容，检查生成的新 URL。部署后还要访问线上 HTML 与资源，确认 EdgeOne 缓存键区分 `v`，并且 HTML 已经更新。版本号只在读到新 HTML 时生效，拿本地构建结果判断线上缓存还差这一步。

[对应提交 · linfon18/Home_Page `15fb5a1`](https://github.com/linfon18/Home_Page/commit/15fb5a13d02ed92b496b782aff9942ff7cd684ed)
