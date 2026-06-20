<script setup lang="ts">
// Canvas 网格地图渲染与交互组件
// 支持：方格/六边形网格、背景图、Token 渲染与拖拽、迷雾战争、缩放与平移
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '@/stores/map'
import { useRoomStore } from '@/stores/room'
import { useCharacterStore } from '@/stores/character'
import {
  cellKey,
  cellToPixel,
  getHexMetrics,
  getWorldBounds,
  parseCellKey,
  pixelToCell,
  traceCellPath,
} from '@/utils/mapGrid'
import type { Cell, Pixel } from '@/utils/mapGrid'
import type { MapToken } from '@/types/models'
import type { MapTokenAddPayload } from '@/types/socket'

const props = withDefaults(
  defineProps<{
    /** 是否为 DM（可编辑地图、移动任意 Token、可见全图） */
    isDM?: boolean
    /** 迷雾编辑模式是否激活（仅 DM） */
    fogEditable?: boolean
    /** 迷雾绘制模式 */
    fogMode?: 'add' | 'remove'
    /** 迷雾笔刷大小（半径+1） */
    fogBrushSize?: number
  }>(),
  {
    isDM: false,
    fogEditable: false,
    fogMode: 'add',
    fogBrushSize: 1,
  },
)

const emit = defineEmits<{
  'select-token': [token: MapToken | null]
}>()

const mapStore = useMapStore()
const roomStore = useRoomStore()
const characterStore = useCharacterStore()
const { mapState, tokens, fogCells, backgroundUrl, gridType, gridSize, width, height } =
  storeToRefs(mapStore)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// ===== 视图变换 =====
const MIN_SCALE = 0.2
const MAX_SCALE = 4
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)

// ===== 图片缓存 =====
let bgImage: HTMLImageElement | null = null
let bgImageSrc = ''
const tokenImageCache = new Map<string, HTMLImageElement>()

// ===== 交互状态 =====
type DragState =
  | { type: 'none' }
  | {
      type: 'pan'
      startX: number
      startY: number
      origOffsetX: number
      origOffsetY: number
    }
  | { type: 'token'; token: MapToken; grabCol: number; grabRow: number }
  | { type: 'fog' }

let dragState: DragState = { type: 'none' }
const isPanning = ref(false)
const draggingTokenId = ref<string | null>(null)
const dragCol = ref(0)
const dragRow = ref(0)
/** 迷雾笔画中待提交的格子 */
const pendingFogCells = ref<Set<string>>(new Set())

// ===== 选中 =====
const selectedTokenId = ref<string | null>(null)
const selectedToken = computed<MapToken | null>(
  () => tokens.value.find((t) => t.id === selectedTokenId.value) ?? null,
)

// ===== 渲染调度 =====
let rafId: number | null = null
let resizeObserver: ResizeObserver | null = null

function requestDraw() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    draw()
  })
}

// ===== 计算属性 =====
const worldBounds = computed(() =>
  getWorldBounds(gridType.value, width.value, height.value, gridSize.value),
)

/** 实际渲染的迷雾集合（store 迷雾 + 当前笔画） */
const effectiveFogSet = computed<Set<string>>(() => {
  const base = new Set(fogCells.value)
  if (props.fogMode === 'add') {
    pendingFogCells.value.forEach((c) => base.add(c))
  } else {
    pendingFogCells.value.forEach((c) => base.delete(c))
  }
  return base
})

/** 渲染用 Token 列表（拖拽中的 Token 显示在拖拽位置） */
const renderTokens = computed<MapToken[]>(() => {
  if (draggingTokenId.value) {
    return tokens.value.map((t) =>
      t.id === draggingTokenId.value ? { ...t, x: dragCol.value, y: dragRow.value } : t,
    )
  }
  return tokens.value
})

const TOKEN_TYPE_LABELS: Record<MapToken['type'], string> = {
  player: '玩家',
  npc: 'NPC',
  object: '物体',
}

const cursorClass = computed(() => {
  if (props.fogEditable) return 'cursor-crosshair'
  if (isPanning.value) return 'cursor-grabbing'
  return 'cursor-grab'
})

