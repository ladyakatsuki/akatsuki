<script setup lang="ts">
// COC 7版角色卡 UI
// 分页：基础 / 属性 / 战斗技能 / 调查技能 / 行动技能 / 社交技能 / 学识技能 / 战斗 / 背景 / 物品
import { computed } from 'vue'
import type { Coc7CharacterData } from '@/types/models'

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
const char = computed(() => props.data as unknown as Partial<Coc7CharacterData>)

/** 读取数值字段 */
function num(key: keyof Coc7CharacterData): number {
  const v = char.value[key]
  return typeof v === 'number' ? v : 0
}

/** 读取字符串字段 */
function str(key: keyof Coc7CharacterData): string {
  const v = char.value[key]
  return typeof v === 'string' ? v : ''
}

/** 更新字段 */
function updateField(key: string, value: unknown) {
  emit('update', key, value)
}

// ===== 核心属性（8 项） =====
const coreAttributes = [
  { key: 'str' as const, name: '力量', abbr: 'STR' },
  { key: 'con' as const, name: '体质', abbr: 'CON' },
  { key: 'siz' as const, name: '体格', abbr: 'SIZ' },
  { key: 'dex' as const, name: '敏捷', abbr: 'DEX' },
  { key: 'app' as const, name: '外貌', abbr: 'APP' },
  { key: 'int' as const, name: '智力', abbr: 'INT' },
  { key: 'pow' as const, name: '意志', abbr: 'POW' },
  { key: 'edu' as const, name: '教育', abbr: 'EDU' },
]

// ===== 技能分类 =====
const combatSkills = [
  { key: 'brawl' as const, name: '斗殴' },
  { key: 'dodge' as const, name: '闪避' },
  { key: 'sword' as const, name: '剑术' },
  { key: 'handgun' as const, name: '射击(手枪)' },
  { key: 'rifle' as const, name: '射击(步枪)' },
  { key: 'throw' as const, name: '投掷' },
  { key: 'choke' as const, name: '锁喉' },
  { key: 'melee' as const, name: '近战' },
]

const investigationSkills = [
  { key: 'libraryUse' as const, name: '图书馆使用' },
  { key: 'perception' as const, name: '察觉' },
  { key: 'psychology' as const, name: '心理学' },
  { key: 'occult' as const, name: '神秘学' },
  { key: 'archaeology' as const, name: '考古' },
  { key: 'history' as const, name: '历史' },
  { key: 'naturalWorld' as const, name: '自然' },
]

const actionSkills = [
  { key: 'stealth' as const, name: '潜行' },
  { key: 'listen' as const, name: '聆听' },
  { key: 'climb' as const, name: '攀爬' },
  { key: 'jump' as const, name: '跳跃' },
  { key: 'driveAuto' as const, name: '驾驶(汽车)' },
  { key: 'driveAircraft' as const, name: '驾驶飞行器' },
  { key: 'driveBoat' as const, name: '驾驶船艇' },
  { key: 'ride' as const, name: '骑术' },
  { key: 'swim' as const, name: '潜泳' },
  { key: 'survival' as const, name: '生存' },
  { key: 'track' as const, name: '追踪' },
]

const socialSkills = [
  { key: 'charm' as const, name: '魅惑' },
  { key: 'persuasion' as const, name: '说服' },
  { key: 'intimidate' as const, name: '恐吓' },
  { key: 'reputation' as const, name: '信誉' },
  { key: 'sleightOfHand' as const, name: '妙手' },
  { key: 'hypnosis' as const, name: '催眠' },
  { key: 'performance' as const, name: '表演' },
]

const knowledgeSkills = [
  { key: 'psychoanalysis' as const, name: '精神分析' },
  { key: 'firstAid' as const, name: '急救' },
  { key: 'medicine' as const, name: '医学' },
  { key: 'law' as const, name: '法律' },
  { key: 'accounting' as const, name: '会计' },
  { key: 'anthropology' as const, name: '人类学' },
  { key: 'biology' as const, name: '生物学' },
  { key: 'chemistry' as const, name: '化学' },
  { key: 'electronics' as const, name: '电子学' },
  { key: 'geology' as const, name: '地质学' },
  { key: 'electronicRepair' as const, name: '电子维修' },
  { key: 'mechanicalRepair' as const, name: '机械维修' },
  { key: 'artAndCraft' as const, name: '艺术与手艺' },
  { key: 'foreignLanguage' as const, name: '外语' },
  { key: 'nativeLanguage' as const, name: '母语' },
  { key: 'cthulhuMythos' as const, name: '克苏鲁神话' },
]

