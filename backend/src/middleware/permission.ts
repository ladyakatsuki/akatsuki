import type { Socket } from 'socket.io';
import type { PlayerRole } from '../types/models.js';
import { getSocketAuth } from './auth.js';

/**
 * 权限校验工具
 *
 * 用于在事件处理器中校验当前 socket 是否具备所需角色权限。
 * - DM：拥有房间全部权限
 * - player：仅拥有玩家相关权限
 */

export interface PermissionCheckResult {
  ok: boolean;
  error?: string;
  role?: PlayerRole;
}

/**
 * 校验当前 socket 是否具备指定角色
 */
export function requireRole(socket: Socket, requiredRole: PlayerRole): PermissionCheckResult {
  const auth = getSocketAuth(socket);
  if (!auth) {
    return { ok: false, error: '未鉴权' };
  }
  if (auth.role !== requiredRole) {
    return { ok: false, error: `需要 ${requiredRole} 权限`, role: auth.role };
  }
  return { ok: true, role: auth.role };
}

/**
 * 校验当前 socket 是否为 DM
 */
export function requireDm(socket: Socket): PermissionCheckResult {
  return requireRole(socket, 'dm');
}

/**
 * 校验当前 socket 是否已鉴权（DM 或玩家均可）
 */
export function requireAuthenticated(socket: Socket): PermissionCheckResult {
  const auth = getSocketAuth(socket);
  if (!auth) {
    return { ok: false, error: '未鉴权' };
  }
  return { ok: true, role: auth.role };
}
