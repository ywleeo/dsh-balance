# dsh-balance

在 dsh Web 对话底部显示 DeepSeek 账户余额的精简插件 —— 一行小字，排在**会话数据（token 统计）前面**。

## 截图

余额与 token 统计同一行显示（`¥192.04 ⟳` 在最前，无多余文字）：

![dsh-balance 余额显示](assets/screenshots/balance.png)

## 特性

- ✅ 挂在 `conversation.composer.dock`（`order: -1`），显示在 token 统计行（`order 0`）前面
- ✅ 与 StatsLine 同视觉族：12px / label-tertiary / 居中
- ✅ 刷新：挂载时 + 每 5 分钟轮询 + 点击 ⟳ 手动刷新
- ✅ 计费高峰着色：按官方口径（北京时间 周一至周五 09:00–12:00 / 14:00–18:00 为高峰，其余空闲半价）实时判定；**高峰时余额显示橙色警示色，空闲时正常色**，悬停可见当前时段说明
- ✅ 点击余额数字在新 tab 打开官方余额/用量面板页（`platform.deepseek.com/usage`）
- ✅ API key 不出 host（客户端只 fetch 同源 JSON 路由）
- ✅ 不写会话日志、不注册投影 —— 无会话恢复污染风险
- ✅ 零构建、纯 ESM，host + 极简客户端模块

## 安装

```bash
cd ~/.dsh/profiles/web
pnpm add file:/path/to/dsh-balance   # 或 pnpm add github:ywleeo/dsh-balance
```

在 `~/.dsh/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: dsh-balance
      name: dsh-balance
```

重启 `dsh web` + 刷新页面。

## 原理

- **host 壳**（`index.js`）：不 import 任何 dsh 核心模块，运行时动态加载 `host.js` 并挂成子插件。见下节。
- **host**（`host.js`）：`/plugins/dsh-balance/balance` 路由 → 凭据服务解析 `DEEPSEEK_API_KEY`（与 llm-deepseek 同一 key 缝）→ `GET https://api.deepseek.com/user/balance` → JSON。
- **client**（`client.js`）：dock 组件 `fetch` 同源路由，挂载/每 5 分钟/点击刷新。

### 为什么要启动壳

dsh 的 loader 条目一旦激活失败，boot 的激活审计（`assertEntriesActivated`）会把整棵插件树判死、进程非零退出。dsh 核心每次升级都可能改掉插件依赖的内部接口，于是一个插件不兼容就导致 **dsh 起不来**。

启动壳把会坏的部分挪出启动路径：

- 壳不声明 `inject`，所以它的 loader 条目永远 `ACTIVE`，boot 审计永远通过；
- `host.js` 自己的 `inject: ['webServer']` 在子 fiber 上照常生效，`webServer` 没就绪就先挂起，就绪后自动激活；
- `host.js` 导入失败、同步抛错、异步 reject，一律只记一条日志，插件停用，dsh 照常启动；
- 子 fiber 挂在壳下面，壳被卸载时宿主逻辑照常回收。

约束（改 `index.js` 前必读）：`package.json` 的 `main` 必须继续指向 `index.js`，loader 条目名必须继续是裸包名 `dsh-balance`。客户端那一半靠 `dsh.client` + `exports["./client"]` 从 loader 条目名反查包，条目名换成子路径会导致客户端半边再也不被扫描到。

升级改坏 `host.js` 时的预期表现：dsh 正常启动，日志出现

```
[dsh-balance] host.js 加载失败，插件功能已停用，dsh 继续运行。原因：…
```

对话底部的余额小字消失，其余功能不受影响。照着日志改 `host.js` 即可，`index.js` 不用动。

## 维护

```bash
node test-shell.mjs # 启动壳契约校验：host.js 坏掉时不抛、只报告
pnpm run sync       # 同步到本机已安装的 profile 拷贝
pnpm run release    # 升版本 + 同步 + commit + tag + push
```

生效方式：`index.js` / `host.js` 改动 → 重启 dsh web；`client.js` 改动 → 刷新页面。

## License

MIT
