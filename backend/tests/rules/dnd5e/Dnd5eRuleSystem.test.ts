import { describe, it, expect } from 'vitest';
import { dnd5eRuleSystem } from '../../../src/rules/dnd5e/index.js';
import '../../../src/rules/index.js';
import { ruleSystemRegistry } from '../../../src/rules/Registry.js';

describe('Dnd5eRuleSystem', () => {
  describe('基础元信息', () => {
    it('应有正确的 id、主题与版本', () => {
      expect(dnd5eRuleSystem.id).toBe('dnd5e');
      expect(dnd5eRuleSystem.theme).toBe('dnd');
      expect(dnd5eRuleSystem.name).toBe('DND 5E');
      expect(dnd5eRuleSystem.version).toBe('5e');
    });

    it('应支持 DND 5E 所有骰子类型', () => {
      expect(dnd5eRuleSystem.diceTypes).toEqual(
        expect.arrayContaining(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']),
      );
    });
  });

  describe('属性模式（6 项）', () => {
    const attrKeys = dnd5eRuleSystem.attributeSchema.map((a) => a.key);

    it('应包含 6 项属性', () => {
      expect(dnd5eRuleSystem.attributeSchema).toHaveLength(6);
    });

    it('应包含 str/dex/con/int/wis/cha', () => {
      expect(attrKeys).toEqual(
        expect.arrayContaining(['str', 'dex', 'con', 'int', 'wis', 'cha']),
      );
    });

    it('属性应有正确的缩写', () => {
      const map = Object.fromEntries(
        dnd5eRuleSystem.attributeSchema.map((a) => [a.key, a.abbreviation]),
      );
      expect(map.str).toBe('STR');
      expect(map.dex).toBe('DEX');
      expect(map.con).toBe('CON');
      expect(map.int).toBe('INT');
      expect(map.wis).toBe('WIS');
      expect(map.cha).toBe('CHA');
    });

    it('属性默认值应为 10，范围 1-30', () => {
      for (const attr of dnd5eRuleSystem.attributeSchema) {
        expect(attr.defaultValue).toBe(10);
        expect(attr.min).toBe(1);
        expect(attr.max).toBe(30);
      }
    });
  });

  describe('技能模式（18 项）', () => {
    const skills = dnd5eRuleSystem.skillSchema;

    it('应包含 18 项技能', () => {
      expect(skills).toHaveLength(18);
    });

    it('技能默认值应为 0', () => {
      for (const skill of skills) {
        expect(skill.defaultValue).toBe(0);
      }
    });

    it('运动关联 str', () => {
      const athletics = skills.find((s) => s.key === 'athletics');
      expect(athletics).toBeDefined();
      expect(athletics?.attribute).toBe('str');
    });

    it('杂技/巧手/隐匿关联 dex', () => {
      const map = Object.fromEntries(skills.map((s) => [s.key, s.attribute]));
      expect(map.acrobatics).toBe('dex');
      expect(map.sleightOfHand).toBe('dex');
      expect(map.stealth).toBe('dex');
    });

    it('奥秘/历史/调查/自然/宗教关联 int', () => {
      const map = Object.fromEntries(skills.map((s) => [s.key, s.attribute]));
      expect(map.arcana).toBe('int');
      expect(map.history).toBe('int');
      expect(map.investigation).toBe('int');
      expect(map.nature).toBe('int');
      expect(map.religion).toBe('int');
    });

    it('驯兽/洞察/医药/察觉/求生关联 wis', () => {
      const map = Object.fromEntries(skills.map((s) => [s.key, s.attribute]));
      expect(map.animalHandling).toBe('wis');
      expect(map.insight).toBe('wis');
      expect(map.medicine).toBe('wis');
      expect(map.perception).toBe('wis');
      expect(map.survival).toBe('wis');
    });

    it('欺瞒/威吓/表演/说服关联 cha', () => {
      const map = Object.fromEntries(skills.map((s) => [s.key, s.attribute]));
      expect(map.deception).toBe('cha');
      expect(map.intimidation).toBe('cha');
      expect(map.performance).toBe('cha');
      expect(map.persuasion).toBe('cha');
    });

    it('应包含全部 18 个技能 key', () => {
      const keys = skills.map((s) => s.key);
      const expected = [
        'athletics',
        'acrobatics',
        'sleightOfHand',
        'stealth',
        'arcana',
        'history',
        'investigation',
        'nature',
        'religion',
        'animalHandling',
        'insight',
        'medicine',
        'perception',
        'survival',
        'deception',
        'intimidation',
        'performance',
        'persuasion',
      ];
      expect(keys.sort()).toEqual(expected.sort());
    });
  });

  describe('computeDerived - 属性调整值', () => {
    it('属性值 10 时调整值应为 0', () => {
      const derived = dnd5eRuleSystem.computeDerived({
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      });
      expect(derived.strMod).toBe(0);
      expect(derived.dexMod).toBe(0);
      expect(derived.conMod).toBe(0);
      expect(derived.intMod).toBe(0);
      expect(derived.wisMod).toBe(0);
      expect(derived.chaMod).toBe(0);
    });

    it('属性值 14 时调整值应为 +2', () => {
      const derived = dnd5eRuleSystem.computeDerived({ str: 14 });
      expect(derived.strMod).toBe(2);
    });

    it('属性值 8 时调整值应为 -1', () => {
      const derived = dnd5eRuleSystem.computeDerived({ str: 8 });
      expect(derived.strMod).toBe(-1);
    });

    it('属性值 20 时调整值应为 +5', () => {
      const derived = dnd5eRuleSystem.computeDerived({ str: 20 });
      expect(derived.strMod).toBe(5);
    });

    it('奇数属性值应向下取整（13→+1, 7→-2）', () => {
      const derived = dnd5eRuleSystem.computeDerived({ str: 13, dex: 7 });
      expect(derived.strMod).toBe(1);
      expect(derived.dexMod).toBe(-2);
    });

    it('缺失属性应使用默认值 10 计算', () => {
      const derived = dnd5eRuleSystem.computeDerived({});
      expect(derived.strMod).toBe(0);
      expect(derived.dexMod).toBe(0);
    });
  });

  describe('computeDerived - 熟练加值', () => {
    it('1 级时熟练加值应为 +2', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 1 });
      expect(derived.proficiencyBonus).toBe(2);
    });

    it('4 级时熟练加值应为 +2', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 4 });
      expect(derived.proficiencyBonus).toBe(2);
    });

    it('5 级时熟练加值应为 +3', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 5 });
      expect(derived.proficiencyBonus).toBe(3);
    });

    it('8 级时熟练加值应为 +3', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 8 });
      expect(derived.proficiencyBonus).toBe(3);
    });

    it('9 级时熟练加值应为 +4', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 9 });
      expect(derived.proficiencyBonus).toBe(4);
    });

    it('12 级时熟练加值应为 +4', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 12 });
      expect(derived.proficiencyBonus).toBe(4);
    });

    it('13 级时熟练加值应为 +5', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 13 });
      expect(derived.proficiencyBonus).toBe(5);
    });

    it('16 级时熟练加值应为 +5', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 16 });
      expect(derived.proficiencyBonus).toBe(5);
    });

    it('17 级时熟练加值应为 +6', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 17 });
      expect(derived.proficiencyBonus).toBe(6);
    });

    it('20 级时熟练加值应为 +6', () => {
      const derived = dnd5eRuleSystem.computeDerived({ level: 20 });
      expect(derived.proficiencyBonus).toBe(6);
    });

    it('未提供 level 时默认 1 级（+2）', () => {
      const derived = dnd5eRuleSystem.computeDerived({});
      expect(derived.proficiencyBonus).toBe(2);
    });
  });

  describe('createDefaultCharacter', () => {
    const data = dnd5eRuleSystem.createDefaultCharacter();

    it('应包含基础字段默认值', () => {
      expect(data.name).toBe('');
      expect(data.class).toBe('');
      expect(data.level).toBe(1);
      expect(data.race).toBe('');
      expect(data.background).toBe('');
      expect(data.alignment).toBe('');
      expect(data.experience).toBe(0);
    });

    it('应包含 6 项属性默认值（10）', () => {
      expect(data.str).toBe(10);
      expect(data.dex).toBe(10);
      expect(data.con).toBe(10);
      expect(data.int).toBe(10);
      expect(data.wis).toBe(10);
      expect(data.cha).toBe(10);
    });

    it('应包含计算后的属性调整值（默认 0）', () => {
      expect(data.strMod).toBe(0);
      expect(data.dexMod).toBe(0);
      expect(data.conMod).toBe(0);
      expect(data.intMod).toBe(0);
      expect(data.wisMod).toBe(0);
      expect(data.chaMod).toBe(0);
    });

    it('应包含战斗字段默认值', () => {
      expect(data.hp).toBe(10);
      expect(data.maxHp).toBe(10);
      expect(data.ac).toBe(10);
      expect(data.speed).toBe(30);
    });

    it('应包含计算后的熟练加值（默认 +2）', () => {
      expect(data.proficiencyBonus).toBe(2);
    });

    it('应包含计算后的先攻（默认 dexMod=0）', () => {
      expect(data.initiative).toBe(0);
    });

    it('应包含 18 项技能默认值（0）', () => {
      const skillKeys = [
        'athletics',
        'acrobatics',
        'sleightOfHand',
        'stealth',
        'arcana',
        'history',
        'investigation',
        'nature',
        'religion',
        'animalHandling',
        'insight',
        'medicine',
        'perception',
        'survival',
        'deception',
        'intimidation',
        'performance',
        'persuasion',
      ];
      for (const key of skillKeys) {
        expect(data[key]).toBe(0);
      }
    });

    it('应包含被动察觉（默认 10）', () => {
      expect(data.passivePerception).toBe(10);
    });

    it('应包含法术字段', () => {
      expect(data.spellcastingAbility).toBe('none');
      // 1-9 环法术位
      for (let i = 1; i <= 9; i++) {
        expect(data[`spellSlot${i}`]).toBe(0);
      }
    });

    it('应包含背景字段', () => {
      expect(data.personalityTraits).toBe('');
      expect(data.ideals).toBe('');
      expect(data.bonds).toBe('');
      expect(data.flaws).toBe('');
    });

    it('应包含物品字段', () => {
      expect(data.inventory).toBe('');
    });

    it('应包含豁免熟练字段', () => {
      expect(data.strSaveProficient).toBe(false);
      expect(data.dexSaveProficient).toBe(false);
      expect(data.conSaveProficient).toBe(false);
      expect(data.intSaveProficient).toBe(false);
      expect(data.wisSaveProficient).toBe(false);
      expect(data.chaSaveProficient).toBe(false);
    });
  });

  describe('角色卡模板', () => {
    const template = dnd5eRuleSystem.characterSheetTemplate;

    it('应包含 7 个分页', () => {
      const sectionKeys = template.sections.map((s) => s.key);
      expect(sectionKeys).toEqual(
        expect.arrayContaining([
          'basic',
          'attributes',
          'combat',
          'skills',
          'spells',
          'background',
          'inventory',
        ]),
      );
      expect(template.sections).toHaveLength(7);
    });

    it('基础分页应包含 name/class/level/race/background/alignment/experience', () => {
      const basicFields = template.fields.filter((f) => f.section === 'basic');
      const keys = basicFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'name',
          'class',
          'level',
          'race',
          'background',
          'alignment',
          'experience',
        ]),
      );
    });

    it('属性分页应包含 6 项属性与计算调整值', () => {
      const attrFields = template.fields.filter((f) => f.section === 'attributes');
      const keys = attrFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'str',
          'dex',
          'con',
          'int',
          'wis',
          'cha',
          'strMod',
          'dexMod',
          'conMod',
          'intMod',
          'wisMod',
          'chaMod',
        ]),
      );
    });

    it('属性调整值字段应标记 computed', () => {
      const attrFields = template.fields.filter(
        (f) => f.section === 'attributes' && f.computed,
      );
      const keys = attrFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'strMod',
          'dexMod',
          'conMod',
          'intMod',
          'wisMod',
          'chaMod',
        ]),
      );
    });

    it('战斗分页应包含 hp/maxHp/ac/speed/initiative/proficiencyBonus', () => {
      const combatFields = template.fields.filter((f) => f.section === 'combat');
      const keys = combatFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'hp',
          'maxHp',
          'ac',
          'speed',
          'initiative',
          'proficiencyBonus',
        ]),
      );
    });

    it('initiative 与 proficiencyBonus 应为计算字段', () => {
      const initiative = template.fields.find((f) => f.key === 'initiative');
      expect(initiative?.computed).toBe(true);
      const profBonus = template.fields.find((f) => f.key === 'proficiencyBonus');
      expect(profBonus?.computed).toBe(true);
    });

    it('技能分页应包含 18 项技能与被动察觉', () => {
      const skillFields = template.fields.filter((f) => f.section === 'skills');
      const keys = skillFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'athletics',
          'acrobatics',
          'sleightOfHand',
          'stealth',
          'arcana',
          'history',
          'investigation',
          'nature',
          'religion',
          'animalHandling',
          'insight',
          'medicine',
          'perception',
          'survival',
          'deception',
          'intimidation',
          'performance',
          'persuasion',
          'passivePerception',
        ]),
      );
    });

    it('技能字段应为 checkbox 类型', () => {
      const skillFields = template.fields.filter(
        (f) => f.section === 'skills' && f.key !== 'passivePerception',
      );
      for (const f of skillFields) {
        expect(f.type).toBe('checkbox');
      }
    });

    it('被动察觉应为计算字段', () => {
      const passive = template.fields.find((f) => f.key === 'passivePerception');
      expect(passive?.computed).toBe(true);
    });

    it('法术分页应包含 spellcastingAbility 与法术位', () => {
      const spellFields = template.fields.filter((f) => f.section === 'spells');
      const keys = spellFields.map((f) => f.key);
      expect(keys).toContain('spellcastingAbility');
      for (let i = 1; i <= 9; i++) {
        expect(keys).toContain(`spellSlot${i}`);
      }
    });

    it('spellcastingAbility 应为 select 类型', () => {
      const field = template.fields.find((f) => f.key === 'spellcastingAbility');
      expect(field?.type).toBe('select');
      expect(field?.options).toBeDefined();
    });

    it('背景分页应包含 personalityTraits/ideals/bonds/flaws', () => {
      const bgFields = template.fields.filter((f) => f.section === 'background');
      const keys = bgFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'personalityTraits',
          'ideals',
          'bonds',
          'flaws',
        ]),
      );
    });

    it('背景字段应为 textarea 类型', () => {
      const bgFields = template.fields.filter((f) => f.section === 'background');
      for (const f of bgFields) {
        expect(f.type).toBe('textarea');
      }
    });

    it('物品分页应包含 inventory（textarea）', () => {
      const invFields = template.fields.filter((f) => f.section === 'inventory');
      const inv = invFields.find((f) => f.key === 'inventory');
      expect(inv).toBeDefined();
      expect(inv?.type).toBe('textarea');
    });
  });

  describe('战斗规则', () => {
    const combat = dnd5eRuleSystem.combatRules;

    it('先攻公式应为 1d20+dexMod', () => {
      expect(combat.initiativeFormula).toBe('1d20+dexMod');
    });

    it('先攻关联属性应为 dex', () => {
      expect(combat.initiativeAttribute).toBe('dex');
    });

    it('速度关联属性应为 speed（独立字段）', () => {
      expect(combat.speedAttribute).toBe('speed');
    });

    it('AC 应为独立字段（无关联属性）', () => {
      expect(combat.acAttribute).toBeUndefined();
    });

    it('应包含 DND 5E 标准状态效果', () => {
      const keys = combat.statusEffects.map((e) => e.key);
      const expected = [
        'blinded',
        'charmed',
        'deafened',
        'frightened',
        'grappled',
        'incapacitated',
        'invisible',
        'paralyzed',
        'petrified',
        'poisoned',
        'prone',
        'restrained',
        'stunned',
        'unconscious',
        'exhaustion',
      ];
      expect(keys.sort()).toEqual(expected.sort());
    });

    it('每个状态效果应有名称与描述', () => {
      for (const effect of combat.statusEffects) {
        expect(effect.name).toBeTruthy();
        expect(effect.description).toBeTruthy();
      }
    });
  });

  describe('注册到注册中心', () => {
    it('应可通过 ruleSystemRegistry.get("dnd5e") 获取', () => {
      expect(ruleSystemRegistry.has('dnd5e')).toBe(true);
      const system = ruleSystemRegistry.get('dnd5e');
      expect(system).toBe(dnd5eRuleSystem);
    });
  });

  describe('骰子解析器', () => {
    it('应使用 Dnd5eRollResolver', () => {
      const result = dnd5eRuleSystem.rollResolver.roll('d20');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });
  });
});
