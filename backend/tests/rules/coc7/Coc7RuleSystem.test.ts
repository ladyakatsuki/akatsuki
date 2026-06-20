import { describe, it, expect } from 'vitest';
import { coc7RuleSystem, getDamageBonus, getBuild, getMov } from '../../../src/rules/coc7/index.js';
import '../../../src/rules/index.js';
import { ruleSystemRegistry } from '../../../src/rules/Registry.js';

describe('Coc7RuleSystem', () => {
  describe('基础元信息', () => {
    it('应有正确的 id、主题与版本', () => {
      expect(coc7RuleSystem.id).toBe('coc7');
      expect(coc7RuleSystem.theme).toBe('coc');
      expect(coc7RuleSystem.name).toBe('COC 7版');
      expect(coc7RuleSystem.version).toBe('7e');
    });

    it('应支持 COC 7版所有骰子类型', () => {
      expect(coc7RuleSystem.diceTypes).toEqual(
        expect.arrayContaining(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']),
      );
    });
  });

  describe('属性模式（8 项核心属性）', () => {
    const attrKeys = coc7RuleSystem.attributeSchema.map((a) => a.key);

    it('应包含 8 项属性', () => {
      expect(coc7RuleSystem.attributeSchema).toHaveLength(8);
    });

    it('应包含 str/con/siz/dex/app/int/pow/edu', () => {
      expect(attrKeys).toEqual(
        expect.arrayContaining([
          'str',
          'con',
          'siz',
          'dex',
          'app',
          'int',
          'pow',
          'edu',
        ]),
      );
    });

    it('属性应有正确的缩写', () => {
      const map = Object.fromEntries(
        coc7RuleSystem.attributeSchema.map((a) => [a.key, a.abbreviation]),
      );
      expect(map.str).toBe('STR');
      expect(map.con).toBe('CON');
      expect(map.siz).toBe('SIZ');
      expect(map.dex).toBe('DEX');
      expect(map.app).toBe('APP');
      expect(map.int).toBe('INT');
      expect(map.pow).toBe('POW');
      expect(map.edu).toBe('EDU');
    });

    it('属性默认值应为 50，范围 1-100', () => {
      for (const attr of coc7RuleSystem.attributeSchema) {
        expect(attr.defaultValue).toBe(50);
        expect(attr.min).toBe(1);
        expect(attr.max).toBe(100);
      }
    });
  });

  describe('技能模式', () => {
    const skills = coc7RuleSystem.skillSchema;

    it('应包含完整技能列表（49 项）', () => {
      expect(skills.length).toBeGreaterThanOrEqual(40);
    });

    it('每个技能应有 key、name、attribute、defaultValue、category', () => {
      for (const skill of skills) {
        expect(skill.key).toBeTruthy();
        expect(skill.name).toBeTruthy();
        expect(skill.attribute).toBeTruthy();
        expect(typeof skill.defaultValue).toBe('number');
        expect(skill.category).toBeTruthy();
      }
    });

    it('应包含战斗技能分类', () => {
      const combatSkills = skills.filter((s) => s.category === '战斗');
      expect(combatSkills.length).toBeGreaterThan(0);
      const keys = combatSkills.map((s) => s.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'brawl',
          'dodge',
          'sword',
          'handgun',
          'rifle',
          'throw',
          'choke',
          'melee',
        ]),
      );
    });

    it('应包含调查技能分类', () => {
      const investigationSkills = skills.filter((s) => s.category === '调查');
      expect(investigationSkills.length).toBeGreaterThan(0);
      const keys = investigationSkills.map((s) => s.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'libraryUse',
          'perception',
          'psychology',
          'occult',
          'archaeology',
          'history',
          'naturalWorld',
        ]),
      );
    });

    it('应包含行动技能分类', () => {
      const actionSkills = skills.filter((s) => s.category === '行动');
      expect(actionSkills.length).toBeGreaterThan(0);
      const keys = actionSkills.map((s) => s.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'stealth',
          'listen',
          'climb',
          'jump',
          'driveAuto',
          'driveAircraft',
          'driveBoat',
          'ride',
          'swim',
          'survival',
          'track',
        ]),
      );
    });

    it('应包含社交技能分类', () => {
      const socialSkills = skills.filter((s) => s.category === '社交');
      expect(socialSkills.length).toBeGreaterThan(0);
      const keys = socialSkills.map((s) => s.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'charm',
          'persuasion',
          'intimidate',
          'reputation',
          'sleightOfHand',
          'hypnosis',
          'performance',
        ]),
      );
    });

    it('应包含学识技能分类', () => {
      const knowledgeSkills = skills.filter((s) => s.category === '学识');
      expect(knowledgeSkills.length).toBeGreaterThan(0);
      const keys = knowledgeSkills.map((s) => s.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'psychoanalysis',
          'firstAid',
          'medicine',
          'law',
          'accounting',
          'anthropology',
          'biology',
          'chemistry',
          'electronics',
          'geology',
          'electronicRepair',
          'mechanicalRepair',
          'artAndCraft',
          'foreignLanguage',
          'nativeLanguage',
          'cthulhuMythos',
        ]),
      );
    });

    it('关键技能应有正确的默认值', () => {
      const map = Object.fromEntries(skills.map((s) => [s.key, s.defaultValue]));
      expect(map.brawl).toBe(50);
      expect(map.sword).toBe(20);
      expect(map.handgun).toBe(20);
      expect(map.rifle).toBe(25);
      expect(map.throw).toBe(20);
      expect(map.choke).toBe(20);
      expect(map.melee).toBe(20);
      expect(map.firstAid).toBe(30);
      expect(map.intimidate).toBe(25);
      expect(map.reputation).toBe(15);
      expect(map.persuasion).toBe(10);
      expect(map.psychoanalysis).toBe(10);
      expect(map.psychology).toBe(10);
      expect(map.cthulhuMythos).toBe(0);
      expect(map.dodge).toBe(0); // 派生技能，初始为 0
      expect(map.nativeLanguage).toBe(0); // 派生技能，初始为 0
    });

    it('技能 key 应唯一', () => {
      const keys = skills.map((s) => s.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('computeDerived - 派生属性计算', () => {
    it('HP = (CON + SIZ) / 10 向下取整', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived.maxHp).toBe(10);
    });

    it('HP 应向下取整（CON=55, SIZ=55 → 11）', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 55,
        siz: 55,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived.maxHp).toBe(11);
    });

    it('HP 应向下取整（CON=53, SIZ=52 → 10）', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 53,
        siz: 52,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived.maxHp).toBe(10);
    });

    it('MP = POW / 5 向下取整', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived.maxMp).toBe(10);
    });

    it('MP 应向下取整（POW=53 → 10）', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 53,
        edu: 50,
      });
      expect(derived.maxMp).toBe(10);
    });

    it('MP 应向下取整（POW=55 → 11）', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 55,
        edu: 50,
      });
      expect(derived.maxMp).toBe(11);
    });

    it('最大 SAN = 99 - 克苏鲁神话（默认 0 → 99）', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived.maxSan).toBe(99);
    });

    it('最大 SAN 应减去克苏鲁神话技能值', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        cthulhuMythos: 10,
      });
      expect(derived.maxSan).toBe(89);
    });

    it('MOV 默认（DEX 不小于 STR/SIZ）应为 8', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 30,
      });
      expect(derived.mov).toBe(8);
    });

    it('MOV 当 DEX < STR < SIZ 时应为 7', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 60,
        con: 50,
        siz: 70,
        dex: 40,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 30,
      });
      expect(derived.mov).toBe(7);
    });

    it('MOV 当 DEX < SIZ < STR 时应为 7', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 70,
        con: 50,
        siz: 60,
        dex: 40,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 30,
      });
      expect(derived.mov).toBe(7);
    });

    it('MOV 年龄 40-49 应 -1', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 45,
      });
      expect(derived.mov).toBe(7);
    });

    it('MOV 年龄 50-59 应 -2', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 55,
      });
      expect(derived.mov).toBe(6);
    });

    it('MOV 年龄 60-69 应 -3', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 65,
      });
      expect(derived.mov).toBe(5);
    });

    it('MOV 年龄 70-79 应 -4', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 75,
      });
      expect(derived.mov).toBe(4);
    });

    it('MOV 年龄 80-89 应 -5', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 85,
      });
      expect(derived.mov).toBe(3);
    });

    it('缺失属性应使用默认值 50 计算', () => {
      const derived = coc7RuleSystem.computeDerived({});
      expect(derived.maxHp).toBe(10);
      expect(derived.maxMp).toBe(10);
      expect(derived.maxSan).toBe(99);
      expect(derived.mov).toBe(8);
    });
  });

  describe('DB 查表（STR + SIZ）', () => {
    it('STR+SIZ 2-64: DB = -2', () => {
      expect(getDamageBonus(2)).toBe(-2);
      expect(getDamageBonus(64)).toBe(-2);
    });

    it('STR+SIZ 65-84: DB = -1', () => {
      expect(getDamageBonus(65)).toBe(-1);
      expect(getDamageBonus(84)).toBe(-1);
    });

    it('STR+SIZ 85-124: DB = 0', () => {
      expect(getDamageBonus(85)).toBe(0);
      expect(getDamageBonus(124)).toBe(0);
    });

    it('STR+SIZ 125-164: DB = 1d4（编码 4）', () => {
      expect(getDamageBonus(125)).toBe(4);
      expect(getDamageBonus(164)).toBe(4);
    });

    it('STR+SIZ 165-204: DB = 1d6（编码 6）', () => {
      expect(getDamageBonus(165)).toBe(6);
      expect(getDamageBonus(204)).toBe(6);
    });

    it('STR+SIZ 205-284: DB = 2d6（编码 12）', () => {
      expect(getDamageBonus(205)).toBe(12);
      expect(getDamageBonus(284)).toBe(12);
    });

    it('STR+SIZ 285-364: DB = 3d6（编码 18）', () => {
      expect(getDamageBonus(285)).toBe(18);
      expect(getDamageBonus(364)).toBe(18);
    });

    it('STR+SIZ 365-444: DB = 4d6（编码 24）', () => {
      expect(getDamageBonus(365)).toBe(24);
      expect(getDamageBonus(444)).toBe(24);
    });

    it('STR+SIZ 445-524: DB = 5d6（编码 30）', () => {
      expect(getDamageBonus(445)).toBe(30);
      expect(getDamageBonus(524)).toBe(30);
    });

    it('computeDerived 应正确计算 DB', () => {
      // STR=30, SIZ=30 → STR+SIZ=60 → DB=-2
      const derived1 = coc7RuleSystem.computeDerived({
        str: 30,
        con: 50,
        siz: 30,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived1.db).toBe(-2);

      // STR=80, SIZ=80 → STR+SIZ=160 → DB=4 (1d4)
      const derived2 = coc7RuleSystem.computeDerived({
        str: 80,
        con: 50,
        siz: 80,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived2.db).toBe(4);

      // STR=100, SIZ=100 → STR+SIZ=200 → DB=6 (1d6)
      const derived3 = coc7RuleSystem.computeDerived({
        str: 100,
        con: 50,
        siz: 100,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived3.db).toBe(6);
    });
  });

  describe('Build 查表（STR + SIZ）', () => {
    it('STR+SIZ 2-64: Build = -2', () => {
      expect(getBuild(2)).toBe(-2);
      expect(getBuild(64)).toBe(-2);
    });

    it('STR+SIZ 65-84: Build = -1', () => {
      expect(getBuild(65)).toBe(-1);
      expect(getBuild(84)).toBe(-1);
    });

    it('STR+SIZ 85-124: Build = 0', () => {
      expect(getBuild(85)).toBe(0);
      expect(getBuild(124)).toBe(0);
    });

    it('STR+SIZ 125-164: Build = 1', () => {
      expect(getBuild(125)).toBe(1);
      expect(getBuild(164)).toBe(1);
    });

    it('STR+SIZ 165-204: Build = 2', () => {
      expect(getBuild(165)).toBe(2);
      expect(getBuild(204)).toBe(2);
    });

    it('STR+SIZ 205-284: Build = 3', () => {
      expect(getBuild(205)).toBe(3);
      expect(getBuild(284)).toBe(3);
    });

    it('STR+SIZ 285-364: Build = 4', () => {
      expect(getBuild(285)).toBe(4);
      expect(getBuild(364)).toBe(4);
    });

    it('computeDerived 应正确计算 Build', () => {
      // STR=30, SIZ=30 → STR+SIZ=60 → Build=-2
      const derived1 = coc7RuleSystem.computeDerived({
        str: 30,
        con: 50,
        siz: 30,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived1.build).toBe(-2);

      // STR=80, SIZ=80 → STR+SIZ=160 → Build=1
      const derived2 = coc7RuleSystem.computeDerived({
        str: 80,
        con: 50,
        siz: 80,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
      });
      expect(derived2.build).toBe(1);
    });
  });

  describe('getMov 函数', () => {
    it('DEX 不小于 STR/SIZ 时 MOV = 8', () => {
      expect(getMov(50, 50, 50, 30)).toBe(8);
    });

    it('DEX < STR < SIZ 时 MOV = 7', () => {
      expect(getMov(40, 50, 60, 30)).toBe(7);
    });

    it('DEX < SIZ < STR 时 MOV = 7', () => {
      expect(getMov(40, 60, 50, 30)).toBe(7);
    });

    it('年龄修正应正确应用', () => {
      expect(getMov(50, 50, 50, 45)).toBe(7);
      expect(getMov(50, 50, 50, 55)).toBe(6);
      expect(getMov(50, 50, 50, 65)).toBe(5);
      expect(getMov(50, 50, 50, 75)).toBe(4);
      expect(getMov(50, 50, 50, 85)).toBe(3);
    });
  });

  describe('createDefaultCharacter', () => {
    const data = coc7RuleSystem.createDefaultCharacter();

    it('应包含基础字段默认值', () => {
      expect(data.name).toBe('');
      expect(data.occupation).toBe('');
      expect(data.age).toBe(30);
      expect(data.sex).toBe('');
      expect(data.residence).toBe('');
      expect(data.birthplace).toBe('');
    });

    it('应包含 8 项属性默认值（50）', () => {
      expect(data.str).toBe(50);
      expect(data.con).toBe(50);
      expect(data.siz).toBe(50);
      expect(data.dex).toBe(50);
      expect(data.app).toBe(50);
      expect(data.int).toBe(50);
      expect(data.pow).toBe(50);
      expect(data.edu).toBe(50);
    });

    it('应包含幸运默认值（50）', () => {
      expect(data.luck).toBe(50);
    });

    it('应包含计算后的派生属性', () => {
      // 默认属性：CON=50, SIZ=50 → HP=10
      expect(data.maxHp).toBe(10);
      expect(data.hp).toBe(10);
      // POW=50 → MP=10
      expect(data.maxMp).toBe(10);
      expect(data.mp).toBe(10);
      // 默认 maxSan=99
      expect(data.maxSan).toBe(99);
      // 初始 SAN = POW = 50
      expect(data.san).toBe(50);
      // STR+SIZ=100 → DB=0, Build=0
      expect(data.db).toBe(0);
      expect(data.build).toBe(0);
      // 默认 MOV=8
      expect(data.mov).toBe(8);
    });

    it('应包含派生技能（闪避 = DEX×2，母语 = EDU×5）', () => {
      // DEX=50 → 闪避=100
      expect(data.dodge).toBe(100);
      // EDU=50 → 母语=250
      expect(data.nativeLanguage).toBe(250);
    });

    it('应包含所有技能默认值', () => {
      expect(data.brawl).toBe(50);
      expect(data.sword).toBe(20);
      expect(data.handgun).toBe(20);
      expect(data.rifle).toBe(25);
      expect(data.firstAid).toBe(30);
      expect(data.cthulhuMythos).toBe(0);
    });

    it('应包含战斗与背景字段', () => {
      expect(data.weapons).toBe('');
      expect(data.description).toBe('');
      expect(data.inventory).toBe('');
    });
  });

  describe('角色卡模板', () => {
    const template = coc7RuleSystem.characterSheetTemplate;

    it('应包含所有分页', () => {
      const sectionKeys = template.sections.map((s) => s.key);
      expect(sectionKeys).toEqual(
        expect.arrayContaining([
          'basic',
          'attributes',
          'combat_skills',
          'investigation_skills',
          'action_skills',
          'social_skills',
          'knowledge_skills',
          'combat',
          'background',
          'inventory',
        ]),
      );
      expect(template.sections.length).toBeGreaterThanOrEqual(10);
    });

    it('基础分页应包含 name/occupation/age/sex/residence/birthplace', () => {
      const basicFields = template.fields.filter((f) => f.section === 'basic');
      const keys = basicFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'name',
          'occupation',
          'age',
          'sex',
          'residence',
          'birthplace',
        ]),
      );
    });

    it('属性分页应包含 8 项核心属性', () => {
      const attrFields = template.fields.filter((f) => f.section === 'attributes');
      const keys = attrFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'str',
          'con',
          'siz',
          'dex',
          'app',
          'int',
          'pow',
          'edu',
        ]),
      );
    });

    it('属性分页应包含派生属性', () => {
      const attrFields = template.fields.filter((f) => f.section === 'attributes');
      const keys = attrFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'hp',
          'maxHp',
          'mp',
          'maxMp',
          'san',
          'maxSan',
          'db',
          'build',
          'mov',
          'luck',
        ]),
      );
    });

    it('派生属性字段应标记 computed', () => {
      const attrFields = template.fields.filter(
        (f) => f.section === 'attributes' && f.computed,
      );
      const keys = attrFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'maxHp',
          'maxMp',
          'maxSan',
          'db',
          'build',
          'mov',
        ]),
      );
    });

    it('战斗技能分页应包含战斗技能', () => {
      const fields = template.fields.filter((f) => f.section === 'combat_skills');
      const keys = fields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining([
          'brawl',
          'dodge',
          'sword',
          'handgun',
          'rifle',
          'throw',
          'choke',
          'melee',
        ]),
      );
    });

    it('技能字段应为 number 类型', () => {
      const skillFields = template.fields.filter((f) =>
        f.section.endsWith('_skills'),
      );
      for (const f of skillFields) {
        expect(f.type).toBe('number');
      }
    });

    it('战斗分页应包含 db/build/weapons', () => {
      const combatFields = template.fields.filter((f) => f.section === 'combat');
      const keys = combatFields.map((f) => f.key);
      expect(keys).toEqual(
        expect.arrayContaining(['dbCombat', 'buildCombat', 'weapons']),
      );
    });

    it('weapons 应为 textarea 类型', () => {
      const weapons = template.fields.find((f) => f.key === 'weapons');
      expect(weapons?.type).toBe('textarea');
    });

    it('背景分页应包含 description（textarea）', () => {
      const bgFields = template.fields.filter((f) => f.section === 'background');
      const desc = bgFields.find((f) => f.key === 'description');
      expect(desc).toBeDefined();
      expect(desc?.type).toBe('textarea');
    });

    it('物品分页应包含 inventory（textarea）', () => {
      const invFields = template.fields.filter((f) => f.section === 'inventory');
      const inv = invFields.find((f) => f.key === 'inventory');
      expect(inv).toBeDefined();
      expect(inv?.type).toBe('textarea');
    });
  });

  describe('战斗规则', () => {
    const combat = coc7RuleSystem.combatRules;

    it('先攻公式应为 1d100', () => {
      expect(combat.initiativeFormula).toBe('1d100');
    });

    it('先攻关联属性应为 dex', () => {
      expect(combat.initiativeAttribute).toBe('dex');
    });

    it('速度关联属性应为 mov', () => {
      expect(combat.speedAttribute).toBe('mov');
    });

    it('应包含 COC 7版状态效果', () => {
      const keys = combat.statusEffects.map((e) => e.key);
      const expected = [
        'temporaryInsanity',
        'insanity',
        'unconscious',
        'dying',
        'dead',
        'panic',
        'hysteria',
        'paranoia',
        'phobia',
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
    it('应可通过 ruleSystemRegistry.get("coc7") 获取', () => {
      expect(ruleSystemRegistry.has('coc7')).toBe(true);
      const system = ruleSystemRegistry.get('coc7');
      expect(system).toBe(coc7RuleSystem);
    });

    it('应同时保留 DND 5E 注册', () => {
      expect(ruleSystemRegistry.has('dnd5e')).toBe(true);
    });
  });

  describe('骰子解析器', () => {
    it('应使用 Coc7RollResolver', () => {
      const result = coc7RuleSystem.rollResolver.roll('d100');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
    });
  });
});
