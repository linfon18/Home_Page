---
title: 给 MCT 分析日志，先从文件末尾往回读
description: 只保留最近五千行还不够，文件读取本身也得有边界。记录分析和上传两条路径各自的预算。
category: Minecraft 联机
date: 2026-09-27
published: 2026-09-27T11:08:04+08:00
tags: MCT, C#, 文件流, 日志
---

核心反复刷同一条报错时，往往最想看的是刚才断开的那几秒。这个时候如果先把整份日志读成字符串，再截最后几千行，大文件最贵的那次分配已经发生了。MCT 这次把限制移到了打开文件之后、解码文本之前。

## 为什么字节数和行数都要限

`ReadTextTail` 先看文件长度，超过预算就从文件末尾 `Seek(-maxBytes, SeekOrigin.End)`。分析路径传入 4,000,000 字节和 5,000 行。读行时用队列，满了先出队再加入新行。短行很多时行数会先到顶；碰到一整行都不换行的日志，字节窗口仍能挡住绝大部分旧内容。

比如一份 30,000,000 字节的日志，分析入口从偏移 26,000,000 附近开始解码，再从读到的范围里选最近五千行。窗口恰好从一行中间或者 UTF-8 多字节字符中间切入时，第一行可能是残片。所以这里适合看近期错误，拿它做整份日志的精确计数就不合适了。

## 用八个字节看看切在哪里

把这段放到 .NET 9 控制台项目运行。`前` 占三个字节，尾窗从它的最后一个字节开始。将控制台设成 UTF‑8 可以看到替换字符。

```csharp
using System;
using System.IO;
using System.Text;

Console.OutputEncoding = Encoding.UTF8;
var sample = Encoding.UTF8.GetBytes("前\nA\nB\n");
using var stream = new MemoryStream(sample);
stream.Seek(-6, SeekOrigin.End);
Console.WriteLine($"length={stream.Length}, offset={stream.Position}");
using var reader = new StreamReader(stream, Encoding.UTF8);
while (reader.ReadLine() is { } line)
    Console.WriteLine($"[{line}]");
```

```text
length=8, offset=2
[�]
[A]
[B]
```

继续套上两行上限，队列只剩 `A` 和 `B`。如果上限是三行，残片就会被送给分析器。追求完整行时可以在截断后跳过首个换行，不过还要处理偏移刚好在行首和窗口里一个换行都没有的情况。后者需要在“仅保留完整行”和“保留这条过长日志的尾部”之间选一个。

## 分享和分析各用多大的窗口

上传到 mclo.gs 的分支给了 32,000,000 字节，超过才改读尾部。分析入口给的窗口更小，临时运行日志也走同一套读取函数。两个数字都是代码里的十进制字节数，排错时不用猜这个“4 MB”具体怎么算。

文件用 `FileShare.ReadWrite | FileShare.Delete` 打开。`Seek` 决定起点，`StreamReader` 继续读到 EOF。如果生产者在读完前追加，读到的字节可以超过最初算出的预算。需要硬上限时，得在原始字节流上限制读取长度，再交给解码器。

[对应提交 · MCZLF/MinecraftConnectTool `2d511cc`](https://github.com/MCZLF/MinecraftConnectTool/commit/2d511cc9e3e9f2bfb470165f35af5eef8b9ad51f)
