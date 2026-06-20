import { randomBytes } from 'node:crypto';

/**
 * 生成唯一 ID（基于随机字节 + 时间戳，无外部依赖）
 */
export function generateId(prefix = ''): string {
  const time = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `${prefix}${time}${random}`;
}

/**
 * 生成 6 位大写房间码（去除易混淆字符 0/O/I/1/L）
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
