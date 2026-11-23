---
title: 退房时，心跳的信号量该谁还
description: 把一次 SemaphoreFullException 拆成两条时间线，看停止定时器和结束进行中的请求有什么区别。
category: Minecraft 联机
date: 2026-07-26
published: 2026-07-26T22:21:34+08:00
tags: MCT, C#, 并发
---

MCT 的房间列表会定时发心跳。为了避免上一次还没发完，下一次又挤进来，发送代码拿了一把信号量。平时能正常联机，一到退房收尾却有机会抛 `SemaphoreFullException`，看起来很像是锁不够用，其实是多还了一次。

## 把两个动作排在一起

假设这一轮心跳已经拿到许可，正在等网络。此时点退房，`StopHeartbeat` 停掉定时器。如果在这里顺手 `Release()`，计数先恢复了。片刻之后，刚才那轮请求从 `await` 回来，走进自己的 `finally` 又还一次，计数这才超过上限。

另一个入口更容易忽略。心跳处理自己也可能决定停止，例如续期失败。这样停止代码和发送代码的 `finally` 就在同一条调用链上，不需要用户和网络恰好撞在一起，也有重复释放的机会。

## 我把收尾放在哪

这个提交拿掉了停止函数里的释放动作。停止方负责拦住下一轮，拿到许可的发送任务负责在自己的 `finally` 里归还。代码还给释放点加了 `SemaphoreFullException` 的日志，方便看到运行中还剩多少异常路径。给异常套一个 `catch` 自己并不会把计数改对。

## 把退房插进请求中间

下面这段可以放到 .NET 9 控制台项目的 `Program.cs` 里。两个 `TaskCompletionSource` 卡住网络等待的位置，跑多少次都能把“退房”放到第一次 `WaitAsync` 和 `finally` 之间。

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

await Run("old", true);
await Run("new", false);

static async Task Run(string name, bool releaseOnStop)
{
    using var permit = new SemaphoreSlim(1, 1);
    var acquired = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var finish = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

    async Task Heartbeat()
    {
        await permit.WaitAsync();
        try
        {
            acquired.SetResult();
            await finish.Task;
        }
        finally
        {
            permit.Release();
        }
    }

    var task = Heartbeat();
    await acquired.Task;
    if (releaseOnStop && permit.CurrentCount == 0)
        permit.Release();

    Console.WriteLine($"{name} after stop: {permit.CurrentCount}");
    finish.SetResult();
    try { await task; }
    catch (SemaphoreFullException) { Console.WriteLine("SemaphoreFullException"); }
    Console.WriteLine($"{name} after heartbeat: {permit.CurrentCount}");
}
```

```text
old after stop: 1
SemaphoreFullException
old after heartbeat: 1
new after stop: 0
new after heartbeat: 1
```

两条路径最终都显示 `1`，所以只断言结束时的计数会漏掉这个回归。停止后的 `0` 表示旧请求还持有许可。如果需要保证退房后请求不会更新当前房间，还得取消或等待旧请求，或者在它返回时检查房间会话。释放许可解决的是并发进入，属于哪个房间得用会话状态判断。

[对应提交 · MCZLF/MinecraftConnectTool `35343ec`](https://github.com/MCZLF/MinecraftConnectTool/commit/35343ec7f0637ffc8820df465b989c63d3fd54da)
