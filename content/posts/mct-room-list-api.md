---
title: MinecraftConnectTool RoomList API 接入文档
description: MCTListServer 的房间管理、玩家心跳、关房确认与模组清单校验，附 Windows CMD 调用示例。
category: Minecraft 联机
date: 2026-11-26
tags: MCT, RoomList API, HTTP, 模组校验
---

MinecraftConnectTool 通过 MCTListServer 登记房间和玩家。开房时服务端会登记房主，加入后客户端通过心跳维护在线状态。模组校验走独立接口，用来比较房主和加入方的版本与模组清单。

## 服务地址和响应格式

本机示例使用 `http://127.0.0.1:30148`。正文中的主机和 IP 示例统一使用 `127.0.0.1`。开发环境可访问 `/swagger` 查看接口，MCT 客户端可以通过 `MCT_MOD_CHECK_URL` 单独配置模组校验的基础地址。

**官方服务地址**

> [!MCT-SERVICE-ADDRESS]

JSON 请求使用 `Content-Type: application/json`，字段名采用 camelCase。房间提示码区分大小写。将 `{roomCode}` 和 `{playerId}` 放进 URL 时，分别按路径段进行编码。

房间与玩家接口通常返回 `success`、`message` 和 `data`，后两项可以为 `null`。

```json
{
  "success": true,
  "message": null,
  "data": null
}
```

参数绑定失败时，框架可能返回 Problem Details。模组校验按 HTTP 状态码判断，只有比对成功时才返回结果 JSON。`204` 和 `HEAD` 的响应体为空。

## 房间管理

- **`POST /api/room/create`** 接收 `{"roomCode":"abc","version":"0.0.7.071"}`。`version` 可省略，默认空字符串。成功返回 `200`，`data` 包含 `roomCode`、`hostPlayerId` 和 `closeToken`。房间码为空或已存在时返回 `400`，创建失败时返回 `500`。
- **`GET /api/room/{roomCode}`** 无请求体。成功返回 `200`，`data` 为房间对象。找不到房间时返回 `404`。
- **`POST /api/room/{roomCode}/close`** 无请求体，通过 `X-Room-Close-Token` 传入创建响应中的 `closeToken`。成功返回 `200`，`message` 为 `房间已关闭`，`data` 为 `null`。令牌不匹配时返回 `403`，房间不存在时返回 `404`。

房主 IP 取自 HTTP 连接。创建时服务端会登记房主玩家，房主也要用 `hostPlayerId` 发送心跳。`closeToken` 只在创建成功时返回，下面的 ID 和令牌均为示例。

```json
{
  "success": true,
  "message": "房间创建成功",
  "data": {
    "roomCode": "abc",
    "hostPlayerId": "62990f70ac3043b6bec27a8714525011",
    "closeToken": "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"
  }
}
```

房间对象包含 `id`、`roomCode`、`hostIp`、`createdAt`、`lastActivity`、`status` 和 `players`。`status` 为 `0` 时表示活跃，为 `1` 时表示已关闭。关闭后房间会从查询中移除。`players` 包含房主与已登记成员，只查询在线成员时，使用 `/player/list`。

服务端只有在关房请求携带正确的 `X-Room-Close-Token` 时，才会为房客保留 `ROOM_CLOSED` 确认。

## 玩家管理

下列路径均以 `/api/room/{roomCode}/player` 开头。

