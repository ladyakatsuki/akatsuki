// 路由配置与守卫

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { STORAGE_KEYS } from '@/utils/constants'
import { normalizeRoomCode } from '@/utils/format'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'lobby',
    component: () => import('@/views/LobbyView.vue'),
    meta: { title: '大厅 · 跑团平台' },
  },
  {
    path: '/room/:code',
    name: 'room',
    component: () => import('@/views/RoomView.vue'),
    props: true,
    meta: { title: '房间 · 跑团平台' },
    // 进入前：检查 store 或 localStorage 有有效房间信息
    beforeEnter: (to) => {
      const code = normalizeRoomCode(String(to.params.code ?? ''))
      const roomStore = useRoomStore()
      // store 中已有匹配的房间（创建/加入后跳转）
      if (roomStore.currentRoom && roomStore.code === code) return true
      // localStorage 中有匹配房间码（刷新重连场景）
      const storedCode = localStorage.getItem(STORAGE_KEYS.roomCode)
      if (storedCode && normalizeRoomCode(storedCode) === code) return true
      // 无有效房间信息，重定向到大厅
      return { name: 'lobby' }
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = (to.meta.title as string) ?? '跑团平台'
  document.title = title
})

export default router