/** 技能分类配置 */
const skillCategories = [
  { title: '战斗技能', skills: combatSkills },
  { title: '调查技能', skills: investigationSkills },
  { title: '行动技能', skills: actionSkills },
  { title: '社交技能', skills: socialSkills },
  { title: '学识技能', skills: knowledgeSkills },
]

// ===== 派生属性计算（前端实时计算用于显示） =====

/** DB 查表 */
function getDamageBonus(strSiz: number): number {
  if (strSiz <= 64) return -2
  if (strSiz <= 84) return -1
  if (strSiz <= 124) return 0
  if (strSiz <= 164) return 4
  if (strSiz <= 204) return 6
  if (strSiz <= 284) return 12
  if (strSiz <= 364) return 18
  if (strSiz <= 444) return 24
  if (strSiz <= 524) return 30
  return 36
}

/** Build 查表 */
function getBuild(strSiz: number): number {
  if (strSiz <= 64) return -2
  if (strSiz <= 84) return -1
  if (strSiz <= 124) return 0
  if (strSiz <= 164) return 1
  if (strSiz <= 204) return 2
  if (strSiz <= 284) return 3
  if (strSiz <= 364) return 4
  if (strSiz <= 444) return 5
  if (strSiz <= 524) return 6
  return 7
}

/** MOV 计算 */
function getMov(dex: number, str: number, siz: number, age: number): number {
  let mov = dex < str && dex < siz ? 7 : 8
  if (age >= 80) mov -= 5
  else if (age >= 70) mov -= 4
  else if (age >= 60) mov -= 3
  else if (age >= 50) mov -= 2
  else if (age >= 40) mov -= 1
  return Math.max(0, mov)
}

/** 计算派生属性 */
const derived = computed(() => {
  const con = num('con')
  const siz = num('siz')
  const pow = num('pow')
  const dex = num('dex')
  const str = num('str')
  const age = num('age')
  const cthulhuMythos = num('cthulhuMythos')
  const strSiz = str + siz
  return {
    maxHp: Math.floor((con + siz) / 10),
    maxMp: Math.floor(pow / 5),
    maxSan: Math.max(0, 99 - cthulhuMythos),
    db: getDamageBonus(strSiz),
    build: getBuild(strSiz),
    mov: getMov(dex, str, siz, age),
  }
})

/** DB 显示文本 */
function formatDb(db: number): string {
  if (db < 0) return `${db}`
  if (db === 0) return '0'
  const diceMap: Record<number, string> = {
    4: '1d4',
    6: '1d6',
    12: '2d6',
    18: '3d6',
    24: '4d6',
    30: '5d6',
    36: '6d6',
  }
  return diceMap[db] ?? `+${db}`
}
</script>

