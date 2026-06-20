// 格式化工具函数

/** 格式化时间为 HH:MM:SS */
export function formatTime(date: Date | string | number): string {
  const d = new Date(date)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 格式化相对时间（如 "3 分钟前"） */
export function formatRelativeTime(date: Date | string | number): string {
  const diff = Date.now() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

/** 房间码大写化并去空格 */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase()
}

/** 房间码脱敏显示（如 AB-12-CD） */
export function formatRoomCode(code: string): string {
  const clean = normalizeRoomCode(code)
  return clean.match(/.{1,2}/g)?.join('-') ?? clean
}

/** 限制字符串长度并加省略号 */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 数值钳制在区间内 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
