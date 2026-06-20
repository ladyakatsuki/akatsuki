<script setup lang="ts">
// DND 5E 角色卡 UI
// 分页：基础 / 属性 / 战斗 / 技能 / 法术 / 背景 / 物品
import { computed } from 'vue'
import type { Dnd5eCharacterData } from '@/types/models'

const props = defineProps<{
  /** 角色卡数据 */
  data: Record<string, unknown>
  /** 是否编辑模式 */
  editable: boolean
}>()

const emit = defineEmits<{
  /** 数据变更（局部字段更新） */
  update: [key: string, value: unknown]
}>()

/** 类型安全的角色数据访问 */
const char = computed(() => props.data as unknown as Partial<Dnd5eCharacterData>)

/** 读取数值字段 */
function num(key: keyof Dnd5eCharacterData): number {
  const v = char.value[key]
  return typeof v === 'number' ? v : 0
}

/** 读取字符串字段 */
function str(key: keyof Dnd5eCharacterData): string {
  const v = char.value[key]
  return typeof v === 'string' ? v : ''
}

/** 读取布尔字段 */
function bool(key: keyof Dnd5eCharacterData): boolean {
  const v = char.value[key]
  return v === true || v === 1
}

/** 更新字段 */
function updateField(key: string, value: unknown) {
  emit('update', key, value)
}

/** 计算属性调整值：floor((value - 10) / 2) */
function abilityMod(value: number): number {
  return Math.floor((value - 10) / 2)
}

