/**
 * dsh-balance 客户端模块：
 * 注册进 conversation.composer.dock（order -1，排在 token 统计 StatsLine 前面），
 * 挂载时 + 每 5 分钟 + 点击刷新按钮时 fetch /plugins/dsh-balance/balance。
 *
 * 计费高峰着色：按官方口径（北京时间 周一至周五 09:00-12:00 / 14:00-18:00 为高峰，
 * 其余为空闲半价）实时判定，高峰时余额文本显示警示色（--dsw-alias-state-warn-label），
 * 空闲时显示正常色；每分钟核对一次，高峰期跨边界自动切换。
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

    /**
     * 当前是否处于计费高峰时段。
     * DeepSeek 官方：高峰时段为北京时间（UTC+8）周一至周五 09:00-12:00、14:00-18:00，
     * 其余为空闲时段（含周末、夜间），空闲阶段价格为高峰的一半。
     * 用 getTimezoneOffset 把任意时区的当前时刻换算成北京墙钟时间再取星期/小时，
     * 保证无论用户本地时区在哪，都按官方的「北京时间」口径判定。
     */
    function isPeakNow() {
      var now = new Date()
      // 北京时间 = UTC+8；getTimezoneOffset() 返回 UTC − 本地（单位分钟）。换算后 getDay/getHours 即北京墙钟。
      var bj = new Date(now.getTime() + (now.getTimezoneOffset() + 8 * 60) * 60000)
      var day = bj.getDay() // 0=周日 … 6=周六
      var h = bj.getHours()
      var weekday = day >= 1 && day <= 5
      var peakHour = (h >= 9 && h < 12) || (h >= 14 && h < 18)
      return weekday && peakHour
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
      var _peak = useState(isPeakNow())
      var peak = _peak[0]
      var setPeak = _peak[1]

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

      useEffect(function () {
        // 高峰状态随时间变化（跨 09:00 / 12:00 / 14:00 / 18:00 边界），每分钟核对一次。
        var id = setInterval(function () { setPeak(isPeakNow()) }, 60 * 1000)
        return function () { clearInterval(id) }
      }, [])

      var text = value !== null ? value : (error !== null ? error : (loading ? '查询中…' : '—'))
      var cls = 'dsh-balance-text'
      if (peak) cls += ' dsh-balance-peak'
      if (error !== null && value === null) cls += ' dsh-balance-error'
      var tip = peak
        ? '高峰计费时段（北京时间 周一至周五 09:00-12:00 / 14:00-18:00）'
        : '空闲计费时段（半价）'
      return el('div', { className: 'dsh-balance-dock' },
        el('span', {
          className: cls,
          title: tip,
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
            '.dsh-balance-peak { color: var(--dsw-alias-state-warn-label); }',
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
