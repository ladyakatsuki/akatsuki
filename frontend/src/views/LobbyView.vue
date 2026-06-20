<script setup lang="ts">
// 大厅页：标题、简介、创建/加入房间表单
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseCard from '@/components/common/BaseCard.vue'
import CreateRoomForm from '@/components/lobby/CreateRoomForm.vue'
import JoinRoomForm from '@/components/lobby/JoinRoomForm.vue'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const { theme, toggleTheme, isCoc } = useTheme()

// 创建房间成功后跳转
function handleCreated(code: string) {
  router.push(`/room/${code}`)
}

// 加入房间成功后跳转
function handleJoined(code: string) {
  router.push(`/room/${code}`)
}

// 特性列表
const features = [
  { icon: '⚔', title: '实时同步', desc: 'Socket.IO 双向通信' },
  { icon: '◆', title: '双规则集', desc: 'DND 5E / COC 7' },
  { icon: '🗺', title: '战术地图', desc: '网格 token 部署' },
  { icon: '🎲', title: '骰子动画', desc: '命运可视化' },
]

// DND 主题符文 / COC 主题古文字
const runes = computed(() =>
  isCoc.value ? ['ᛋ', 'ᚦ', 'ᚷ', 'ᚹ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛏ'] : ['◆', '✦', '❖', '✧', '◈', '✩', '⬡', '✪'],
)
</script>

<template>
  <div class="lobby-view relative min-h-screen overflow-hidden bg-background">
    <!-- 背景装饰：浮动符文 / 古文字 -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        v-for="i in 10"
        :key="i"
        class="absolute font-display text-primary/[0.05] animate-rune-flicker"
        :style="{
          left: `${(i * 13) % 92}%`,
          top: `${(i * 19) % 85}%`,
          fontSize: `${2 + (i % 4)}rem`,
          animationDelay: `${i * 0.5}s`,
          animationDuration: `${3 + (i % 3)}s`,
        }"
      >
        {{ runes[i % runes.length] }}
      </div>
    </div>

    <!-- COC 主题：雾气漂浮层 -->
    <div v-if="isCoc" class="fog-layer" />

    <!-- 顶部主题切换 -->
    <div class="absolute right-6 top-6 z-10">
      <button class="btn-metal" title="切换主题预览" @click="toggleTheme()">
        <span>{{ theme === 'dnd' ? 'DND' : 'COC' }}</span>
        <span class="text-text-muted">⇄</span>
        <span>{{ theme === 'dnd' ? 'COC' : 'DND' }}</span>
      </button>
    </div>

    <div
      class="content-z relative mx-auto flex min-h-screen max-w-6xl flex-col items-center px-6 py-16"
    >
      <!-- 标题区 -->
      <header class="mb-12 text-center animate-fade-in">
        <div class="title-divider mx-auto mb-4 max-w-md">
          <span class="title-ornament text-2xl">◆</span>
        </div>
        <h1
          class="font-display text-6xl font-extrabold tracking-wide text-gradient-gold text-shadow-deep md:text-7xl"
        >
          TRPG Hall
        </h1>
        <p class="mt-3 font-display text-xl text-primary/80">多人联机跑团平台</p>
        <p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">
          支持 <span class="text-accent">DND 5E</span> 与
          <span class="text-success">COC 7版</span> 双规则集的实时在线跑团。
          创建房间，邀请伙伴，掷骰定命，共赴一场跨越现实的冒险。
        </p>
      </header>

      <!-- 双卡片表单区 -->
      <div class="grid w-full max-w-5xl gap-6 md:grid-cols-2">
        <!-- 创建房间 -->
        <div class="animate-fade-in" style="animation-delay: 0.1s">
          <BaseCard title="创建房间" subtitle="开启一场新的冒险" glow hoverable>
            <CreateRoomForm @created="handleCreated" />
          </BaseCard>
        </div>

        <!-- 加入房间 -->
        <div class="animate-fade-in" style="animation-delay: 0.2s">
          <BaseCard title="加入房间" subtitle="响应召唤，踏入既有故事" glow hoverable>
            <JoinRoomForm @joined="handleJoined" />
          </BaseCard>
        </div>
      </div>

      <!-- 特性介绍 -->
      <div class="mt-16 grid w-full max-w-5xl gap-4 md:grid-cols-4">
        <div
          v-for="(feat, idx) in features"
          :key="idx"
          class="frame-card frame-card-hover p-4 text-center animate-fade-in"
          :style="{ animationDelay: `${0.3 + idx * 0.1}s` }"
        >
          <div class="title-ornament mb-2 text-2xl">{{ feat.icon }}</div>
          <p class="font-display text-sm font-semibold text-text">{{ feat.title }}</p>
          <p class="mt-0.5 text-xs text-text-muted">{{ feat.desc }}</p>
        </div>
      </div>

      <!-- 页脚 -->
      <footer class="mt-16 text-center text-xs text-text-muted/60">
        <div class="title-divider mx-auto mb-2 max-w-xs">
          <span class="text-xs">◆</span>
        </div>
        <p>TRPG Hall · 仅供学习与娱乐 · 愿骰运常伴</p>
      </footer>
    </div>
  </div>
</template>