// ===== 工具方法 =====
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** 解析资源 URL（相对地址拼接 API 前缀） */
function resolveUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${url}`
}

/** Token 是否对当前用户可见 */
function isTokenVisible(token: MapToken): boolean {
  if (props.isDM) return true
  if (!token.isVisible) return false
  return !effectiveFogSet.value.has(cellKey(token.x, token.y))
}

/** Token 是否可被当前用户拖拽 */
function canMoveToken(token: MapToken): boolean {
  if (props.isDM) return true
  if (!token.characterId) return false
  const char = characterStore.roomCharacters.find((c) => c.id === token.characterId)
  return !!char && char.playerId === roomStore.playerId
}

// ===== 坐标变换 =====
function screenToWorld(sx: number, sy: number): Pixel {
  return { x: (sx - offsetX.value) / scale.value, y: (sy - offsetY.value) / scale.value }
}
function screenToCell(sx: number, sy: number): Cell {
  const w = screenToWorld(sx, sy)
  return pixelToCell(w.x, w.y, gridType.value, gridSize.value)
}

function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

// ===== 图片加载 =====
function getTokenImage(url: string): HTMLImageElement | null {
  let img = tokenImageCache.get(url)
  if (!img) {
    img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => requestDraw()
    img.onerror = () => requestDraw()
    img.src = resolveUrl(url)
    tokenImageCache.set(url, img)
  }
  return img
}

function loadBackground(url: string | null) {
  if (!url) {
    bgImage = null
    bgImageSrc = ''
    requestDraw()
    return
  }
  if (url === bgImageSrc && bgImage) return
  bgImageSrc = url
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    bgImage = img
    requestDraw()
  }
  img.onerror = () => {
    bgImage = null
    requestDraw()
  }
  img.src = resolveUrl(url)
}

// ===== 渲染 =====
function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const cw = canvas.width / dpr
  const ch = canvas.height / dpr

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cw, ch)

  // 画布底色
  ctx.fillStyle = 'rgb(16 12 9)'
  ctx.fillRect(0, 0, cw, ch)

  if (!mapState.value) return

  // 应用世界变换
  ctx.save()
  ctx.translate(offsetX.value, offsetY.value)
  ctx.scale(scale.value, scale.value)

  const bounds = worldBounds.value

  // 地图区域底色
  ctx.fillStyle = 'rgb(28 22 16)'
  ctx.fillRect(0, 0, bounds.width, bounds.height)

  // 背景图
  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    ctx.drawImage(bgImage, 0, 0, bounds.width, bounds.height)
  }

  // 网格线
  drawGrid(ctx, cw, ch)

  // Token
  drawTokens(ctx)

  // 迷雾
  drawFog(ctx)

  // 地图边框
  ctx.lineWidth = 2 / scale.value
  ctx.strokeStyle = 'rgba(212, 165, 116, 0.6)'
  ctx.strokeRect(0, 0, bounds.width, bounds.height)

  ctx.restore()
}

/** 计算可见格子范围（视口剔除） */
function getVisibleCellRange(cw: number, ch: number) {
  const tl = screenToWorld(0, 0)
  const br = screenToWorld(cw, ch)
  const gs = gridSize.value
  const startCol = clamp(Math.floor(tl.x / gs) - 1, 0, width.value - 1)
  const endCol = clamp(Math.ceil(br.x / gs) + 1, 0, width.value - 1)
  const startRow = clamp(Math.floor(tl.y / gs) - 1, 0, height.value - 1)
  const endRow = clamp(Math.ceil(br.y / gs) + 1, 0, height.value - 1)
  return { startCol, endCol, startRow, endRow }
}

function drawGrid(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  const gs = gridSize.value
  const gt = gridType.value
  const { startCol, endCol, startRow, endRow } = getVisibleCellRange(cw, ch)
  ctx.lineWidth = 1 / scale.value
  ctx.strokeStyle = 'rgba(212, 165, 116, 0.22)'
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      traceCellPath(ctx, col, row, gt, gs)
      ctx.stroke()
    }
  }
}

function drawTokens(ctx: CanvasRenderingContext2D) {
  const gs = gridSize.value
  const gt = gridType.value
  const cellSize = gt === 'hex' ? getHexMetrics(gs).width : gs
  for (const token of renderTokens.value) {
    if (!isTokenVisible(token)) continue
    const center = cellToPixel(token.x, token.y, gt, gs)
    const radius = (cellSize / 2) * token.size * 0.9
    const inv = 1 / scale.value

    // 阴影
    ctx.beginPath()
    ctx.arc(center.x, center.y + 2 * inv, radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fill()

    const img = token.imageUrl ? getTokenImage(token.imageUrl) : null
    if (img && img.complete && img.naturalWidth > 0) {
      // 圆形裁剪绘制图标
      ctx.save()
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, center.x - radius, center.y - radius, radius * 2, radius * 2)
      ctx.restore()
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
      ctx.lineWidth = 2 * inv
      ctx.strokeStyle = token.color
      ctx.stroke()
    } else {
      // 颜色填充
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = token.color
      ctx.fill()
      ctx.lineWidth = 2 * inv
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.stroke()
    }

    // 选中环
    if (selectedTokenId.value === token.id) {
      ctx.beginPath()
      ctx.arc(center.x, center.y, radius + 4 * inv, 0, Math.PI * 2)
      ctx.lineWidth = 3 * inv
      ctx.strokeStyle = 'rgb(212, 165, 116)'
      ctx.stroke()
    }

    // 名字标签
    const fontSize = Math.max(9, 12 * inv)
    ctx.font = `600 ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const labelY = center.y + radius + 3 * inv
    const metrics = ctx.measureText(token.name)
    const padX = 4 * inv
    const padY = 2 * inv
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(
      center.x - metrics.width / 2 - padX,
      labelY,
      metrics.width + padX * 2,
      fontSize + padY * 2,
    )
    ctx.fillStyle = 'rgb(232, 220, 200)'
    ctx.fillText(token.name, center.x, labelY + padY)
  }
}

