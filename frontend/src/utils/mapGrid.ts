// 网格地图坐标数学工具（方格 / 六边形）
// 六边形采用 pointy-top（尖顶）+ odd-r 偏移坐标系

import type { GridType } from '@/types/models'

/** 单元格坐标 */
export interface Cell {
  col: number
  row: number
}

/** 像素点 */
export interface Pixel {
  x: number
  y: number
}

/** 世界尺寸 */
export interface WorldBounds {
  width: number
  height: number
}

const SQRT3 = Math.sqrt(3)

/** 安全取奇偶（处理负数） */
function parity(n: number): number {
  return ((Math.round(n) % 2) + 2) % 2
}

/** 六边形几何参数（pointy-top） */
export interface HexMetrics {
  /** 中心到顶点距离 */
  size: number
  /** 宽度（平边到平边，水平） */
  width: number
  /** 高度（顶点到顶点，垂直） */
  height: number
  /** 行间距（垂直） */
  rowSpacing: number
}

/** 由 gridSize 推导六边形几何参数（令六边形宽度 = gridSize） */
export function getHexMetrics(gridSize: number): HexMetrics {
  const size = gridSize / SQRT3
  const width = gridSize
  const height = (2 * gridSize) / SQRT3
  const rowSpacing = height * 0.75
  return { size, width, height, rowSpacing }
}

/**
 * 格子坐标 -> 该格子中心的像素坐标（世界坐标）
 */
export function cellToPixel(col: number, row: number, gridType: GridType, gridSize: number): Pixel {
  if (gridType === 'hex') {
    const m = getHexMetrics(gridSize)
    const offsetX = parity(row) === 1 ? m.width / 2 : 0
    return {
      x: m.width * col + m.width / 2 + offsetX,
      y: m.rowSpacing * row + m.height / 2,
    }
  }
  // 方格
  return {
    x: (col + 0.5) * gridSize,
    y: (row + 0.5) * gridSize,
  }
}

/**
 * 像素坐标 -> 格子坐标（方格直接取整，六边形用立方坐标舍入）
 */
export function pixelToCell(px: number, py: number, gridType: GridType, gridSize: number): Cell {
  if (gridType === 'hex') {
    const m = getHexMetrics(gridSize)
    // 相对于 (0,0) 格子中心的坐标
    const relX = px - m.width / 2
    const relY = py - m.height / 2
    // 转轴向坐标（fractional）
    const q = (relX - relY / SQRT3) / gridSize
    const r = (2 * relY) / (SQRT3 * gridSize)
    // 立方坐标舍入
    const rounded = axialRound(q, r)
    // 轴向 -> odd-r 偏移
    const col = rounded.q + (rounded.r - parity(rounded.r)) / 2
    return { col: Math.round(col), row: rounded.r }
  }
  // 方格
  return {
    col: Math.floor(px / gridSize),
    row: Math.floor(py / gridSize),
  }
}

/** 轴向坐标舍入（cube round） */
function axialRound(q: number, r: number): { q: number; r: number } {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) {
    rq = -rr - rs
  } else if (dr > ds) {
    rr = -rq - rs
  }
  return { q: rq, r: rr }
}

/** 计算地图世界尺寸（像素） */
export function getWorldBounds(
  gridType: GridType,
  cols: number,
  rows: number,
  gridSize: number,
): WorldBounds {
  if (gridType === 'hex') {
    const m = getHexMetrics(gridSize)
    // 宽度：列数 * 格宽 + 奇数行偏移半格
    const width = m.width * cols + m.width / 2
    // 高度：行间距 * (行数-1) + 单格高度
    const height = m.rowSpacing * (rows - 1) + m.height
    return { width, height }
  }
  return { width: cols * gridSize, height: rows * gridSize }
}

/** 在 ctx 上绘制单个格子边框路径（不 stroke/fill） */
export function traceCellPath(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  gridType: GridType,
  gridSize: number,
): void {
  if (gridType === 'hex') {
    const m = getHexMetrics(gridSize)
    const center = cellToPixel(col, row, gridType, gridSize)
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      // pointy-top：顶点角度 -90, -30, 30, 90, 150, 210 度
      const angle = (Math.PI / 180) * (60 * i - 90)
      const vx = center.x + m.size * Math.cos(angle)
      const vy = center.y + m.size * Math.sin(angle)
      if (i === 0) ctx.moveTo(vx, vy)
      else ctx.lineTo(vx, vy)
    }
    ctx.closePath()
    return
  }
  // 方格
  const x = col * gridSize
  const y = row * gridSize
  ctx.beginPath()
  ctx.rect(x, y, gridSize, gridSize)
}

/** 格子坐标转字符串键 "col,row" */
export function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

/** 解析格子键 "col,row" */
export function parseCellKey(key: string): Cell | null {
  const parts = key.split(',')
  if (parts.length !== 2) return null
  const col = Number(parts[0])
  const row = Number(parts[1])
  if (Number.isNaN(col) || Number.isNaN(row)) return null
  return { col, row }
}
