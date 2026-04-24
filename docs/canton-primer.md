# Canton Network 入门总结

> 面向 CantonKit 贡献者的快速上手笔记。内容整理自官方文档 https://docs.digitalasset.com/，聚焦开发 SDK 时会用到的核心概念。

---

## 1. 基本概念与 Ledger 接入

### 网络架构：一个"网络的网络"

Canton 不是传统意义上"所有人复制所有数据"的单链结构，而是由多个相对独立的**子账本**通过**同步器（synchronizer）**连接组成的联邦网络。

| 角色 | 类比以太坊 | 作用 |
|---|---|---|
| **Validator 节点** | 全节点 | 存储合约数据、执行 Daml 代码、为它托管的 party 服务 |
| **Synchronizer**（Global Synchronizer / GSF） | L1 共识 | 在节点间分发加密消息、协调跨节点交易 |
| **Party** | EOA/账户地址 | 账本上的身份，交易权限和隐私都绑定到 party |
| **Daml 合约** | Solidity 合约 | 定义数据结构（template）和可执行动作（choice） |
| **Active Contract** | UTXO | 一个尚未被消费的合约实例；交易消费旧 contract、产生新 contract |

**关键区别**：Canton 是 **UTXO 模型**，不是 account 模型。每笔交易 archive（归档）若干旧 active contract 并 create 若干新的。`contractId` 就像 UTXO 的 outpoint。

### 接入 Ledger 的两条 API 路径

1. **Ledger API (LAPI) / JSON Ledger API** — 直接连 validator 节点读写自己 party 的数据。需要节点的 HTTP URL（如 `http://YOUR_NODE_JSON_API/v2/...`）和 auth token。适合节点运营方、交易所集成。
2. **Wallet Gateway (Dapp SDK)** — 不直连节点，而是通过钱包做中介。dApp 前端只拿到一个 gateway URL，所有需要签名的动作由钱包转发到用户的 validator。这是浏览器 dApp 的标准路径，也是 CantonKit 包装的那层。

**核心隐私原则**：交易数据**按需分发**（need-to-know basis）。一个 party 只能看到它参与的交易的子树。没有"全链 RPC"能拉到全网数据——要读谁的数据，必须连托管那个 party 的 validator。

---

## 2. Canton Gateway URL 相关概念

**Gateway URL** 就是 CIP-0103 定义的 **Wallet Gateway 的 JSON-RPC 端点**。它是 dApp 和钱包之间的桥。

### 它在整个栈里的位置

```
┌─────────────────────────────────┐
│  dApp 前端 (使用 @cantonkit/react 或 dapp-sdk)
├─────────────────────────────────┤
│  Wallet Gateway (Canton Wallet Gateway)
│  这是一个 HTTP/SSE 服务，暴露 JSON-RPC       ← gatewayUrl 指向这里
├─────────────────────────────────┤
│  Wallet Kernel (用户的钱包，持有私钥)
├─────────────────────────────────┤
│  Validator 节点 (Ledger API / gRPC)        ← ledgerUrl 指向这里（可选）
├─────────────────────────────────┤
│  Synchronizer（Global Synchronizer）
└─────────────────────────────────┘
```

### 配置层面涉及的几类 URL

| URL 类型 | 指向什么 | 什么时候用 |
|---|---|---|
| `gatewayUrl` | Wallet Gateway JSON-RPC（常见形如 `https://gateway.example.com/api/json-rpc`） | dApp 主入口；`@canton-network/dapp-sdk`/CantonKit 用它 |
| `ledgerUrl` (JSON Ledger API) | validator 节点的 REST API | 直接查询 active contracts、交易流；服务端应用 |
| `validatorApiUrl` | validator 应用层的 admin API | 创建 party、管理拓扑；高级用途 |
| `registryUrl` | Token Standard registry (如 `scan.sv-1.global.canton.network...`) | 查询 Amulet 等代币的元数据、instrument admin |
| `scanProxyUrl` | 只读的扫描代理 API | 读全网公开数据（类似 block explorer） |

你在 CantonKit 里配 `gatewayUrl` 就够了——dApp 通过它走钱包，钱包替你 proxy 到节点。只有你想绕过钱包直接开 ledger WebSocket 时才需要 `ledgerUrl` + `auth`。

### 多种 adapter 的接入方式（dapp-sdk 层）