function drawFog(ctx: CanvasRenderingContext2D) {
  const fogSet = effectiveFogSet.value
  if (fogSet.size === 0) return
  const gt = gridType.value
  const gs = gridSize.value
  // DM 半透明（可见全图），玩家几乎不透明
  ctx.fillStyle = props.isDM ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.93)'
  for (const key of fogSet) {
    const cell = parseCellKey(key)
    if (!cell) continue
    if (cell.col < 0 || cell.row < 0 || cell.col >= width.value || cell.row >= height.value) {
      continue
    }
    traceCellPath(ctx, cell.col, cell.row, gt, gs)
    ctx.fill()
  }
}

// ===== 命中检测 =====
function hitTestToken(sx: number, sy: number): MapToken | null {
  const w = screenToWorld(sx, sy)
  const gs = gridSize.value
  const gt = gridType.value
  const cellSize = gt === 'hex' ? getHexMetrics(gs).width : gs
  for (let i = tokens.value.length - 1; i >= 0; i--) {
    const token = tokens.value[i]
    if (!isTokenVisible(token)) continue
    const center = cellToPixel(token.x, token.y, gt, gs)
    const radius = (cellSize / 2) * token.size * 0.9
    const dx = w.x - center.x
    const dy = w.y - center.y
    if (dx * dx + dy * dy <= radius * radius) return token
  }
  return null
}

// ===== 迷雾绘制 =====
function paintFogAt(sx: number, sy: number) {
  const cell = screenToCell(sx, sy)
  const r = props.fogBrushSize - 1
  for (let dr = -r; dr <= r; dr++) {
    for (let dc = -r; dc <= r; dc++) {
      const col = cell.col + dc
      const row = cell.row + dr
      if (col < 0 || row < 0 || col >= width.value || row >= height.value) continue
      pendingFogCells.value.add(cellKey(col, row))
    }
  }
  // Set 变更需重新赋值以触发响应式
  pendingFogCells.value = new Set(pendingFogCells.value)
  requestDraw()
}

// ===== 鼠标交互 =====
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const { x, y } = clientToCanvas(e.clientX, e.clientY)
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  zoomAt(x, y, factor)
}

