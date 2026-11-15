# linfon18 的小站

首页由竖排个人介绍、Linux 操作模拟终端、MinecraftConnectTool 入口和最近更新组成。文章、笔记、项目、日常、关于和联系方式各有独立页面，保留原来的简介、项目链接、社交账号和背景插画。项目页只突出 MinecraftConnectTool，另两个小工具保留在下方。

## EdgeOne 静态部署

只需要预装的 Node.js 14+。没有 npm 依赖，不安装框架，不需要 Python、sudo 或全局写入。

| 配置 | 值 |
| --- | --- |
| 框架 | Other |
| 根目录 | ./ |
| 安装命令 | bash 部署.sh install |
| 构建命令 | bash 部署.sh build |
| 输出目录 | dist |

`deploy.sh` 兼容相同参数。旧站输出目录如果留空，需要改为 `dist`。所有路由都有独立 HTML，可直接访问和刷新，不需要 SPA 回退或后端。

构建会同步 GitHub 头像，并生成内嵌该头像的 256×256 圆角 SVG favicon，圆角半径 64px。网络不可用时使用仓库内的真实头像快照。页面也会尝试从公开 API 同步头像，无需 Token。

## 站内切页

普通站内链接通过 fetch 读取静态 HTML，替换正文、SEO 元数据和导航选中状态，顶部显示细加载条。导航、玻璃画布、鼠标和 Live2D 实例跨页保留；后退与前进恢复页面和滚动位置。页面模块在切走时清理请求、计时器及监听。直接访问和刷新仍使用独立静态 HTML；新部署资源版本不一致时完整加载新文档。

页头滚动收缩保持外层高度不变，仅移动内部导航，避免高度变化触发滚动锚定后在阈值处反复闪动。

项目页与 MCT 笔记列出 OpenP2P、MCILM-Link 和 EasyTier 去中心化组网三种方案。`Introduction.md` 保留原站归档内容。

## 本地预览

运行 `node server.js`，打开 `http://127.0.0.1:4173`。单独构建用 `node build.js`，离线可运行 `SKIP_GITHUB_SYNC=1 node build.js`。端口可以通过 `PORT` 调整。

## 文章与笔记

长文章放在 `content/posts/`，笔记放在 `content/notes/`。每个 Markdown 文件生成一个页面；文件名使用小写英文、数字和短横线。文件头格式如下，不需要引号：

```markdown
---
title: 文章标题
description: 一句话简介
category: 学习记录
date: 2026-11-15
updated: 2026-11-15
tags: C#, 网络
draft: false
---

正文。

## 一个小节

正常写 Markdown。
```

`title`、`description` 和 `category` 必填；日期、更新日期、标签和草稿字段可选。日期格式为 YYYY-MM-DD。设置 `draft: true` 后，页面、索引、搜索、RSS 和 sitemap 都不会发布这篇内容。有日期的内容按日期倒序排列，未填写日期的内容放在后面。

新增或修改 Markdown，提交 Git 后让 EdgeOne 重新构建即可。无需手动添加路由、索引、目录或搜索数据。搜索收录全文、标题、简介、分类和标签；导航搜索按钮或 Ctrl / ⌘ K 可以打开搜索，索引页支持分类和 `/` 快捷键。

正文支持标题、段落、HTTP(S) 链接、加粗、行内代码、围栏代码块、列表、引用和分隔线。阅读页自动生成小节目录。原始 HTML 会转义。

目前包含个人站重构技术复盘（2026-11-15）、MCT 连接方式笔记和本站部署文章。技术复盘覆盖静态构建、WebGL 着色器、终端接管和 Live2D 控制；后两篇说明文未填写发布日期。

## 页面

| 地址 | 内容 |
| --- | --- |
| / | 个人介绍、动态终端与最近更新 |
| /articles/ | 文章索引 |
| /notes/ | 笔记索引 |
| /articles/static-deploy/ | 本站部署说明 |
| /notes/mct-connection/ | MCT 连接方式 |
| /projects/ | MinecraftConnectTool 和小工具 |
| /life/ | Minecraft 服务器和游戏 |
| /about/ | 个人介绍与完整原文 |
| /activity/ | 公开 GitHub 动态 |
| /contact/ | 联系方式 |
| /feed.xml | 文章与笔记 RSS |

另有 404、站点认证、robots 和 sitemap。旧 `/notes/static-deploy/` 自动跳到新的文章地址。