- **RemoteAdapter** — 远程 gateway（HTTP/SSE），需要 `rpcUrl`
- **ExtensionAdapter** — 浏览器扩展钱包（postMessage）
- **InjectedAdapter** — `window.canton` 注入

这解释了为什么 CantonKit 的 config 里 `gatewayUrl` 是必填，而 `additionalAdapters` 是可选——默认的 RemoteAdapter 用 `gatewayUrl` 就能工作。

---

## 3. 发起交易的具体流程

Canton 交易遵循 **prepare → sign → execute** 三阶段模型，与以太坊"构造 tx、本地签名、广播"表面类似，但语义不同。

### 完整流程（以代币转账为例）

```
1. 构造命令 (build command)
   ─ 选择操作：CreateCommand / ExerciseCommand / ExerciseByKeyCommand
   ─ 例：转账是 exerciseChoice('Transfer', args) on 某个 Amulet contract

2. prepareSubmission
   ─ 节点把命令编译成 PreparedTransaction（含层级结构、各方签名要求）
   ─ 返回 preparedTransactionHash（blake2b 哈希）
   ─ 此时尚未上链

3. 钱包签名
   ─ 钱包对 preparedTransactionHash 用 party 私钥签名
   ─ dApp 可以请求钱包先 decodePreparedTransaction 展示内容给用户审阅

4. executeSubmission
   ─ 把 PreparedTransaction + 签名 + 公钥一起提交回节点
   ─ 节点递交给 synchronizer
   ─ synchronizer 把消息加密分发给相关 party 的节点（need-to-know）

5. 等待结果（可选）
   ─ prepareSignExecuteAndWaitFor：阻塞直到拿到 completion
   ─ 或异步订阅 transaction stream，通过 updateId 关联
```

### CantonKit 里对应的抽象

| Canton 原语 | CantonKit 封装 |
|---|---|
| `prepareSubmission` + `executeSubmission`（两步） | `prepareExecute`（钱包内部完成两步）|
| 上面 + 等待 completion | `prepareExecuteAndWait` / `submitAndWait` |
| 查询 active contracts | `queryACS<T>` |
| 交易流订阅 | `subscribeToTransactions` / `useTransactionStream` |

**重要**：`dedupId` (`v4()` uuid) 必须唯一——它是幂等键，重放同一个 dedupId 不会产生重复执行。CantonKit 的 `submitAndWait` 默认用 `crypto.randomUUID()` 自动生成。

### External Party 与"链外签名"

Canton 支持**外部 party**：它的私钥保存在链外（用户设备），节点不持有。这和以太坊的"钱包 = 私钥 + RPC 代理"很像，但 Canton 更严谨——prepare 阶段产生的交易哈希可以在**完全离线的设备上重算和签名**（文档里 `prepareSignExecuteAndWaitFor` 的 offline/online 分离示例就是这个）。

---

## 4. 和以太坊的主要差别

| 维度 | 以太坊 | Canton |
|---|---|---|
| **账本模型** | Account（余额字段直接改） | UTXO（active contract 被消费/创建）|
| **数据可见性** | 全公开，所有 full node 保存全部状态 | 按需分发，只有交易参与方能看到 |
| **全链查询** | 任一 RPC 节点都能查全部 | 必须连**托管目标 party 的节点**才能查那个 party 的数据 |
| **智能合约语言** | Solidity（以执行为中心）| Daml（以权限/workflow 为中心，内建 signatory/observer 角色）|
| **身份** | EOA（256-bit 地址） | Party（字符串 ID，含节点命名空间） |
| **Gas/费用** | 每笔交易烧 gas | 不烧 gas；每笔交易由 synchronizer 排序，Canton Coin 用作网络费 |
| **共识** | 单一 L1，所有节点共识相同状态 | 每笔交易只由相关方+synchronizer 共识；同步器可以多个（network-of-networks）|
| **节点职责** | 全节点要存/验全网状态 | Validator 只存自己 party 的状态 → 节点更轻 |
| **交易结构** | 平坦（tx 内的 internal call 不暴露结构）| 层级化（choice 嵌套调用形成 transaction tree，子树按 party 可见性裁剪）|
| **签名模型** | 单签（tx 由 from 地址签名）| 多方签名（template 可要求多个 signatory party 共同授权）|
| **钱包接口** | EIP-1193 (`window.ethereum`) | CIP-0103 (`window.canton` / JSON-RPC gateway)，受以太坊启发但独立 |
| **地址/Party 格式** | `0x...` 40 字符 | `name::hash`（如 `Alice::1220ab...`），hash 绑定到托管节点 |
| **事件流** | `eth_subscribe` (logs) | JSON Ledger API `/v2/updates/flats` WebSocket，或钱包 `onTxChanged` |