function zoomAt(sx: number, sy: number, factor: number) {
  const newScale = clamp(scale.value * factor, MIN_SCALE, MAX_SCALE)
  if (newScale === scale.value) return
  const wx = (sx - offsetX.value) / scale.value
  const wy = (sy - offsetY.value) / scale.value
  scale.value = newScale
  offsetX.value = sx - wx * newScale
  offsetY.value = sy - wy * newScale
  requestDraw()
}

function onMouseDown(e: MouseEvent) {
  if (!mapState.value) return
  const { x, y } = clientToCanvas(e.clientX, e.clientY)

  // 迷雾编辑模式
  if (props.fogEditable) {
    dragState = { type: 'fog' }
    pendingFogCells.value = new Set()
    paintFogAt(x, y)
    return
  }

  // 命中 Token
  const token = hitTestToken(x, y)
  if (token) {
    selectedTokenId.value = token.id
    emit('select-token', token)
    if (canMoveToken(token)) {
      const cell = screenToCell(x, y)
      dragState = {
        type: 'token',
        token,
        grabCol: cell.col - token.x,
        grabRow: cell.row - token.y,
      }
      draggingTokenId.value = token.id
      dragCol.value = token.x
      dragRow.value = token.y
    }
    requestDraw()
    return
  }

  // 空白处：平移并取消选中
  selectedTokenId.value = null
  emit('select-token', null)
  dragState = {
    type: 'pan',
    startX: x,
    startY: y,
    origOffsetX: offsetX.value,
    origOffsetY: offsetY.value,
  }
  isPanning.value = true
  requestDraw()
}

function onMouseMove(e: MouseEvent) {
  if (dragState.type === 'none') return
  const { x, y } = clientToCanvas(e.clientX, e.clientY)
  if (dragState.type === 'pan') {
    offsetX.value = dragState.origOffsetX + (x - dragState.startX)
    offsetY.value = dragState.origOffsetY + (y - dragState.startY)
    requestDraw()
  } else if (dragState.type === 'token') {
    const cell = screenToCell(x, y)
    dragCol.value = cell.col - dragState.grabCol
    dragRow.value = cell.row - dragState.grabRow
    requestDraw()
  } else if (dragState.type === 'fog') {
    paintFogAt(x, y)
  }
}

function onMouseUp() {
  if (dragState.type === 'token') {
    const token = dragState.token
    const finalCol = clamp(dragCol.value, 0, Math.max(0, width.value - token.size))
    const finalRow = clamp(dragRow.value, 0, Math.max(0, height.value - token.size))
    if (finalCol !== token.x || finalRow !== token.y) {
      mapStore.moveToken(token.id, finalCol, finalRow)
    }
    draggingTokenId.value = null
    const updated = tokens.value.find((t) => t.id === token.id) ?? null
    if (updated) emit('select-token', updated)
  } else if (dragState.type === 'fog') {
    if (pendingFogCells.value.size > 0) {
      mapStore.toggleFog([...pendingFogCells.value], props.fogMode)
      pendingFogCells.value = new Set()
    }
  }
  dragState = { type: 'none' }
  isPanning.value = false
}

// ===== 拖放放置 Token =====
function onDrop(e: DragEvent) {
  if (!props.isDM || !mapState.value) return
  e.preventDefault()
  const data = e.dataTransfer?.getData('application/x-map-token')
  if (!data) return
  try {
    const payload = JSON.parse(data) as Omit<MapTokenAddPayload, 'x' | 'y'>
    const { x, y } = clientToCanvas(e.clientX, e.clientY)
    const cell = screenToCell(x, y)
    void mapStore.addToken({
      ...payload,
      x: clamp(cell.col, 0, width.value - 1),
      y: clamp(cell.row, 0, height.value - 1),
    })
  } catch {
    // 忽略非法拖放数据
  }
}

function onDragOver(e: DragEvent) {
  if (!props.isDM) return
  e.preventDefault()
}

// ===== 视图控制 =====
function zoomFromCenter(factor: number) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  zoomAt(rect.width / 2, rect.height / 2, factor)
}

