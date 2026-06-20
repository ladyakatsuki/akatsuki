# Socket 事件协议文档

本文档定义多人联机跑团平台的 Socket.IO 实时通信协议，涵盖房间、角色、骰子、战斗、地图、故事、日志七类事件。

## 目录

- [连接与鉴权](#连接与鉴权)
- [通用约定](#通用约定)
- [房间事件（room:\*）](#房间事件room)
- [角色事件（character:\*）](#角色事件character)
- [骰子事件（dice:\*）](#骰子事件dice)
- [战斗事件（combat:\*）](#战斗事件combat)
- [地图事件（map:\*）](#地图事件map)
- [故事事件（story:\*）](#故事事件story)
- [日志事件（log:\*）](#日志事件log)

## 连接与鉴权

### 连接地址

Socket.IO 服务地址由前端环境变量 `VITE_SOCKET_URL` 配置，默认 `http://localhost:3000`。

### 鉴权方式

客户端连接时需在 `handshake.auth` 中提供 `roomCode` 与 `playerId`：

```typescript
import { io } from 'socket.io-client';

const socket = io(VITE_SOCKET_URL, {
  auth: {
    roomCode: 'ABCD1234',
    playerId: 'player_xxx',
  },
});
```

### 鉴权流程

服务端 `auth` 中间件校验：

1. 读取 `handshake.auth` 中的 `roomCode` 与 `playerId`
2. 校验房间码存在（`roomRepository.findByCode`）
3. 校验玩家在该房间内（DM 直接放行，玩家需在 `room.players` 列表中）
4. 校验通过后将 `roomId`/`playerId`/`role`/`playerName` 挂载到 `socket.data`

校验失败则拒绝连接（`callback(new Error('...'))`）。

### 角色权限

| 角色 | 说明 |
| --- | --- |
| `dm` | 房间创建者，拥有全部权限（战斗、地图管理、故事推进等） |
| `player` | 普通玩家，仅能操作自己的角色、掷骰、移动自己的 Token |

## 通用约定

### 事件方向

| 标记 | 含义 |
| --- | --- |
| C→S | 客户端发送，服务端接收 |
| S→C | 服务端发送，客户端接收 |

### 应答（Ack）机制

C→S 事件大多支持 ack 应答，签名格式：

```typescript
ack: (res: SocketAck<T>) => void
```

其中 `SocketAck<T>` 定义：

```typescript
interface SocketAck<T = unknown> {
  ok: boolean;       // 是否成功
  error?: string;    // 失败时的错误信息
  data?: T;          // 成功时的返回数据
}
```

### 广播范围

| 标记 | 含义 |
| --- | --- |
| 全房间 | 广播给房间内所有连接（含发送者） |
| 房间内其他人 | 广播给房间内除发送者外的连接 |
| 仅 DM + 掷骰者 | 暗骰场景，仅 DM 与掷骰者收到 |

---

## 房间事件（room:*）

### C→S 事件

#### `room:join`

加入 Socket.IO 房间。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | `{ roomId: string }` |
| Ack | `SocketAck` |

触发：向加入者发送 `room:state`，向房间内其他人广播 `room:playerJoined`。

#### `room:leave`

离开 Socket.IO 房间。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | 无 |
| Ack | `SocketAck` |

触发：向房间内其他人广播 `room:playerLeft`，更新在线状态为 false。

#### `room:kick`

DM 踢出玩家。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `{ playerId: string }` |
| Ack | `SocketAck` |

说明：DM 不能踢出自己。触发：向被踢者发送 `room:playerKicked` 并断开其连接，向房间内其他人广播 `room:playerLeft`。

#### `room:sync`

通用状态同步（占位，具体业务事件由各自 handler 处理）。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | `{ type: string; data: unknown }` |
| Ack | `SocketAck` |

### S→C 事件

#### `room:state`

房间完整状态（加入者收到）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `RoomStateEvent` |

```typescript
interface RoomStateEvent {
  room: Room;              // 房间信息
  characters: unknown[];   // 房间内所有角色
  onlinePlayers: string[]; // 在线玩家 ID 列表
}
```

#### `room:playerJoined`

玩家加入房间（房间内其他人收到）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ player: { id: string; name: string } }` |

#### `room:playerLeft`

玩家离开房间。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ playerId: string }` |

#### `room:playerDisconnected`

玩家断线（允许重连，不移除）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ playerId: string }` |

#### `room:playerKicked`

玩家被踢出（被踢者收到）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ playerId: string; by: string }` |

#### `room:playerReconnected`

玩家重连成功。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ playerId: string }` |

---

## 角色事件（character:*）

### C→S 事件

#### `character:create`

创建角色。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | `{ name: string; isNpc?: boolean }` |
| Ack | `SocketAck<Character>` |

触发：广播 `character:created`。

#### `character:update`

更新角色基本信息。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 角色所有者或 DM |
| 载荷 | `{ characterId: string; patch: Partial<Pick<Character, 'name'>> }` |
| Ack | `SocketAck<Character>` |

触发：广播 `character:updated`。

#### `character:updateData`

更新角色卡数据。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 角色所有者或 DM |
| 载荷 | `{ characterId: string; data: Record<string, unknown> }` |
| Ack | `SocketAck<Character>` |

触发：广播 `character:dataUpdated`。

#### `character:delete`

删除角色。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 角色所有者或 DM |
| 载荷 | `{ characterId: string }` |
| Ack | `SocketAck` |

触发：广播 `character:deleted`。

#### `character:share`

角色卡共享给房间（占位）。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 角色所有者 |
| 载荷 | `{ characterId: string }` |
| Ack | `SocketAck` |

### S→C 事件

#### `character:created`

角色已创建（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ character: Character }` |

#### `character:updated`

角色基本信息已更新（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ character: Character }` |

#### `character:dataUpdated`

角色卡数据已更新（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ characterId: string; data: Record<string, unknown> }` |

#### `character:deleted`

角色已删除（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ characterId: string }` |

---

## 骰子事件（dice:*）

### C→S 事件

#### `dice:roll`

通用掷骰。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | `DiceRollRequest` |
| Ack | `SocketAck<DiceRollResultEvent>` |

```typescript
interface DiceRollRequest {
  expression: string;        // 骰子表达式，如 '2d20kh1+5'、'1d100'
  label?: string;            // 标签，如 '攻击检定'、'SAN 检定'
  advantage?: boolean;       // DND 优势
  disadvantage?: boolean;    // DND 劣势
  bonusDice?: number;        // COC 奖金骰数量
  penaltyDice?: number;      // COC 惩罚骰数量
  target?: number;           // 目标值（COC 技能检定用）
  characterId?: string;      // 关联角色
  isHidden?: boolean;        // 是否暗骰（仅 DM 和掷骰者可见）
}
```

触发：广播 `dice:result` 与 `log:add`。暗骰仅发给 DM 和掷骰者。

#### `dice:rollSkill`

技能检定掷骰。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | `{ characterId: string; skillKey: string }` |
| Ack | `SocketAck<DiceRollResultEvent>` |

触发：广播 `dice:result` 与 `log:add`。

#### `dice:rollSan`

SAN 检定掷骰（COC 专用）。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | `{ characterId: string; sanLossExpression: string }` |
| Ack | `SocketAck<DiceRollResultEvent>` |

触发：广播 `dice:result`、`log:add`，SAN 变化时广播 `character:dataUpdated`。

### S→C 事件

#### `dice:result`

骰子结果（公开掷骰全房间广播，暗骰仅 DM 和掷骰者）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `DiceRollResultEvent` |

```typescript
interface DiceRollResultEvent {
  id: string;                // 结果 ID
  playerId: string;
  playerName: string;
  expression: string;
  label?: string;
  rolls: number[];           // 所有骰子结果
  kept: number[];            // 保留的骰子
  modifier: number;
  total: number;
  successLevel?: SuccessLevel; // COC 成功等级
  target?: number;
  characterId?: string;
  isHidden: boolean;
  timestamp: number;
  sanLossApplied?: number;   // SAN 检定实际扣除值
}
```

`SuccessLevel` 取值：`'critical' | 'extreme' | 'hard' | 'regular' | 'fumble' | null`

---

## 战斗事件（combat:*）

> 所有战斗事件均为 **DM only**。

### C→S 事件

#### `combat:start`

开始战斗。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `CombatStartPayload` |
| Ack | `SocketAck<CombatState>` |

```typescript
interface CombatStartPayload {
  participantIds: string[];    // 角色 ID 列表（玩家角色 + NPC）
  rollInitiative: boolean;     // 是否自动掷先攻
}
```

触发：广播 `combat:state` 与 `log:add`。

#### `combat:end`

结束战斗。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | 无 |
| Ack | `SocketAck` |

触发：广播 `combat:state`（`combat: null`）与 `log:add`。

#### `combat:addParticipant`

添加参与者。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `CombatAddParticipantPayload` |
| Ack | `SocketAck<CombatState>` |

```typescript
interface CombatAddParticipantPayload {
  characterId?: string;      // 关联角色 ID（NPC 可为空）
  name: string;
  type: 'player' | 'npc';
  hp: number;
  maxHp: number;
  ac?: number;
  initiative?: number;       // 手动指定先攻
}
```

触发：广播 `combat:state` 与 `log:add`。

#### `combat:removeParticipant`

移除参与者。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `{ participantId: string }` |
| Ack | `SocketAck<CombatState>` |

触发：广播 `combat:state`。

#### `combat:updateParticipant`

更新参与者状态。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `CombatUpdateParticipantPayload` |
| Ack | `SocketAck<CombatState>` |

```typescript
interface CombatUpdateParticipantPayload {
  participantId: string;
  patch: Partial<CombatParticipant>; // 如 { hp, ac, conditions, name }
}
```

触发：广播 `combat:state`，HP 变化时广播 `log:add`。

#### `combat:nextTurn`

下一回合。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | 无 |
| Ack | `SocketAck<CombatState>` |

触发：广播 `combat:state`、`combat:turn`、`log:add`。

#### `combat:prevTurn`

上一回合。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | 无 |
| Ack | `SocketAck<CombatState>` |

触发：广播 `combat:state`。

#### `combat:rollInitiative`

为指定参与者重新掷先攻。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `{ participantId: string }` |
| Ack | `SocketAck<CombatState>` |

触发：广播 `combat:state` 与 `log:add`。

### S→C 事件

#### `combat:state`

战斗状态变更（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `CombatStateEvent` |

```typescript
interface CombatStateEvent {
  combat: CombatState | null; // null 表示战斗结束
}
```

#### `combat:turn`

回合变更（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ round: number; currentTurn: number; participant: CombatParticipant }` |

---

## 地图事件（map:*）

### C→S 事件

#### `map:getState`

获取地图状态。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | 无 |
| Ack | `SocketAck<MapState | PlayerMapStateEvent>` |

说明：DM 获取完整状态，玩家获取过滤不可见 Token 的版本。

#### `map:token:move`

移动 Token。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 玩家只能移动自己的 Token，DM 可移动所有 |
| 载荷 | `MapTokenMovePayload` |
| Ack | `SocketAck` |

```typescript
interface MapTokenMovePayload {
  tokenId: string;
  x: number;
  y: number;
}
```

触发：广播 `map:token:moved`。

#### `map:token:add`

添加 Token。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `MapTokenAddPayload` |
| Ack | `SocketAck<MapState>` |

```typescript
interface MapTokenAddPayload {
  token: Omit<MapToken, 'id'>;
}
```

触发：广播 `map:state`（DM 收完整版，玩家收过滤版）。

#### `map:token:remove`

移除 Token。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `{ tokenId: string }` |
| Ack | `SocketAck` |

触发：广播 `map:token:removed`。

#### `map:token:update`

更新 Token。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `MapTokenUpdatePayload` |
| Ack | `SocketAck<MapToken>` |

```typescript
interface MapTokenUpdatePayload {
  tokenId: string;
  patch: Partial<MapToken>;
}
```

触发：广播 `map:token:updated`。

#### `map:fog:toggle`

切换迷雾。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `MapFogTogglePayload` |
| Ack | `SocketAck` |

```typescript
interface MapFogTogglePayload {
  cells: string[];        // 要切换迷雾的单元格列表
  mode: 'add' | 'remove'; // 添加或移除迷雾
}
```

触发：广播 `map:fog:updated`。

#### `map:fog:clear`

清空迷雾。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | 无 |
| Ack | `SocketAck` |

触发：广播 `map:fog:updated`（`fogCells: []`）。

#### `map:config:set`

设置地图配置。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `MapConfigPayload` |
| Ack | `SocketAck<MapState>` |

```typescript
interface MapConfigPayload {
  gridType?: GridType;       // 网格类型
  gridSize?: number;         // 网格大小
  width?: number;            // 地图宽度
  height?: number;           // 地图高度
  backgroundUrl?: string | null; // 背景图 URL
}
```

触发：广播 `map:state`。

#### `map:background:set`

设置背景图。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `{ url: string | null }` |
| Ack | `SocketAck<MapState>` |

触发：广播 `map:state`。

### S→C 事件

#### `map:state`

地图状态（全房间广播，DM 收完整版，玩家收过滤版）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `MapStateEvent` |

```typescript
interface MapStateEvent {
  mapState: MapState;
}
```

#### `map:token:moved`

Token 已移动（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ tokenId: string; x: number; y: number }` |

#### `map:token:removed`

Token 已移除（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ tokenId: string }` |

#### `map:token:updated`

Token 已更新（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ token: MapToken }` |

#### `map:fog:updated`

迷雾已更新（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `{ fogCells: string[] }` |

---

## 故事事件（story:*）

### C→S 事件

#### `story:getState`

获取故事状态。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | 已鉴权用户 |
| 载荷 | 无 |
| Ack | `SocketAck<Story | null>` |

#### `story:advance`

推进故事（跳转章节或场景）。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `StoryAdvancePayload` |
| Ack | `SocketAck<Story | null>` |

```typescript
interface StoryAdvancePayload {
  targetChapter?: number;  // 跳转到指定章节（Markdown 格式用）
  targetScene?: string;    // 跳转到指定场景（JSON 格式用）
}
```

触发：广播 `story:state` 与 `log:add`。

#### `story:event`

触发故事事件（NPC 出现、遇敌等）。

| 项 | 值 |
| --- | --- |
| 方向 | C→S |
| 权限 | **DM only** |
| 载荷 | `StoryEventPayload` |
| Ack | `SocketAck<StoryEventPayload>` |

```typescript
interface StoryEventPayload {
  type: 'chapter' | 'scene' | 'npc' | 'encounter' | 'choice';
  data: unknown;
}
```

触发：广播 `story:event` 与 `log:add`。

### S→C 事件

#### `story:state`

故事状态变更（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `StoryStateEvent` |

```typescript
interface StoryStateEvent {
  story: Story | null;
}
```

#### `story:event`

故事事件触发（全房间广播）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `StoryEventPayload` |

---

## 日志事件（log:*）

### S→C 事件

#### `log:add`

日志事件（用于显示日志面板）。

| 项 | 值 |
| --- | --- |
| 方向 | S→C |
| 载荷 | `LogEvent` |

```typescript
interface LogEvent {
  id: string;
  type: 'dice' | 'combat' | 'story' | 'system' | 'character';
  message: string;          // 可读消息
  data?: unknown;           // 原始数据
  playerId?: string;
  playerName?: string;
  timestamp: number;
  isHidden?: boolean;       // 暗骰日志
}
```

说明：日志事件由骰子、战斗、故事等事件触发时附带广播。暗骰日志仅发给 DM 和掷骰者。

---

## 事件速查表

### C→S 事件汇总

| 事件 | 权限 | 说明 |
| --- | --- | --- |
| `room:join` | 已鉴权 | 加入 Socket.IO 房间 |
| `room:leave` | 已鉴权 | 离开 Socket.IO 房间 |
| `room:kick` | DM only | 踢出玩家 |
| `room:sync` | 已鉴权 | 通用状态同步 |
| `character:create` | 已鉴权 | 创建角色 |
| `character:update` | 所有者/DM | 更新角色基本信息 |
| `character:updateData` | 所有者/DM | 更新角色卡数据 |
| `character:delete` | 所有者/DM | 删除角色 |
| `character:share` | 所有者 | 共享角色卡 |
| `dice:roll` | 已鉴权 | 通用掷骰 |
| `dice:rollSkill` | 已鉴权 | 技能检定掷骰 |
| `dice:rollSan` | 已鉴权 | SAN 检定掷骰（COC） |
| `combat:start` | DM only | 开始战斗 |
| `combat:end` | DM only | 结束战斗 |
| `combat:addParticipant` | DM only | 添加参与者 |
| `combat:removeParticipant` | DM only | 移除参与者 |
| `combat:updateParticipant` | DM only | 更新参与者 |
| `combat:nextTurn` | DM only | 下一回合 |
| `combat:prevTurn` | DM only | 上一回合 |
| `combat:rollInitiative` | DM only | 重掷先攻 |
| `map:getState` | 已鉴权 | 获取地图状态 |
| `map:token:move` | 所有者/DM | 移动 Token |
| `map:token:add` | DM only | 添加 Token |
| `map:token:remove` | DM only | 移除 Token |
| `map:token:update` | DM only | 更新 Token |
| `map:fog:toggle` | DM only | 切换迷雾 |
| `map:fog:clear` | DM only | 清空迷雾 |
| `map:config:set` | DM only | 设置地图配置 |
| `map:background:set` | DM only | 设置背景图 |
| `story:getState` | 已鉴权 | 获取故事状态 |
| `story:advance` | DM only | 推进故事 |
| `story:event` | DM only | 触发故事事件 |

### S→C 事件汇总

| 事件 | 说明 |
| --- | --- |
| `room:state` | 房间完整状态 |
| `room:playerJoined` | 玩家加入 |
| `room:playerLeft` | 玩家离开 |
| `room:playerDisconnected` | 玩家断线 |
| `room:playerKicked` | 玩家被踢 |
| `room:playerReconnected` | 玩家重连 |
| `character:created` | 角色已创建 |
| `character:updated` | 角色基本信息已更新 |
| `character:dataUpdated` | 角色卡数据已更新 |
| `character:deleted` | 角色已删除 |
| `dice:result` | 骰子结果 |
| `log:add` | 日志事件 |
| `combat:state` | 战斗状态变更 |
| `combat:turn` | 回合变更 |
| `map:state` | 地图状态 |
| `map:token:moved` | Token 已移动 |
| `map:token:removed` | Token 已移除 |
| `map:token:updated` | Token 已更新 |
| `map:fog:updated` | 迷雾已更新 |
| `story:state` | 故事状态变更 |
| `story:event` | 故事事件触发 |

## 类型定义来源

所有事件类型定义见 `backend/src/types/socket.ts`，数据模型类型见 `backend/src/types/models.ts`，规则系统类型见 `backend/src/types/rules.ts`。
