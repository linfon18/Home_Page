# 开发回归

这些脚本只用于开发，不参与 EdgeOne 构建。生产仍只需要 Node.js 14。

```bash
node build.js
python -m pip install playwright
python -m playwright install chromium
python tests/weather-flow.py
python tests/live2d-parity.py
python tests/profile-rendering.py local
```

已有 Chromium 浏览器可以设置 `BROWSER_PATH`。PowerShell 示例：

```powershell
$env:BROWSER_PATH='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
python tests/live2d-parity.py
```

- `weather-flow.py`：确定性供水检查，包含挂滴增长、脱落、连续流、断水、数量上限、终端内部遮挡与天气切换。无需 `dist/`。
- `live2d-parity.py`：默认/MAX 的桌面和手机同帧 RGBA 比较、GPU 上下文恢复、清晰度和终端暂停恢复。需要构建后的 `dist/`。
- `profile-rendering.py`：静置、鼠标、下雨、隐藏模型四组测量，输出 CDP 指标、调用次数、GPU 后端与采样热点。可选参数为标签和静态目录；不会覆盖存档。

模型和性能测试使用随机端口的临时 HTTP 服务，结束时关闭浏览器与服务。测试之间不要并行运行性能采样；使用相同浏览器版本、GPU 后端、视口与 DPR 比较。外部天气、GitHub、一言请求在测量时阻断。

`docs/performance/2026-11-16-before.json` 是本轮优化前的本地工作版本，不是已发布 Git 提交；`2026-11-16-final.json` 是此次发布内容的最终采样。原始基线源目录未冻结，因此不能仅靠仓库重建其全部视觉状态。文件保存实际累计耗时和测量窗口，比较时需归一。单次短采样不代表长期功耗，不应将上传字节比例或主线程比例当成风扇降噪比例。