function fitView() {
  const container = containerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const bounds = worldBounds.value
  if (bounds.width <= 0 || bounds.height <= 0) return
  const pad = 32
  const sx = (rect.width - pad * 2) / bounds.width
  const sy = (rect.height - pad * 2) / bounds.height
  scale.value = clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE)
  offsetX.value = (rect.width - bounds.width * scale.value) / 2
  offsetY.value = (rect.height - bounds.height * scale.value) / 2
  requestDraw()
}

// ===== 选中 Token 操作 =====
function removeSelected() {
  if (!selectedTokenId.value) return
  mapStore.removeToken(selectedTokenId.value)
  selectedTokenId.value = null
  emit('select-token', null)
}

function toggleSelectedVisibility() {
  if (!selectedToken.value) return
  mapStore.updateToken(selectedToken.value.id, {
    isVisible: !selectedToken.value.isVisible,
  })
}

// ===== 尺寸适配 =====
function resizeCanvas() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return
  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  requestDraw()
}

// ===== 生命周期 =====
onMounted(() => {
  resizeCanvas()
  fitView()
  loadBackground(backgroundUrl.value)

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(containerRef.value)
  }

  const canvas = canvasRef.value
  if (canvas) {
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onMouseDown)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  requestDraw()
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  const canvas = canvasRef.value
  if (canvas) {
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('mousedown', onMouseDown)
  }
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  if (rafId !== null) cancelAnimationFrame(rafId)
})

// ===== 监听 =====
watch(backgroundUrl, (url) => loadBackground(url))
// 状态变化触发重绘
watch([mapState, scale, offsetX, offsetY], () => requestDraw())
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full w-full overflow-hidden rounded-md border border-border/50 bg-black/50"
  >
    <canvas
      ref="canvasRef"
      class="block h-full w-full outline-none"
      :class="cursorClass"
      @drop="onDrop"
      @dragover="onDragOver"
    />

    <!-- 加载/空状态 -->
    <div
      v-if="!mapState"
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <p class="text-sm text-text-muted">地图加载中…</p>
    </div>

    <!-- 缩放控制 -->
    <div class="absolute bottom-2 right-2 flex flex-col gap-1">
      <button class="map-ctrl-btn" title="放大" @click="zoomFromCenter(1.2)">+</button>
      <button class="map-ctrl-btn" title="缩小" @click="zoomFromCenter(1 / 1.2)">−</button>
      <button class="map-ctrl-btn" title="适应窗口" @click="fitView">⤢</button>
    </div>

    <!-- 缩放指示 -->
    <div
      class="pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-0.5 font-mono text-[10px] text-text-muted"
    >
      {{ Math.round(scale * 100) }}%
    </div>

    <!-- 选中 Token 信息卡 -->
    <div
      v-if="selectedToken"
      class="absolute left-2 top-2 w-44 rounded-md border border-border/60 bg-surface/90 p-2 backdrop-blur-sm"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-text">{{ selectedToken.name }}</p>
          <p class="text-[10px] text-text-muted">
            {{ TOKEN_TYPE_LABELS[selectedToken.type] }} · ({{ selectedToken.x }},
            {{ selectedToken.y }})
          </p>
        </div>
        <span
          class="h-3 w-3 shrink-0 rounded-full border border-border/60"
          :style="{ backgroundColor: selectedToken.color }"
        />
      </div>
      <p v-if="selectedToken.notes" class="mt-1 line-clamp-3 text-[11px] text-text-muted">
        {{ selectedToken.notes }}
      </p>
      <!-- DM 操作 -->
      <div v-if="isDM" class="mt-2 flex gap-1">
        <button
          class="flex-1 rounded bg-surface-hover px-1 py-0.5 text-[10px] text-text hover:bg-primary/20"
          @click="toggleSelectedVisibility"
        >
          {{ selectedToken.isVisible ? '隐藏' : '显示' }}
        </button>
        <button
          class="flex-1 rounded bg-danger/30 px-1 py-0.5 text-[10px] text-danger hover:bg-danger/50"
          @click="removeSelected"
        >
          移除
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-ctrl-btn {
  @apply flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-surface/80
    text-sm font-semibold text-text-muted transition-colors hover:border-primary/60 hover:text-primary;
}
</style>