/** 格式化调整值（带正负号） */
function formatMod(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

/** 计算熟练加值：1-4级+2，5-8级+3，... */
function proficiencyBonus(level: number): number {
  const clamped = Math.max(1, Math.min(20, level))
  return Math.floor((clamped - 1) / 4) + 2
}

// ===== 属性配置 =====
const attributes = [
  { key: 'str' as const, name: '力量', abbr: 'STR' },
  { key: 'dex' as const, name: '敏捷', abbr: 'DEX' },
  { key: 'con' as const, name: '体质', abbr: 'CON' },
  { key: 'int' as const, name: '智力', abbr: 'INT' },
  { key: 'wis' as const, name: '感知', abbr: 'WIS' },
  { key: 'cha' as const, name: '魅力', abbr: 'CHA' },
]

// ===== 技能配置（18 项，含关联属性） =====
const skills = [
  { key: 'athletics' as const, name: '运动', attr: 'str' },
  { key: 'acrobatics' as const, name: '杂技', attr: 'dex' },
  { key: 'sleightOfHand' as const, name: '巧手', attr: 'dex' },
  { key: 'stealth' as const, name: '隐匿', attr: 'dex' },
  { key: 'arcana' as const, name: '奥秘', attr: 'int' },
  { key: 'history' as const, name: '历史', attr: 'int' },
  { key: 'investigation' as const, name: '调查', attr: 'int' },
  { key: 'nature' as const, name: '自然', attr: 'int' },
  { key: 'religion' as const, name: '宗教', attr: 'int' },
  { key: 'animalHandling' as const, name: '驯兽', attr: 'wis' },
  { key: 'insight' as const, name: '洞察', attr: 'wis' },
  { key: 'medicine' as const, name: '医药', attr: 'wis' },
  { key: 'perception' as const, name: '察觉', attr: 'wis' },
  { key: 'survival' as const, name: '求生', attr: 'wis' },
  { key: 'deception' as const, name: '欺瞒', attr: 'cha' },
  { key: 'intimidation' as const, name: '威吓', attr: 'cha' },
  { key: 'performance' as const, name: '表演', attr: 'cha' },
  { key: 'persuasion' as const, name: '说服', attr: 'cha' },
]

/** 法术位配置（1-9 环） */
const spellSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** 施法属性选项 */
const spellcastingOptions = [
  { value: 'none', label: '无' },
  { value: 'str', label: '力量' },
  { value: 'dex', label: '敏捷' },
  { value: 'con', label: '体质' },
  { value: 'int', label: '智力' },
  { value: 'wis', label: '感知' },
  { value: 'cha', label: '魅力' },
]

/** 被动察觉（computed） */
const passivePerception = computed(() => {
  const wisMod = abilityMod(num('wis'))
  const profBonus = proficiencyBonus(num('level'))
  const perceptionProf = bool('perception') ? 1 : 0
  return 10 + wisMod + perceptionProf * profBonus
})

/** 先攻（computed = dexMod） */
const initiative = computed(() => abilityMod(num('dex')))

/** 熟练加值（computed） */
const profBonus = computed(() => proficiencyBonus(num('level')))
</script>

<template>
  <div class="dnd-sheet space-y-4">
    <!-- ===== 基础信息 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        基础信息
      </h4>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div class="field-group">
          <label class="field-label">姓名</label>
          <input
            :value="str('name')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('name', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">职业</label>
          <input
            :value="str('class')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('class', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">等级</label>
          <input
            :value="num('level')"
            :disabled="!editable"
            type="number"
            min="1"
            max="20"
            class="sheet-input"
            @input="updateField('level', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field-group">
          <label class="field-label">种族</label>
          <input
            :value="str('race')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('race', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">背景</label>
          <input
            :value="str('background')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('background', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">阵营</label>
          <input
            :value="str('alignment')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('alignment', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">经验值</label>
          <input
            :value="num('experience')"
            :disabled="!editable"
            type="number"
            min="0"
            class="sheet-input"
            @input="updateField('experience', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </section>

    <!-- ===== 属性 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        属性
      </h4>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div
          v-for="attr in attributes"
          :key="attr.key"
          class="attribute-card flex flex-col items-center rounded-lg border border-border/60 bg-background/40 p-3"
        >
          <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {{ attr.abbr }}
          </span>
          <span class="mb-1 text-xs text-text">{{ attr.name }}</span>
          <input
            :value="num(attr.key)"
            :disabled="!editable"
            type="number"
            min="1"
            max="30"
            class="attribute-input"
            @input="updateField(attr.key, Number(($event.target as HTMLInputElement).value))"
          />
          <div class="mt-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5">
            <span class="font-mono text-sm font-bold text-primary">
              {{ formatMod(abilityMod(num(attr.key))) }}
            </span>
          </div>
          <!-- 豁免熟练 -->
          <label class="mt-2 flex items-center gap-1 text-[10px] text-text-muted">
            <input
              :checked="bool(`${attr.key}SaveProficient`)"
              :disabled="!editable"
              type="checkbox"
              class="sheet-checkbox"
              @change="
                updateField(
                  `${attr.key}SaveProficient`,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            豁免
          </label>
        </div>
      </div>
    </section>

    <!-- ===== 战斗 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        战斗
      </h4>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div class="combat-card">
          <span class="combat-label">当前 HP</span>
          <input
            :value="num('hp')"
            :disabled="!editable"
            type="number"
            class="combat-input"
            @input="updateField('hp', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="combat-card">
          <span class="combat-label">最大 HP</span>
          <input
            :value="num('maxHp')"
            :disabled="!editable"
            type="number"
            class="combat-input"
            @input="updateField('maxHp', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="combat-card">
          <span class="combat-label">防御等级</span>
          <input
            :value="num('ac')"
            :disabled="!editable"
            type="number"
            class="combat-input"
            @input="updateField('ac', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="combat-card">
          <span class="combat-label">速度</span>
          <input
            :value="num('speed')"
            :disabled="!editable"
            type="number"
            class="combat-input"
            @input="updateField('speed', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="combat-card combat-computed">
          <span class="combat-label">先攻</span>
          <span class="combat-value">{{ formatMod(initiative) }}</span>
        </div>
        <div class="combat-card combat-computed">
          <span class="combat-label">熟练加值</span>
          <span class="combat-value">{{ formatMod(profBonus) }}</span>
        </div>
      </div>
    </section>

    <!-- ===== 技能 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        技能熟练度
      </h4>
      <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        <label
          v-for="skill in skills"
          :key="skill.key"
          class="skill-row flex items-center gap-2 rounded border border-border/40 bg-background/30 px-2 py-1.5 transition-colors hover:border-primary/30"
          :class="bool(skill.key) ? 'border-primary/40 bg-primary/5' : ''"
        >
          <input
            :checked="bool(skill.key)"
            :disabled="!editable"
            type="checkbox"
            class="sheet-checkbox"
            @change="updateField(skill.key, ($event.target as HTMLInputElement).checked)"
          />
          <span class="flex-1 text-sm text-text">{{ skill.name }}</span>
          <span class="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase text-text-muted">
            {{ skill.attr }}
          </span>
        </label>
      </div>
      <!-- 被动察觉（computed） -->
      <div class="mt-3 flex items-center justify-end gap-2 text-xs text-text-muted">
        <span>被动察觉</span>
        <span
          class="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary"
        >
          {{ passivePerception }}
        </span>
      </div>
    </section>

    <!-- ===== 法术 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        法术
      </h4>
      <div class="mb-3">
        <label class="field-label">施法属性</label>
        <select
          :value="str('spellcastingAbility')"
          :disabled="!editable"
          class="sheet-input"
          @change="updateField('spellcastingAbility', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in spellcastingOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div>
        <label class="field-label">法术位</label>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
          <div
            v-for="slot in spellSlots"
            :key="slot"
            class="spell-slot flex flex-col items-center rounded border border-border/60 bg-background/40 p-2"
          >
            <span class="mb-1 text-[10px] font-semibold text-text-muted">{{ slot }}环</span>
            <input
              :value="num(`spellSlot${slot}` as keyof Dnd5eCharacterData)"
              :disabled="!editable"
              type="number"
              min="0"
              class="spell-input"
              @input="
                updateField(`spellSlot${slot}`, Number(($event.target as HTMLInputElement).value))
              "
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 背景 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        背景
      </h4>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="field-group">
          <label class="field-label">性格特征</label>
          <textarea
            :value="str('personalityTraits')"
            :disabled="!editable"
            rows="3"
            class="sheet-textarea"
            @input="updateField('personalityTraits', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">理想</label>
          <textarea
            :value="str('ideals')"
            :disabled="!editable"
            rows="3"
            class="sheet-textarea"
            @input="updateField('ideals', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">羁绊</label>
          <textarea
            :value="str('bonds')"
            :disabled="!editable"
            rows="3"
            class="sheet-textarea"
            @input="updateField('bonds', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">缺点</label>
          <textarea
            :value="str('flaws')"
            :disabled="!editable"
            rows="3"
            class="sheet-textarea"
            @input="updateField('flaws', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </div>
    </section>

    <!-- ===== 物品 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        物品栏
      </h4>
      <textarea
        :value="str('inventory')"
        :disabled="!editable"
        rows="6"
        class="sheet-textarea"
        placeholder="记录你的装备与物品..."
        @input="updateField('inventory', ($event.target as HTMLTextAreaElement).value)"
      />
    </section>
  </div>
</template>

<style scoped>
/* 角色卡区块 */
.sheet-section {
  @apply rounded-lg border border-border/50 bg-surface/30 p-3;
}

.section-title {
  @apply mb-3 flex items-center gap-2 font-display text-sm font-semibold text-primary;
}

.title-icon {
  @apply text-[10px] text-primary/60;
}

/* 字段组 */
.field-group {
  @apply flex flex-col gap-1;
}

.field-label {
  @apply text-[10px] font-semibold uppercase tracking-widest text-text-muted;
}

/* 输入框样式 */
.sheet-input {
  @apply w-full rounded border border-border/60 bg-background/60 px-2 py-1.5 text-sm text-text
    transition-colors duration-150;
}
.sheet-input:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary) / 0.7);
  box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.15);
}
.sheet-input:disabled {
  @apply cursor-not-allowed opacity-70;
}