## 设计与交互

液态玻璃直接用于导航、个人名片、内容面板和阅读区域。固定 WebGL 画布跟踪实际 DOM 面板的位置，用圆角曲面的法线与 1.46 折射率计算屏幕空间折射，采样原背景插画；再叠加边缘色散、反光、内侧暗边和焦散亮带。指针会影响局部光泽与折射，点击触发短暂波纹。文字保持独立的 DOM 渲染。

这套实现折射的是本站固定插画背景，不抓取任意 DOM 或操作系统窗口。正文面板有额外的阅读遮罩。原生 dialog 弹层使用 CSS 玻璃材质；WebGL 不可用或上下文丢失时，其余面板也保留 CSS 玻璃。每页只用一个 WebGL 画布，导航通过轻量 2D 画布将同一结果合成到自己的层级，以遮住下面滚过的正文；分辨率有上限，目标绘制频率 30fps，进入后台暂停；系统开启减少动态效果时停止连续绘制。

主题支持浅色、深色和跟随系统，会记住偏好。另有入场动画、按钮涟漪、可选交互音和聚焦时钟。声音默认关闭，聚焦用 Esc 退出。

GitHub 数据来自公开 API；接口受限时显示一天内的本机缓存，或明确显示不可用。不会用随机数字替代。头像请求失败不影响个人内容。

## 修改配置与模板

- `config.json`：名字、签名、GitHub、联系方式与域名。当前保留原域名 `https://linfon18.loft.games`。
- `Introduction.md`：原始简介，改版保留文件字节不变；关于页可展开，也可下载。
- `site/template.js`：页面和公共导航。
- `site/publishing.js`：文章、笔记索引和阅读页。
- `site/ui.js`：图标与安全 Markdown 渲染。
- `site/assets/design.css`：全站布局与玻璃表面样式。
- `site/assets/experience.css`：首页和鼠标动效样式。
- `site/assets/linux.js`：持续生成的 Linux 操作场景。
- `site/assets/console.js`：直接接管当前画面的交互命令与内存文件。
- `site/assets/network.js`：模拟 ping 的逐包计时与统计。
- `site/seo.js`：页面摘要、分享卡片和结构化数据。
- `site/assets/motion.js`：鼠标缓动、形变、磁吸与视差。
- `site/assets/glass.js`：全站实时材质。
- `site/assets/search.js`：全文搜索。
- `site/assets/page.js`：正文模块挂载和清理。
- `site/assets/navigation.js`：无刷新切页、加载条、元数据与历史记录。
- `site/assets/app.js`：主题、导航、聚焦和 GitHub 数据。

原始 Flask 文件保留供参考，新构建不会运行。原 README 归档在 `docs/legacy-readme.md`。沿用 MIT License。

## 首页交互

桌面端有缓动鼠标圆环，移到链接或按钮时贴合其圆角轮廓；按钮和文章入口有轻微磁吸。指针驱动背景视差与玻璃局部折射，点击产生短暂波纹。头像、介绍分段入场，文章预览滚动出现。终端模拟一位 Linux 用户持续操作，右上角可暂停或继续。

终端是本地视觉模拟，包含 gcc 编译与报错纠正、gdb 断点/变量/调用栈、vi/vim 编辑、sudo 隐藏密码、apt 更新安装、日志跟踪、top、ip/ping、sl 蒸汽小火车和 clear。采用持续的状态变化、场景洗牌与参数生成，不是固定录像反复重播。命令会停顿、拼错后退格、移动光标插入修正、Tab 补全和回看历史；vim 有 NORMAL / INSERT 模式、行号、状态栏和保存退出过程。

滚动记录有上限，进入后台暂停推进。开启“减少动态效果”时默认暂停，可主动播放；触摸端不显示自定义鼠标。终端的命令、主机数据和密码过程都是演示，不会连接服务器或执行系统命令。关闭 JavaScript 仍可阅读首页与文章，没有 WebGL 时使用 CSS 毛玻璃。

鼠标保留系统指针，外侧附加跟随圆环。终端使用固定深色控制台配色，移入后在当前命令行接管输入，不清空已有输出；离开五秒后静默继续原场景，手动暂停状态优先。手机可以点按进入，键盘可以通过 Tab 聚焦。输入 `help` 查看命令，支持历史、补全、Ctrl+C、Ctrl+L、gdb 和简化 Vim；编辑仅保存在当前页面内存。`ping` 按时间逐包输出，支持 `-c`、`-i` 和 Ctrl+C，延迟、丢包和统计为本地模拟。

