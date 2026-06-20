<script setup lang="ts">
// 通用模态框组件
import { watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    width?: string
    closable?: boolean
  }>(),
  {
    width: 'max-w-lg',
    closable: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

function close() {
  if (!props.closable) return
  emit('update:modelValue', false)
  emit('close')
}

// 锁定背景滚动
watch(
  () => props.modelValue,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- 遮罩：模糊 + 渐变暗化 -->
        <div class="modal-mask absolute inset-0" @click="close" />
        <!-- 内容：缩放进入 + 金属边框 -->
        <div :class="['frame-card modal-content relative z-10 w-full p-6', width]">
          <header v-if="title || closable" class="mb-4 flex items-center justify-between">
            <div>
              <div class="title-divider mb-1 max-w-[12rem]">
                <span class="title-ornament text-xs">◆</span>
              </div>
              <h3 class="font-display text-xl font-semibold text-gradient-gold">
                {{ title }}
              </h3>
            </div>
            <button
              v-if="closable"
              class="modal-close text-text-muted transition-all hover:text-danger"
              aria-label="关闭"
              @click="close"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div>
            <slot />
          </div>
          <footer v-if="$slots.footer" class="mt-5 flex justify-end gap-3">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 遮罩：背景模糊 + 暗化 */
.modal-mask {
  background:
    radial-gradient(circle at 50% 50%, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.8)),
    rgb(var(--color-background) / 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* 内容：缩放进入动画 */
.modal-content {
  animation: modal-pop 0.3s cubic-bezier(0.34, 1.3, 0.64, 1) both;
  box-shadow:
    0 0 0 1px rgb(var(--color-primary) / 0.25),
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    0 0 48px rgb(var(--color-primary) / 0.15),
    0 24px 60px rgb(0 0 0 / 0.6);
}

/* 关闭按钮悬浮 */
.modal-close {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid transparent;
}
.modal-close:hover {
  border-color: rgb(var(--color-danger) / 0.5);
  background: rgb(var(--color-danger) / 0.12);
  transform: rotate(90deg);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.25s cubic-bezier(0.34, 1.3, 0.64, 1);
}
.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.92) translateY(12px);
}
</style>
