// 时间戳、脱敏、文案格式化工具，集中放置避免组件内重复实现。

export function formatTimestamp(value: number | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatRelative(value: number | null | undefined): string {
  if (!value) return '—'
  const deltaSec = Math.floor(Date.now() / 1000 - value)
  if (deltaSec < 0) {
    const future = Math.abs(deltaSec)
    if (future < 60) return `${future}s 后`
    if (future < 3600) return `${Math.floor(future / 60)}m 后`
    return `${Math.floor(future / 3600)}h 后`
  }
  if (deltaSec < 60) return `${deltaSec}s 前`
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m 前`
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h 前`
  return `${Math.floor(deltaSec / 86400)}d 前`
}

export function guestStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return '活跃'
    case 'cooldown':
      return '冷却中'
    case 'error':
      return '异常'
    case 'idle':
      return '待命'
    case 'disabled':
      return '已关闭'
    default:
      return String(status ?? '未知')
  }
}

export function accountStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return '活跃'
    case 'idle':
      return '待命'
    case 'error':
      return '异常'
    case 'invalid':
      return '失效'
    case 'disabled':
      return '停用'
    default:
      return String(status ?? '未知')
  }
}

export function guestSourceSettingLabel(source: string | null | undefined): string {
  switch (source) {
    case 'env':
      return '环境变量'
    case 'database':
      return '后台设置'
    case 'default':
      return '默认值'
    default:
      return String(source ?? '未知')
  }
}
