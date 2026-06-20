<script setup lang="ts">
// 多面体骰子图标组件 - 为不同面数的骰子渲染对应的多面体形状
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 骰子面数 */
    sides: number
    /** 尺寸（px） */
    size?: number
  }>(),
  {
    size: 24,
  },
)

/** 根据面数返回 SVG 路径与配置 */
const diceShape = computed(() => {
  const s = props.sides
  // 所有路径基于 24x24 viewBox
  switch (s) {
    case 4:
      // d4：三角锥（正视图）
      return {
        faces: [{ d: 'M12 3 L21 20 L3 20 Z' }],
        inner: [{ d: 'M12 3 L12 20 M3 20 L12 14 L21 20' }],
      }
    case 6:
      // d6：立方体（等距投影）
      return {
        faces: [{ d: 'M12 3 L20 7 L20 17 L12 21 L4 17 L4 7 Z' }],
        inner: [{ d: 'M12 3 L12 11 M4 7 L12 11 L20 7 M12 11 L12 21' }],
      }
    case 8:
      // d8：八面体（菱形）
      return {
        faces: [{ d: 'M12 2 L22 12 L12 22 L2 12 Z' }],
        inner: [{ d: 'M2 12 L22 12 M12 2 L12 22' }],
      }
    case 10:
      // d10：五角形（十面体侧视）
      return {
        faces: [{ d: 'M12 2 L21 9 L18 20 L6 20 L3 9 Z' }],
        inner: [{ d: 'M12 2 L12 12 M3 9 L12 12 L21 9 M12 12 L6 20 M12 12 L18 20' }],
      }
    case 12:
      // d12：六角形（十二面体）
      return {
        faces: [{ d: 'M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z' }],
        inner: [
          {
            d: 'M12 2 L12 8 M4 7 L9 10 L12 8 L15 10 L20 7 M9 10 L9 16 L12 22 L15 16 L15 10 M4 17 L9 16 M20 17 L15 16',
          },
        ],
      }
    case 20:
      // d20：二十面体（六角形带三角分割）
      return {
        faces: [{ d: 'M12 2 L21 8 L21 16 L12 22 L3 16 L3 8 Z' }],
        inner: [
          {
            d: 'M12 2 L12 22 M3 8 L21 16 M21 8 L3 16 M12 2 L3 16 M12 2 L21 16 M3 8 L12 22 L21 8',
          },
        ],
      }
    case 100:
      // d100：百分骰（圆形带刻度）
      return {
        faces: [{ d: 'M12 2 A10 10 0 1 0 12 22 A10 10 0 1 0 12 2 Z' }],
        inner: [{ d: 'M12 7 A5 5 0 1 0 12 17 A5 5 0 1 0 12 7 Z' }],
      }
    default:
      return { faces: [{ d: 'M12 2 L22 12 L12 22 L2 12 Z' }], inner: [] }
  }
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
    stroke-linecap="round"
  >
    <!-- 外形 -->
    <path
      v-for="(face, i) in diceShape.faces"
      :key="`f-${i}`"
      :d="face.d"
      fill="currentColor"
      fill-opacity="0.12"
    />
    <!-- 内部分割线 -->
    <path v-for="(line, i) in diceShape.inner" :key="`i-${i}`" :d="line.d" stroke-opacity="0.7" />
  </svg>
</template>
