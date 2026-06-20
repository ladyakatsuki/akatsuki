<script setup lang="ts">
// 创建房间表单：DM 名字 + 规则集卡片选择 + 创建按钮
import { reactive } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { RULE_SET_OPTIONS } from '@/utils/constants'
import { useUiStore } from '@/stores/ui'
import { useRoomStore } from '@/stores/room'
import type { RuleSet } from '@/types/models'

const emit = defineEmits<{
  created: [code: string]
}>()

const uiStore = useUiStore()
const roomStore = useRoomStore()

const form = reactive({
  dmName: '',
  ruleSystem: 'dnd5e' as RuleSet,
})

const localError = reactive({ dmName: '' })

function selectRuleSet(key: RuleSet) {
  form.ruleSystem = key
  // 预览对应主题
  uiStore.setTheme(key === 'coc7' ? 'coc' : 'dnd')
}

function validate(): boolean {
  localError.dmName = ''
  if (!form.dmName.trim()) {
    localError.dmName = '请输入 DM 名字'
    return false
  }
  if (form.dmName.trim().length > 20) {
    localError.dmName = '名字不超过 20 个字符'
    return false
  }
  return true
}

async function onSubmit() {
  if (!validate()) return
  try {
    const room = await roomStore.createRoom(form.ruleSystem, form.dmName.trim())
    emit('created', room.code)
  } catch {
    // 错误已写入 store.error
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="onSubmit">
    <!-- 规则集选择卡片 -->
    <div>
      <label class="mb-2 block text-xs font-semibold uppercase tracking-widest text-text-muted">
        选择规则集
      </label>
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="opt in RULE_SET_OPTIONS"
          :key="opt.key"
          type="button"
          class="ruleset-card group relative overflow-hidden rounded-lg border p-4 text-left transition-all duration-300"
          :class="
            form.ruleSystem === opt.key
              ? opt.key === 'coc7'
                ? 'ruleset-active-coc'
                : 'ruleset-active-dnd'
              : 'border-border bg-background/40 hover:border-primary/50'
          "
          @click="selectRuleSet(opt.key)"
        >
          <!-- 主题纹理叠加 -->
          <div
            v-if="form.ruleSystem === opt.key"
            class="pointer-events-none absolute inset-0 opacity-30"
            :class="opt.key === 'coc7' ? 'texture-moss' : 'texture-parchment'"
          />
          <!-- 图标 -->
          <div class="relative mb-2 flex items-center justify-between">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
              :class="
                form.ruleSystem === opt.key
                  ? opt.key === 'coc7'
                    ? 'border-success/60 text-success'
                    : 'border-primary/60 text-primary'
                  : 'border-border text-text-muted'
              "
            >
              <!-- DND：剑与盾 -->
              <svg
                v-if="opt.key === 'dnd5e'"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M14.5 17.5 4 7V4h3l10.5 10.5" />
                <path d="m13 19 6-6M16 16l4 4M19 21l2-2M5 14l-2 2M7 17l-2 2" />
              </svg>
              <!-- COC：触手之眼 -->
              <svg
                v-else
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span
              v-if="form.ruleSystem === opt.key"
              class="title-ornament"
              :class="opt.key === 'coc7' ? 'text-success' : 'text-primary'"
              >◆</span
            >
          </div>
          <div class="relative mb-1 flex items-baseline gap-1.5">
            <span
              class="font-display text-lg font-bold"
              :class="form.ruleSystem === opt.key ? 'text-gradient-gold' : 'text-text'"
            >
              {{ opt.label }}
            </span>
            <span class="text-[10px] uppercase tracking-wider text-text-muted">{{
              opt.shortLabel
            }}</span>
          </div>
          <p class="relative text-xs leading-relaxed text-text-muted">{{ opt.description }}</p>
          <div
            class="absolute inset-x-0 bottom-0 h-0.5 bg-frame-gradient transition-transform duration-300"
            :class="form.ruleSystem === opt.key ? 'scale-x-100' : 'scale-x-0'"
          />
        </button>
      </div>
    </div>

    <!-- DM 名字 -->
    <BaseInput
      v-model="form.dmName"
      label="DM 名字"
      placeholder="地下城主，报上名号…"
      :error="localError.dmName"
      :maxlength="20"
      hint="你将作为主持人（DM）创建并管理这场跑团"
    />

    <!-- 错误提示 -->
    <div
      v-if="roomStore.error"
      class="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger animate-fade-in"
    >
      <span class="mt-0.5">⚠</span>
      <span>{{ roomStore.error }}</span>
    </div>

    <BaseButton type="submit" variant="primary" block :loading="roomStore.loading">
      <span>◆</span>
      创建房间
    </BaseButton>
  </form>
</template>

<style scoped>
/* DND 选中：金色金属边框 + 暖光 */
.ruleset-active-dnd {
  border-color: rgb(var(--color-primary) / 0.7);
  background: linear-gradient(
    135deg,
    rgb(var(--color-primary) / 0.12),
    rgb(var(--color-accent) / 0.08)
  );
  box-shadow:
    0 0 0 1px rgb(var(--color-primary) / 0.4),
    0 0 24px rgb(var(--color-primary) / 0.2),
    inset 0 1px 0 rgb(255 255 255 / 0.06);
}

/* COC 选中：诡异绿边框 + 雾气感 */
.ruleset-active-coc {
  border-color: rgb(var(--color-success) / 0.7);
  background: linear-gradient(
    135deg,
    rgb(var(--color-success) / 0.12),
    rgb(var(--color-accent) / 0.08)
  );
  box-shadow:
    0 0 0 1px rgb(var(--color-success) / 0.4),
    0 0 24px rgb(var(--color-success) / 0.2),
    inset 0 1px 0 rgb(255 255 255 / 0.06);
}

.ruleset-card:hover {
  transform: translateY(-2px);
}
</style>