自动场景包含 gcc/gdb/vi/vim、apt/sudo、sl、日志、top、网络、Git、systemctl、tar、chmod、awk/find、Docker、curl、make/readelf、tmux/crontab/vmstat 和 Python 检查，场景洗牌并持续变更参数。

## 搜索引擎与分享

各页面输出完整静态 HTML，标题统一为 `linfon18的小站`，保留各页独立简介、绝对 canonical、Open Graph 与 Twitter 分享标签，以及 Person、WebSite、WebPage 和面包屑 JSON-LD。文章和笔记自动生成 TechArticle 数据，只有 Markdown 填写日期时才输出发布日期；sitemap 的 lastmod 使用实际填写的更新或发布日期。404 和旧地址跳转页设为 noindex。发布的 Markdown 同步进入索引、搜索、RSS 和 sitemap，草稿全部排除。

生产域名由 `config.json` 的 `site_url` 控制，换域名后需重新构建。站点地图位于 `/sitemap.xml`，robots 已包含其地址。

## 一言与 Live2D

首页页脚的名字旁显示一言，点击句子或使用键盘回车可以刷新。`site/assets/hitokoto.js` 从 `https://v1.hitokoto.cn/` 读取句子和出处；当前会话缓存最近一次成功结果，接口失败或超时保留原句。首次加载没有缓存时显示个人签名。简介中的称呼为 linfon18 / Ad1va。

蓝龙位于桌面右下角，加载后会先打招呼，鼠标靠近时主动留意你。平时轮换张望、歪头、伸展、抖耳、轻哼和打哈欠，搭配视线跟随、眨眼、呼吸和尾翼动作。终端自动出现 sl、gcc、gdb、vim、网络和 apt 场景时，会分别作出惊喜、得意、好奇等反应；切换主题和离开页面一段时间后回来也会有回应。主动反应带有冷却时间，手动互动优先。

点击头部、脸、耳朵、身体或翅膀会轮换对应动作；在头上来回移动鼠标可以摸头，双击出现爱心眼，连续戳五次会晕头并稍作恢复。身体互动也包含回头摇尾巴。动作直接驱动模型的表情和骨骼参数，透明位置仍可点击下面的页面。聚焦角色后，回车摸头，空格扇翅，左右方向键歪头，上键惊喜，下键摇尾。互动粒子短暂显示并自动清理，页面不额外显示提示气泡。

桌面选中正文文字后，蓝龙会侧头观察选区，手里出现放大镜，镜片显示所选文字。SVG 放大镜通过模型手部网格定位，随手臂运动；没有修改原模型素材。选区保留原生复制功能，不读取输入框或终端里的选区。清空选区、切页、关闭角色或打开对话框会收起放大镜；动作也会自行结束。减少动态效果时保留静态反应。

联系页在桌面使用两栏，左侧保留 GitHub、QQ 和 Bilibili，右侧整理 MCT 反馈入口、版本和网络信息及日志清单，可以复制反馈模板。窄屏改为单栏。

关闭后可以从页脚 Live2D 按钮恢复。手机和触摸设备不显示，也不会请求运行库、纹理或模型；减少动态效果时静态显示并支持短暂的静态表情互动，页面隐藏或弹出对话框时暂停。

蓝龙并非 linfon18 自己的原创角色设计，Live2D 来源为 [Bilibili 视频 BV13Mg66xEAa](https://www.bilibili.com/video/BV13Mg66xEAa)，全站页脚和改版文章中也保留了来源链接。来源记录在 `docs/live2d-source.md`，压缩包内的使用须知原文保存在 `docs/live2d-model-notice.txt`。模型资源位于 `site/assets/live2d/blue-dragon/`；PixiJS 6.5.10、pixi-live2d-display 0.4.0 和 Cubism Core 运行库保存在 `site/assets/vendor/`，相应许可文件和原始声明随源码保留。构建不需要安装这些库。

终端输入 `rm -rf /*` 或加 `sudo` 的同类命令，会触发蓝龙生气及核爆、冲击波彩蛋，随后恢复。效果由 `catastrophe.js` 和 `catastrophe.css` 绘制，不执行命令、不删除文件。减少动态效果时使用短暂静态光晕。鼠标进入终端只暂停推进，保留现有输出节点、位置和提示符颜色，真正输入时才更新命令行。
