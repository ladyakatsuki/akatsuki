<script setup lang="ts">
// 加入房间表单：房间码 + 玩家名 + 加入前预览
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { ROOM_CODE_LENGTH, RULE_SETS } from '@/utils/constants'
import { normalizeRoomCode } from '@/utils/format'
import { roomsApi } from '@/api/rooms'
import { useRoomStore } from '@/stores/room'
import { useUiStore } from '@/stores/ui'
import type { RoomQueryResult } from '@/types/models'

const emit = defineEmits<{
  joined: [code: string]
}>()

const roomStore = useRoomStore()
const uiStore = useUiStore()

const code = ref('')
const name = ref('')
const localError = ref('')

// 房间预览
const preview = ref<RoomQueryResult | null>(null)
const previewLoading = ref(false)
const previewError = ref('')

const codeError = computed(() => {
  if (!code.value) return ''
  if (code.value.length !== ROOM_CODE_LENGTH) return `房间码需为 ${ROOM_CODE_LENGTH} 位`
  return ''
})

const previewMeta = computed(() => {
  if (!preview.value) return null
  return RULE_SETS[preview.value.ruleSystem] ?? null
})

const canJoin = computed(
  () =>
    code.value.length === ROOM_CODE_LENGTH &&
    name.value.trim().length > 0 &&
    !preview.value?.isFull,
)

function onCodeInput(value: string) {
  code.value = normalizeRoomCode(value).slice(0, ROOM_CODE_LENGTH)
}

// 房间码满 6 位时自动查询预览
let queryTimer: ReturnType<typeof setTimeout> | null = null
watch(code, (val) => {
  preview.value = null
  previewError.value = ''
  if (queryTimer) clearTimeout(queryTimer)
  if (val.length !== ROOM_CODE_LENGTH) return
  queryTimer = setTimeout(async () => {
    previewLoading.value = true
    try {
      preview.value = await roomsApi.query(val)
      // 预览时同步主题
      const meta = RULE_SETS[preview.value.ruleSystem]
      if (meta) uiStore.setTheme(meta.theme)
    } catch (e) {
      previewError.value = (e as Error).message || '未找到该房间'
    } finally {
      previewLoading.value = false
    }
  }, 300)
})

async function onSubmit() {
  localError.value = ''
  if (code.value.length !== ROOM_CODE_LENGTH) {
    localError.value = `请输入 ${ROOM_CODE_LENGTH} 位房间码`
    return
  }
  if (!name.value.trim()) {
    localError.value = '请输入你的昵称'
    return
  }
  if (preview.value?.isFull) {
    localError.value = '房间已满'
    return
  }
  try {
    await roomStore.joinRoom(code.value, name.value.trim())
    emit('joined', code.value)
  } catch {
    // 错误已写入 store.error
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <!-- 房间码 -->
    <div>
      <label class="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted">
        房间码
      </label>
      <input
        :value="code"
        :maxlength="ROOM_CODE_LENGTH"
        placeholder="ABCDEF"
        class="input-field text-center font-mono text-2xl tracking-[0.5em] uppercase"
        :class="codeError ? 'border-danger' : ''"
        @input="onCodeInput(($event.target as HTMLInputElement).value)"
      />
      <p v-if="codeError" class="mt-1 text-xs text-danger">{{ codeError }}</p>
      <p v-else class="mt-1 text-xs text-text-muted">输入 DM 提供的 6 位房间码</p>
    </div>

    <!-- 房间预览 -->
    <Transition name="fade">
      <div
        v-if="code.length === ROOM_CODE_LENGTH"
        class="rounded-md border border-border bg-background/40 px-3 py-2.5 animate-fade-in"
      >
        <div v-if="previewLoading" class="flex items-center gap-2 text-xs text-text-muted">
          <span
            class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
          正在查询房间…
        </div>
        <div v-else-if="previewError" class="flex items-center gap-2 text-xs text-danger">
          <span>⚠</span>
          <span>{{ previewError }}</span>
        </div>
        <div v-else-if="preview && previewMeta" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-widest text-text-muted">房间信息</span>
            <span
              class="badge-ruleset text-[10px]"
              :class="
                previewMeta.theme === 'coc'
                  ? 'border-success/50 text-success'
                  : 'border-accent/50 text-accent'
              "
            >
              {{ previewMeta.label }}
            </span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-text-muted">当前人数</span>
            <span class="font-mono text-text">
              {{ preview.playerCount }}
              <span class="text-text-muted">/ {{ 8 }}</span>
            </span>
          </div>
          <div v-if="preview.isFull" class="text-xs text-danger">房间已满，无法加入</div>
        </div>
      </div>
    </Transition>

    <!-- 昵称 -->
    <BaseInput
      v-model="name"
      label="你的昵称"
      placeholder="冒险者，报上名来…"
      :error="localError && !codeError ? localError : ''"
      :maxlength="20"
    />

    <!-- 错误提示 -->
    <div
      v-if="roomStore.error"
      class="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger animate-fade-in"
    >
      <span class="mt-0.5">⚠</span>
      <span>{{ roomStore.error }}</span>
    </div>

    <BaseButton
      type="submit"
      variant="accent"
      block
      :loading="roomStore.loading"
      :disabled="!canJoin"
    >
      <span>◆</span>
      加入房间
    </BaseButton>
  </form>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