### 几个最容易踩坑的认知偏差

1. **"我能不能像 etherscan 那样看全网？"** — 不能。Canton 的隐私模型决定了没有全局观测者。要看你的交易，连你的节点；要看代币发行方的公开数据（如 Amulet），连它的 scan proxy。

2. **"transfer 会直接改余额吗？"** — 不会。它会 archive 掉 sender 的 Holding contract，create 新的 sender Holding（找零）和 receiver Holding。语义上和 BTC 转账一样要"拆 UTXO"。

3. **"合约地址是什么？"** — 没有合约地址。**template ID**（如 `#MyApp:Counter:Counter`）标识合约的"类"；**contract ID** 标识某个具体实例。每次 create 都产生新的 contract ID。

4. **"签名的是什么？"** — 不是 tx bytes，是 **prepared transaction 的层级哈希**（blake2b）。这个设计让签名设备可以纯离线重算哈希来验证内容，不用信任在线节点。

5. **"Party 就是公钥吗？"** — 不一定。Party 可以是节点内部 party（私钥在节点）或 external party（私钥在用户设备）。外部钱包 dApp 场景基本都是 external party。

---

## 深入：为什么 `subscribeToTransactions` 有 wallet/ledger 两个 source？

这两个 source 代表**订阅交易事件的两条完全不同的数据通路**，各自的可信边界、延迟、权限模型都不一样。CantonKit 让调用方选，是因为没有一个选择能覆盖所有场景。

### 两条通路的差别

```
source: 'wallet'                    source: 'ledger'
────────────────                    ────────────────
dApp → DappClient.onTxChanged()     dApp → WebSocket /v2/updates/flats
         │                                     │
         ▼                                     ▼
    Wallet Gateway                        Validator 节点 (LAPI)
         │                                     │
         ▼                                     │
    Wallet Kernel                              │
         │                                     │
         ▼                                     │
    Validator 节点                             │
         (事件由钱包推回 dApp)                  (事件直接推给 dApp)
```

| 维度 | `wallet` source | `ledger` source |
|---|---|---|
| **数据来源** | 用户连接的钱包转发 | dApp 直接开 WebSocket 到 JSON Ledger API |
| **需要什么** | 只要 `gatewayUrl`（用户已连接钱包） | 需要 `ledgerUrl` + `auth` token |
| **谁能看到的事件** | 只有**当前连接 party** 相关的 tx | 取决于 auth token 的 party 权限（可跨 party） |
| **过滤** | 客户端过滤（事件已来了再筛 templateId） | 服务端过滤（filter 下发到节点，按 party + templateId 裁剪） |
| **延迟 / 保真度** | 受钱包实现限制（可能批处理、节流、丢事件） | 直连节点，完整的 transaction tree |
| **隐私边界** | 天然受钱包控制，dApp 拿不到 party 以外的数据 | dApp 必须自己管好 token 范围 |
| **SSR / 无浏览器环境** | 需要浏览器（钱包在浏览器） | 可以在 Node / 服务端跑 |
| **适用场景** | 浏览器 dApp 的常规订阅 | 服务端索引器、后台 worker、需要高保真事件的 dApp |

### 每个 source 什么时候是"对的选择"

**用 `source: 'wallet'`（CantonKit 的默认）**

这是 90% 浏览器 dApp 场景的正确选择：

- 你只关心**当前登录用户**的交易
- 你不想额外管理一套 ledger 认证（避免把长期 token 塞进浏览器）
- 你信任钱包提供方的事件推送质量
- 你想让 dApp 在用户切钱包时自动跟随（钱包换了，事件源自动换）

核心价值：**永远不会越过用户的隐私边界**。钱包不会给你 party 以外的数据，所以安全。

**用 `source: 'ledger'`**

几种典型场景：