- **`POST /join`** 接收 `{"nickname":"Steve","port":25565,"version":"0.0.7.071"}`。恢复会话时可附带 `previousPlayerId`。成功返回 `200`，`data` 为玩家对象。昵称为空、超过 20 字符或被在线玩家使用时返回 `400`，房间不存在时返回 `404`，旧会话已确认关闭时返回 `410`，加入失败时返回 `500`。
- **`GET /list`** 无请求体。成功返回 `200`，`data` 为在线玩家数组，包含在线的房主。房间不存在时返回 `404`。
- **`POST /kick`** 接收 `playerId`，兼容旧字段 `reason`。成功返回 `200`，`data` 为 `null`，被踢玩家下次心跳会收到 `KICKED`。玩家不存在或已离线时返回 `400`，房间不存在时返回 `404`，操作失败时返回 `500`。
- **`POST /{playerId}/leave`** 无请求体。成功返回 `200`，玩家被标记为离线，`data` 为 `null`。玩家不存在时返回 `400`，房间不存在时返回 `404`。
- **`POST /heartbeat`** 接收 `{"playerId":"..."}`。正常返回 `200`，`message` 为 `心跳更新成功` 或 `KICKED`，`data` 为 `null`。玩家不存在时返回 `400`，房间不存在时返回 `404`，当前会话已确认关闭时返回 `410`。

加入时以路径里的 `roomCode` 为准。`port` 和 `version` 可省略，默认分别为 `0` 和空字符串。`ipAddress` 取自 HTTP 连接，心跳和离开接口使用加入响应里的 `data.id`。

```json
{
  "id": "a6c0fdfe4a4841c8b1cbda3a25baf239",
  "nickname": "Steve",
  "ipAddress": "127.0.0.1",
  "port": 25565,
  "joinedAt": "2026-11-22T10:00:00Z",
  "lastHeartbeat": "2026-11-22T10:00:00Z",
  "status": 0,
  "processId": null,
  "version": "0.0.7.071"
}
```

玩家 `status` 为 `0` 时在线，为 `1` 时离线，为 `2` 时已被踢出。正常心跳会刷新房间活跃时间，也能将离线玩家恢复为在线。MCT 客户端正常每 5 秒发送一次心跳，进入恢复模式后每 30 秒探测一次。服务端每分钟检查一次，将超过 90 秒未发心跳的玩家标记为离线，并回收超过 10 分钟无活动的房间。

### 如何识别房主主动关房

房主使用正确令牌关房后，服务端会为已登记的房客保留 30 分钟关闭确认。房客使用旧 `playerId` 发心跳，或将其作为 `previousPlayerId` 恢复加入时，会收到以下 `410 Gone` 响应。

```json
{
  "success": false,
  "message": "ROOM_CLOSED",
  "data": {
    "roomCode": "abc",
    "playerId": "a6c0fdfe4a4841c8b1cbda3a25baf239"
  }
}
```

客户端应同时核对 HTTP `410`、`success: false`、`message: "ROOM_CLOSED"` 以及当前会话的房间码和玩家 ID，再退出联机。遇到普通 `404`、掉线或心跳超时，继续走原有的恢复流程。

## 模组校验

基础路径为 `/api/mod-check/{mode}/{key}`。`mode` 使用小写的 `p2p`、`link` 或 `et`。房主和加入方按同一规则准备哈希输入。

- **P2P、Link** 去掉房间提示码首尾的空白，保留大小写。
- **EasyTier** 从提示码里解析 `Identifier.Name` 和 `Identifier.Secret`，拼成 `Name/Secret`。解析失败时，当前客户端使用去掉首尾空白的原提示码。

对输入的 UTF-8 字节计算 SHA-256，将结果编码为 64 个十六进制字符。服务端接受大小写两种哈希表示。示例房间 `abc` 对应 `BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD`。

房主每次开房生成 32 字节随机数，编码为 64 个十六进制字符，作为 `X-Mod-Check-Owner`。同一房间的 `prepare`、`PUT` 和 `DELETE` 使用同一个值，大小写也保持一致。房间关闭使用独立的 `closeToken`。

### 接口与状态码

以下以 `/api/mod-check/{mode}/{key}` 为基础路径。