.sheet-textarea {
  @apply w-full resize-y rounded border border-border/60 bg-background/60 px-2 py-1.5
    text-sm text-text transition-colors duration-150;
  font-family: inherit;
}
.sheet-textarea:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary) / 0.7);
  box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.15);
}
.sheet-textarea:disabled {
  @apply cursor-not-allowed opacity-70;
}

/* 属性卡片 */
.attribute-card {
  transition: transform 0.2s ease;
}
.attribute-card:hover {
  transform: translateY(-2px);
}

.attribute-input {
  @apply w-14 rounded border border-border/60 bg-background/60 px-2 py-1 text-center
    font-display text-lg font-bold text-text;
}
.attribute-input:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary) / 0.7);
}
.attribute-input:disabled {
  @apply cursor-not-allowed opacity-70;
}

/* 战斗卡片 */
.combat-card {
  @apply flex flex-col items-center rounded-lg border border-border/60 bg-background/40 p-2;
}

.combat-label {
  @apply mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted;
}

.combat-input {
  @apply w-16 rounded border border-border/60 bg-background/60 px-2 py-1 text-center
    font-display text-lg font-bold text-text;
}
.combat-input:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary) / 0.7);
}
.combat-input:disabled {
  @apply cursor-not-allowed opacity-70;
}

.combat-computed {
  @apply border-primary/30 bg-primary/5;
}

.combat-value {
  @apply font-display text-lg font-bold text-primary;
}

/* 复选框 */
.sheet-checkbox {
  @apply h-3.5 w-3.5 rounded border-border accent-primary;
}

/* 法术位 */
.spell-input {
  @apply w-12 rounded border border-border/60 bg-background/60 px-1 py-1 text-center
    font-mono text-sm font-bold text-text;
}
.spell-input:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary) / 0.7);
}
.spell-input:disabled {
  @apply cursor-not-allowed opacity-70;
}

/* 技能行 */
.skill-row {
  cursor: pointer;
}
</style>