1. **服务端应用** — 后端索引器、webhook 触发器、交易监控。后端没有浏览器，连不了钱包；但有自己的 ledger 凭证，可以直连。
2. **高保真需求** — 钱包可能节流或批处理 `onTxChanged`，导致 dApp 收不到完整的层级事件（create、archive、exercise 子树）。`/v2/updates/flats` 直接推完整的 `LedgerTxEvent`，包含每个事件的 `templateId`、`contractId`、`kind`。
3. **多 party 订阅** — dApp 为多个 party 同时服务（比如做市商、交易所前台、托管方）。钱包只给你当前连接的 party；ledger source 用一个 token 覆盖多个 party。
4. **离线时想补交易历史** — 钱包可能只推"当下"的事件；ledger WebSocket 可以带 `beginOffset` 从历史补读，确保不漏。
5. **对钱包不信任** — dApp 是交易所、托管方这种需要独立账本视图的角色，不愿把观测完全交给第三方钱包实现。

### CantonKit 里的实际表现

```typescript
// 浏览器 dApp，默认用户场景
useTransactionStream({
  filter: { templateIds: [COUNTER] },
})
// 等价于 source: 'wallet'，CantonKit 从 CantonProvider 的 dappClient.onTxChanged 拉事件

// 服务端 / 高保真场景
useTransactionStream({
  source: 'ledger',
  filter: { parties: ['Alice::...', 'Bob::...'], templateIds: [COUNTER] },
})
// CantonKit 用 createLedgerStream 开 WS 到 ledgerUrl，带指数退避
// 需要 <CantonProvider config={{ gatewayUrl, ledgerUrl, auth: { token } }}>
```

另一个设计细节：`filter.parties` 在 wallet source 下是**无效字段**（钱包自己决定你能看谁），但在 ledger source 下**下发到服务端**生效。设计文档里我们专门说明了这点——避免开发者以为"传了 parties 就能跨 party 看事件"。

### 如果只能选一个会怎样？

- **只保留 wallet** — 服务端应用完全用不了 CantonKit；高保真场景被钱包行为限制；多 party 场景做不到。
- **只保留 ledger** — 浏览器 dApp 必须自己管 ledger auth token，安全风险上升（token 在前端）；失去"跟随钱包连接状态"的 DX。

两个都留，按场景切换，是最符合 Canton 隐私模型的折中——钱包是为"用户代理"设计的，ledger API 是为"节点代理"设计的，两种代理在 Canton 里是不同的信任身份。

---

## 延伸阅读

官方文档按角色分了几条路径，推荐顺序：

1. **Canton Network Overview** — 架构概念 https://docs.digitalasset.com/integrate/devnet/canton-network-overview/
2. **Signing Transactions from dApps** — 前端签名流程 https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/
3. **Preparing and Signing Transactions** — 详细的 prepare/sign/execute 示例 https://docs.digitalasset.com/integrate/devnet/preparing-and-signing-transactions/
4. **Finding and Reading Data** — ACS/交易流查询 https://docs.digitalasset.com/integrate/devnet/finding-and-reading-data/
5. **Exchange Integration > Architecture** — UTXO 模型最清楚的对照表 https://docs.digitalasset.com/integrate/devnet/exchange-integration/architecture

## 三个要内化的核心概念

开发 CantonKit 或任何 Canton dApp，核心要内化的是三件事：

1. **UTXO 语义** — 交易消费/产生 active contracts，不改字段
2. **Party 级别隐私** — 没有全局视图，数据随 party 分发
3. **prepare-sign-execute 三段式** — 签名的是哈希，不是 tx bytes

把这三个想清楚，SDK 里的 API 形状就都"讲得通"了：
- 为什么 `submitAndWait` 要返回 `updateId`？因为不能靠"block number" 索引
- 为什么 `queryACS` 要传 `parties`？因为没有全局视图
- 为什么 `subscribeToTransactions` 有 wallet/ledger 两个 source？一个走钱包隐私边界，一个直连节点

---

**文档来源**:
- [Canton Network Overview](https://docs.digitalasset.com/integrate/devnet/canton-network-overview/index)
- [Exchange Integration Architecture](https://docs.digitalasset.com/integrate/devnet/exchange-integration/architecture)
- [Signing Transactions from dApps](https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index)
- [Preparing and Signing Transactions](https://docs.digitalasset.com/integrate/devnet/preparing-and-signing-transactions/index)
- [Wallet SDK Configuration](https://docs.digitalasset.com/integrate/devnet/wallet-sdk-configuration/index)
- [Finding and Reading Data](https://docs.digitalasset.com/integrate/devnet/finding-and-reading-data/index)