- **`HEAD` 基础路径** 无请求体，无需房主请求头。`204` 表示清单可用。`404` 表示暂不可用，如果同时带有 `X-Mod-Check-Status: preparing`，说明房主正在准备清单。
- **`POST /prepare`** 携带 `X-Mod-Check-Owner`，无请求体。`204` 表示已登记准备状态或清单已经可用。
- **`PUT` 基础路径** 携带 `X-Mod-Check-Owner` 和 JSON 房主清单。成功发布或续传时返回 `204`。
- **`POST /compare`** 接收加入方的 JSON 清单，无需房主请求头。`200` 返回比对结果，`400` 表示清单不合法，`404` 表示路径参数无效或房主清单不可用。
- **`DELETE` 基础路径** 携带 `X-Mod-Check-Owner`，无请求体。删除成功或记录已不存在时返回 `204`，请求头缺失、格式不对或与记录不匹配时返回 `401`，路径参数无效时返回 `404`。

`prepare` 和 `PUT` 也可能返回 `401`（房主请求头缺失或格式错误）、`404`（路径无效，或 P2P、Link 未登记房间）、`409`（记录已被另一个房主令牌占用）和 `503`（清单存储容量已满）。`PUT` 与 `compare` 的请求体上限为 2 MiB，非法清单返回 `400`。

### 清单格式

房主与加入方使用同一个格式。`mods` 必填，可以是空数组，最多 1024 项。每项的 `fileName` 必须以 `.jar` 结尾，最长 255 字符，不含路径分隔符或控制字符，同一清单内不能重名。`md5` 为 32 个十六进制字符。

未知版本字段可以省略或设为 `null`。版本值最长 128 字符，支持 ASCII 字母、数字以及 `. - _ +`。`loader` 支持 `vanilla`、`forge`、`neoforge`、`fabric` 和 `quilt`。请求体只需清单字段，无需本机路径、账号凭据、完整启动参数或 JAR 文件本体。

```json
{
  "gameVersion": "1.21.1",
  "mods": [
    {"fileName": "example-mod.jar", "md5": "5D41402ABC4B2A76B9719D911017C592"}
  ],
  "loader": "fabric",
  "loaderVersion": "0.16.9",
  "fmlVersion": null,
  "mcpVersion": null,
  "neoFormVersion": null,
  "javaVersion": "21.0.5"
}
```

### 比对结果

比对成功返回 `200`。下面的例子中，加入方的加载器版本和同名文件的 MD5 都与房主不同。

```json
{
  "hostCount": 1,
  "guestCount": 1,
  "versions": [
    {"field": "minecraft", "host": "1.21.1", "guest": "1.21.1", "status": "match"},
    {"field": "loader", "host": "fabric", "guest": "fabric", "status": "match"},
    {"field": "loaderVersion", "host": "0.16.9", "guest": "0.16.8", "status": "different"},
    {"field": "fml", "host": null, "guest": null, "status": "unknown"},
    {"field": "mcp", "host": null, "guest": null, "status": "unknown"},
    {"field": "neoForm", "host": null, "guest": null, "status": "unknown"},
    {"field": "java", "host": "21.0.5", "guest": "21.0.5", "status": "match"}
  ],
  "matched": [],
  "missing": [],
  "extra": [],
  "changed": [
    {
      "fileName": "example-mod.jar",
      "hostMd5": "5D41402ABC4B2A76B9719D911017C592",
      "guestMd5": "7D793037A0760186574B0282F2F435E7",
      "guestFileName": null
    }
  ]
}
```

`matched` 和 `missing` 使用房主的文件名与 MD5。`extra` 使用加入方的文件名与 MD5。即使文件改过名，只要 MD5 相同，仍可判为一致。

`changed.fileName` 使用房主的文件名。以 Fabric API 为例，如果双方各有一个可识别的同类候选，即使文件名不同也会配对，并在 `guestFileName` 中返回加入方的文件名。缺少可配对候选时，加载器 API 仍可能归入 `changed`，加入方的字段可以为 `null`。

### 调用顺序

