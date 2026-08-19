/**
 * dsh-balance 客户端模块：
 * 注册进 conversation.composer.dock（order -1，排在 token 统计 StatsLine 前面），
 * 挂载时 + 每 5 分钟 + 点击刷新按钮时 fetch /plugins/dsh-balance/balance。
 *
 * dsh 客户端加载器用经典 <script> 拉取本文件，需 window.__ModuleLoader__.load
 * 注册；工厂内 require() 由平台种子词表应答（react 是种子词）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-balance',
  factory: function (require) {
    var React = require('react')
    var el = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useCallback = React.useCallback

    var POLL_MS = 5 * 60 * 1000

    /** 把 host 的长文本 "CNY 194.56（赠送 0.00 / 充值 194.56）" 缩成 "¥194.56"。 */
    function shortBalance(text) {
      var m = /^([A-Za-z]{3})\s+([0-9.]+)/.exec(String(text))
      if (m === null) return String(text)
      var cur = m[1]
      var symbol = cur === 'CNY' ? '¥' : cur === 'USD' ? '$' : cur + ' '
      return symbol + m[2]
    }

    function BalanceDock() {
      var _value = useState(null)
      var value = _value[0]
      var setValue = _value[1]
      var _loading = useState(false)
      var loading = _loading[0]
      var setLoading = _loading[1]
      var _error = useState(null)
      var error = _error[0]
      var setError = _error[1]

      var refresh = useCallback(function () {
        setLoading(true)
        setError(null)
        fetch('/plugins/dsh-balance/balance', { cache: 'no-store' })
          .then(function (r) { return r.json() })
          .then(function (d) {
            if (d && typeof d.balance === 'string') setValue(shortBalance(d.balance))
            else setValue(null)
            if (d && typeof d.error === 'string') setError(d.error)
          })
          .catch(function (e) { setError(String(e)) })
          .finally(function () { setLoading(false) })
      }, [])

      useEffect(function () {
        refresh()
        var id = setInterval(refresh, POLL_MS)
        return function () { clearInterval(id) }
      }, [refresh])

      var text = value !== null ? value : (error !== null ? error : (loading ? '查询中…' : '—'))
      return el('div', { className: 'dsh-balance-dock' },
        el('span', {
          className: error !== null && value === null
            ? 'dsh-balance-text dsh-balance-error'
            : 'dsh-balance-text',
        }, text),
        el('button', {
          className: 'dsh-balance-refresh',
          type: 'button',
          title: '刷新余额',
          onClick: refresh,
          disabled: loading,
        }, '⟳'),
      )
    }

    return {
      name: 'dsh-balance',
      inject: ['slots'],
      apply: function (ctx) {
        var slots = ctx.get('slots')
        if (slots === undefined) return

        // 注入一次样式：
        // 1) 把 InputBar 根（dock 的直接父容器）改为 row-wrap：宽 100% 的块
        //   （输入卡片、提示条）自动独占整行，余额与 token 统计的小文本流到同一行。
        // 2) 溶解余额条目与 StatsLine 的盒子（display: contents），让行内内容
        //   直接成为父 flex 行的子项 —— 两个条目从而同处一行。
        // 3) 文本样式：12px / label-tertiary，与 StatsLine 同视觉族。
        var styleId = 'dsh-balance/dock.css'
        if (document.getElementById(styleId) === null) {
          var style = document.createElement('style')
          style.id = styleId
          style.textContent = [
            'div:has(> .dsh-balance-dock) {',
            '  display: flex !important;',
            '  flex-direction: row !important;',
            '  flex-wrap: wrap !important;',
            '  justify-content: center !important;',
            '  align-items: center !important;',
            '  column-gap: 10px;',
            '  row-gap: 2px;',
            '}',
            '.dsh-balance-dock { display: contents !important; }',
            '.dsh-balance-dock + *, .dsh-balance-dock + * > * { display: contents !important; }',
            '.dsh-balance-text { font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-primary); white-space: nowrap; }',
            '.dsh-balance-error { color: var(--dsw-alias-state-error-primary); }',
            '.dsh-balance-refresh { background: none; border: none; padding: 0;',
            '  color: var(--dsw-alias-label-tertiary); cursor: pointer; font-size: 12px; line-height: 20px; }',
            '.dsh-balance-refresh:hover { color: var(--dsw-alias-label-secondary); }',
            '.dsh-balance-refresh:disabled { opacity: 0.5; cursor: default; }',
          ].join('\n')
          document.head.appendChild(style)
        }

        // 排在 StatsLine（order 0）前面。
        slots.inject('conversation.composer.dock', function () {
          return slots.register({
            name: 'conversation.composer.dock',
            id: 'balance',
            order: -1,
          }, BalanceDock)
        })
      },
    }
  },
})
