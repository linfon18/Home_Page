---
title: 一个迟到的 HTTP 410，能不能把新房间关掉
description: 用房间码、玩家 ID 和会话代数判断心跳响应的归属，再追到 Avalonia 上排队的停止操作。
category: Minecraft 联机
date: 2026-11-21
published: 2026-11-21T23:16:52+08:00
tags: MCT, C#, HTTP, 并发
---

房主主动关房时，加入方应该退出联机。困难在于确认这个消息时，我可能已经退了旧房、进了新房。HTTP 请求是在先前发出的，响应却是现在才处理。要是回调只检查“我现在是不是加入方”，两次操作就会串起来。

## 第一处检查在服务里

`SendHeartbeatAsync` 取当前房间码、玩家 ID 和 `_sessionRevision`，用这组值处理返回。房间关闭的分支只认 `410 Gone` 与响应体一起出现。响应要有 `success: false`、`message: "ROOM_CLOSED"`，`data` 还得回传对应房间和玩家。代理返回一个没有这些字段的 410 页面，不会被识别成房主关房。

拿到符合格式的响应后，`TryHandleConfirmedCloseAsync` 在 `_sessionGate` 内再比较当前登记。房间码和玩家 ID 只说明是哪一笔登记，会话代数还能识别退房后又回到同一个房间的情况。`ClearState()` 清掉登记并推进代数。`RoomClosed` 事件带的是清理之后的代数，方便接收方判断这次清理是否仍是最近一次状态变化。

## 第二处检查在 UI 回调里

网络处理完到按钮真正执行之间还有 `Dispatcher.UIThread.Post`。假设确认关闭时事件携带代数 8，UI 忙完前用户加入了别的房间，代数已经是 9。此时 `IsCurrentClosure(8)` 会让旧动作退出。Link 和 P2P 的处理还会核对当前模式和角色。两次检查分别卡住网络返回和 UI 执行，中间任何一条队列都可以改变实际顺序。

```python
def accept(sent, current, reply):
    room, player, revision = sent
    return (room, player, revision) == current and reply == (410, room, player)

sent = ("A", "guest-1", 7)
reply = (410, "A", "guest-1")
print(accept(sent, ("A", "guest-1", 7), reply))
print(accept(sent, ("A", "guest-1", 9), reply))
closed_revision, now = 8, 9
print(closed_revision == now)
```

输出依次是 `True`、`False`、`False`。这段最小模型只覆盖身份比较。实际回归还得把 HTTP 响应体解析和模式检查带上。可以让替身先挂住心跳，在退出并重进后放行；另一个用例让响应先到、把事件投进 UI，再在消费前切换会话。两个用例都要断言当前核心仍在运行，单看房间名单是否还在容易漏查。

[对应提交 · MCZLF/MinecraftConnectTool `5056120`](https://github.com/MCZLF/MinecraftConnectTool/commit/50561209c7b18dcf9e7f18dc62d8c183e2c8120b)