1. P2P 和 Link 的房主先创建房间记录。EasyTier 使用原有房间列表，可以直接调用模组校验接口。
2. 房主可先调用 `prepare` 登记准备状态，该状态保留 2 分钟。扫描结束后使用 `PUT` 发布清单。
3. 加入方用 `HEAD` 查询，收到 `204` 后把本地清单提交到 `compare`。如果 `404` 带有 `preparing`，可以稍后重试。
4. 房主退出或撤销授权时可以调用 `DELETE`。P2P 和 Link 的清单随房间记录释放。EasyTier 每次成功 `PUT` 会将清单有效期续到 1 小时，MCT 客户端正常每 5 分钟续传。

房主清单暂存在服务端内存中。加入方清单用于当次比对，服务重启后需要重新登记房间并发布清单。

## Windows CMD 调用示例

下面用本机 P2P 房间 `abc` 串起完整流程。创建成功后，用 `data.closeToken` 给 `MCT_HOST_TOKEN` 赋值。玩家加入后，用 `data.id` 给 `MCT_GUEST_ID` 赋值。`MCT_MOD_OWNER` 是示例值，实际客户端每次开房都要重新生成。

先创建房间并查询房间记录。

```bat
set "MCT_BASE=http://127.0.0.1:30148"
set "MCT_ROOM=abc"
set "MCT_MOD_KEY=BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD"
set "MCT_MOD_OWNER=00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"

curl.exe -i -H "Content-Type: application/json" -d "{\"roomCode\":\"abc\",\"version\":\"0.0.7.071\"}" "%MCT_BASE%/api/room/create"
set "MCT_HOST_TOKEN=REPLACE_WITH_CLOSE_TOKEN"
curl.exe -i "%MCT_BASE%/api/room/%MCT_ROOM%"
```

房主发布清单后，加入方查询清单状态，提交自己的清单。

```bat
curl.exe -i -X POST -H "X-Mod-Check-Owner: %MCT_MOD_OWNER%" "%MCT_BASE%/api/mod-check/p2p/%MCT_MOD_KEY%/prepare"
curl.exe -i -X PUT -H "X-Mod-Check-Owner: %MCT_MOD_OWNER%" -H "Content-Type: application/json" -d "{\"mods\":[],\"gameVersion\":\"1.21.1\"}" "%MCT_BASE%/api/mod-check/p2p/%MCT_MOD_KEY%"
curl.exe -I "%MCT_BASE%/api/mod-check/p2p/%MCT_MOD_KEY%"
curl.exe -i -H "Content-Type: application/json" -d "{\"mods\":[],\"gameVersion\":\"1.21.1\"}" "%MCT_BASE%/api/mod-check/p2p/%MCT_MOD_KEY%/compare"
```

加入房间后，使用返回的玩家 ID 维护心跳和退出。

```bat
curl.exe -i -H "Content-Type: application/json" -d "{\"nickname\":\"Steve\",\"port\":25565,\"version\":\"0.0.7.071\"}" "%MCT_BASE%/api/room/%MCT_ROOM%/player/join"
set "MCT_GUEST_ID=REPLACE_WITH_GUEST_ID"
curl.exe -i "%MCT_BASE%/api/room/%MCT_ROOM%/player/list"
curl.exe -i -H "Content-Type: application/json" -d "{\"playerId\":\"%MCT_GUEST_ID%\"}" "%MCT_BASE%/api/room/%MCT_ROOM%/player/heartbeat"
curl.exe -i -X POST "%MCT_BASE%/api/room/%MCT_ROOM%/player/%MCT_GUEST_ID%/leave"
```

房主停止联机时可以先撤销清单，再关闭房间。

```bat
curl.exe -i -X DELETE -H "X-Mod-Check-Owner: %MCT_MOD_OWNER%" "%MCT_BASE%/api/mod-check/p2p/%MCT_MOD_KEY%"
curl.exe -i -X POST -H "X-Room-Close-Token: %MCT_HOST_TOKEN%" "%MCT_BASE%/api/room/%MCT_ROOM%/close"
```
