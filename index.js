/**
 * dsh-balance —— 在 dsh Web 对话底部显示 DeepSeek 账户余额。
 *
 * host 侧（本文件）：
 *  - 在 webServer 注册 /plugins/dsh-balance/balance 路由（GET）。
 *  - 从凭据服务解析 DEEPSEEK_API_KEY（与 llm-deepseek 同一 key 缝），
 *    请求 https://api.deepseek.com/user/balance，返回 JSON：
 *    { balance: "CNY 195.18（赠送 0.00 / 充值 195.18）" | null, error: string | null }
 *  - 不写会话日志、不注册投影、不碰 token meter —— 纯只读查询。
 *
 * client 侧见 client.js：注册进 conversation.composer.dock（order -1），
 * 渲染在 token 统计行（order 0）前面。
 */

export const name = 'dsh-balance'

/** 硬依赖：路由注册的前提；冷启动时按依赖顺序挂载。 */
export const inject = ['webServer']

const ROUTE_PATH = '/plugins/dsh-balance/balance'
const API_KEY_ENV = 'DEEPSEEK_API_KEY'
const BASE_URL = process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com'
const TIMEOUT_MS = 15000

/** 余额信息格式化为展示文本（多币种用 · 分隔）。 */
function formatBalance(data) {
  const infos = data.balance_infos ?? []
  if (infos.length === 0) return '（无余额信息）'
  return infos
    .map((info) => {
      const granted = info.granted_balance ?? '0'
      const topped = info.topped_up_balance ?? '0'
      return `${info.currency} ${info.total_balance}（赠送 ${granted} / 充值 ${topped}）`
    })
    .join('  ·  ')
}

/** 查询余额：返回 { balance, error }，绝不抛异常。 */
async function queryBalance(ctx) {
  try {
    const credentials = ctx.get('credentials')
    let apiKey
    if (credentials !== undefined) {
      const hit = await credentials.resolve(API_KEY_ENV)
      if (hit !== undefined) apiKey = hit.value
    }
    if (apiKey === undefined || apiKey === '') {
      return { balance: null, error: '未找到 DEEPSEEK_API_KEY，请先在 设置 → 模型 中配置 API Key' }
    }
    const response = await fetch(`${BASE_URL}/user/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      return { balance: null, error: `余额接口请求失败（HTTP ${response.status}）` }
    }
    const data = await response.json()
    if (data.is_available !== true) {
      return { balance: null, error: '当前账户余额不可用（is_available 为 false）' }
    }
    return { balance: formatBalance(data), error: null }
  } catch (error) {
    return {
      balance: null,
      error: `查询余额失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/** 余额路由：客户端 fetch 同源相对路径即可，key 永不出 host。 */
async function handleBalance(req, res, ctx) {
  const result = await queryBalance(ctx)
  try {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(result))
  } catch { /* socket gone */ }
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: (req, res) => void handleBalance(req, res, ctx),
  }), 'dsh-balance: balance route')
}