<template>
  <div class="coc-sheet space-y-4">
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
            :value="str('occupation')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('occupation', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">年龄</label>
          <input
            :value="num('age')"
            :disabled="!editable"
            type="number"
            min="15"
            max="99"
            class="sheet-input"
            @input="updateField('age', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field-group">
          <label class="field-label">性别</label>
          <input
            :value="str('sex')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('sex', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">居住地</label>
          <input
            :value="str('residence')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('residence', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group">
          <label class="field-label">出生地</label>
          <input
            :value="str('birthplace')"
            :disabled="!editable"
            type="text"
            class="sheet-input"
            @input="updateField('birthplace', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </section>

    <!-- ===== 核心属性 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        核心属性
      </h4>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <div
          v-for="attr in coreAttributes"
          :key="attr.key"
          class="attribute-card flex flex-col items-center rounded-lg border border-border/60 bg-background/40 p-2"
        >
          <span class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {{ attr.abbr }}
          </span>
          <span class="mb-1 text-[10px] text-text">{{ attr.name }}</span>
          <input
            :value="num(attr.key)"
            :disabled="!editable"
            type="number"
            min="1"
            max="100"
            class="attribute-input"
            @input="updateField(attr.key, Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

      <!-- 派生属性 -->
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <div class="derived-card">
          <span class="derived-label">HP</span>
          <div class="flex items-center gap-1">
            <input
              :value="num('hp')"
              :disabled="!editable"
              type="number"
              class="derived-input"
              @input="updateField('hp', Number(($event.target as HTMLInputElement).value))"
            />
            <span class="text-xs text-text-muted">/ {{ derived.maxHp }}</span>
          </div>
        </div>
        <div class="derived-card">
          <span class="derived-label">MP</span>
          <div class="flex items-center gap-1">
            <input
              :value="num('mp')"
              :disabled="!editable"
              type="number"
              class="derived-input"
              @input="updateField('mp', Number(($event.target as HTMLInputElement).value))"
            />
            <span class="text-xs text-text-muted">/ {{ derived.maxMp }}</span>
          </div>
        </div>
        <div class="derived-card">
          <span class="derived-label">SAN</span>
          <div class="flex items-center gap-1">
            <input
              :value="num('san')"
              :disabled="!editable"
              type="number"
              class="derived-input"
              @input="updateField('san', Number(($event.target as HTMLInputElement).value))"
            />
            <span class="text-xs text-text-muted">/ {{ derived.maxSan }}</span>
          </div>
        </div>
        <div class="derived-card derived-computed">
          <span class="derived-label">DB</span>
          <span class="derived-value">{{ formatDb(derived.db) }}</span>
        </div>
        <div class="derived-card derived-computed">
          <span class="derived-label">体格</span>
          <span class="derived-value">{{ derived.build }}</span>
        </div>
        <div class="derived-card derived-computed">
          <span class="derived-label">MOV</span>
          <span class="derived-value">{{ derived.mov }}</span>
        </div>
        <div class="derived-card">
          <span class="derived-label">幸运</span>
          <input
            :value="num('luck')"
            :disabled="!editable"
            type="number"
            class="derived-input"
            @input="updateField('luck', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </section>

    <!-- ===== 技能（按分类） ===== -->
    <section v-for="category in skillCategories" :key="category.title" class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        {{ category.title }}
      </h4>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="skill in category.skills"
          :key="skill.key"
          class="skill-row flex items-center gap-2 rounded border border-border/40 bg-background/30 px-2 py-1.5 transition-colors hover:border-primary/30"
        >
          <span class="flex-1 text-xs text-text">{{ skill.name }}</span>
          <input
            :value="num(skill.key)"
            :disabled="!editable"
            type="number"
            min="0"
            max="100"
            class="skill-input"
            @input="updateField(skill.key, Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </section>

    <!-- ===== 战斗 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        战斗
      </h4>
      <div class="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="combat-info">
          <span class="combat-label">伤害加值</span>
          <span class="combat-value">{{ formatDb(derived.db) }}</span>
        </div>
        <div class="combat-info">
          <span class="combat-label">体格</span>
          <span class="combat-value">{{ derived.build }}</span>
        </div>
        <div class="combat-info">
          <span class="combat-label">移动力</span>
          <span class="combat-value">{{ derived.mov }}</span>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">武器列表</label>
        <textarea
          :value="str('weapons')"
          :disabled="!editable"
          rows="4"
          class="sheet-textarea"
          placeholder="武器名称 | 伤害 | 技能值 | 弹药&#10;例如：手枪 | 1d10 | 60 | 7发"
          @input="updateField('weapons', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </section>

    <!-- ===== 背景 ===== -->
    <section class="sheet-section">
      <h4 class="section-title">
        <span class="title-icon">◆</span>
        背景描述
      </h4>
      <textarea
        :value="str('description')"
        :disabled="!editable"
        rows="6"
        class="sheet-textarea"
        placeholder="描述你的调查员背景、经历与秘密..."
        @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
      />
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
        placeholder="记录你携带的物品与装备..."
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

/* 输入框 */
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
  @apply w-14 rounded border border-border/60 bg-background/60 px-1 py-1 text-center
    font-display text-base font-bold text-text;
}
.attribute-input:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary) / 0.7);
}
.attribute-input:disabled {
  @apply cursor-not-allowed opacity-70;
}

/* 派生属性卡片 */
.derived-card {
  @apply flex flex-col items-center rounded border border-border/60 bg-background/40 p-2;
}

.derived-computed {
  @apply border-success/30 bg-success/5;
}

.derived-label {
  @apply mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted;
}

.derived-value {
  @apply font-display text-base font-bold text-success;
}

.derived-input {
  @apply w-12 rounded border border-border/60 bg-background/60 px-1 py-0.5 text-center
    font-mono text-sm font-bold text-text;
}
.derived-input:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary) / 0.7);
}
.derived-input:disabled {
  @apply cursor-not-allowed opacity-70;
}

/* 技能行 */
.skill-input {
  @apply w-14 rounded border border-border/60 bg-background/60 px-1 py-0.5 text-center
    font-mono text-xs font-bold text-text;
}
.skill-input:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary) / 0.7);
}
.skill-input:disabled {
  @apply cursor-not-allowed opacity-70;
}

/* 战斗信息 */
.combat-info {
  @apply flex flex-col items-center rounded-lg border border-border/60 bg-background/40 p-2;
}

.combat-label {
  @apply mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted;
}

.combat-value {
  @apply font-display text-lg font-bold text-primary;
}
</style>
