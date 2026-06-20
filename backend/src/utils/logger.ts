/**
 * 简单的统一日志工具
 * 输出格式：[时间] [级别] 消息
 */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatTime(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, message: string, meta?: unknown): void {
  const time = formatTime();
  const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
  // eslint-disable-next-line no-console
  console.log(`[${time}] [${level.toUpperCase()}] ${message}${metaStr}`);
}

export const logger = {
  info(message: string, meta?: unknown): void {
    log('info', message, meta);
  },
  warn(message: string, meta?: unknown): void {
    log('warn', message, meta);
  },
  error(message: string, meta?: unknown): void {
    log('error', message, meta);
  },
  debug(message: string, meta?: unknown): void {
    if (process.env.NODE_ENV !== 'production') {
      log('debug', message, meta);
    }
  },
};
