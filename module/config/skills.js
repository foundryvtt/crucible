/**
 * The cost in skill points to obtain the next skill rank
 * @type {number[]}
 */
export const SKILL_RANKS = {
  0: {
    label: "SKILL.Untrained",
    description: "You have no formal training in this area. Any success you have is due to luck.",
    cost: 0,
    spent: 0,
    bonus: -4,
    path: false
  },
  1: {
    label: "SKILL.Novice",
    description: "You have been provided basic instruction or acquired practical experience in the basics of this skill.",
    cost: 1,
    spent: 1,
    bonus: 0,
    path: false
  },
  2: {
    label: "SKILL.Apprentice",
    description: "You have practiced and honed your skills to a strong functional degree.",
    cost: 1,
    spent: 2,
    bonus: 2,
    path: false
  },
  3: {
    label: "SKILL.Journeyman",
    description: "You are a subject matter expert in this area.",
    cost: 2,
    spent: 4,
    bonus: 4,
    path: true
  },
  4: {
    label: "SKILL.Master",
    description: "You are a true master of this skill and its techniques.",
    cost: 4,
    spent: 8,
    bonus: 8,
    path: false
  },
  5: {
    label: "SKILL.Grandmaster",
    description: "You are peerless in your mastery of this area.",
    cost: 4,
    spent: 12,
    bonus: 12,
    path: true
  }
};


/**
 * The cost in skill points to obtain the next skill rank
 * @type {number[]}
 */
export const SKILL_CATEGORIES = {
  "exp": {
    label: "Exploration",
    defaultIcon: "icons/skills/no-exp.jpg"
  },
  "kno": {
    label: "Knowledge",
    defaultIcon: "icons/skills/no-kno.jpg"
  },
  "soc": {
    label: "Social",
    defaultIcon: "icons/skills/no-soc.jpg"
  },
  "trd": {
    label: "Tradecraft",
    defaultIcon: "icons/skills/no-trd.jpg"
  }
};


// The starting outline of each skill. The final structure of the SKILLS const is derived from this data.
export const SKILLS = {
  acrobatics: {
    id: "acrobatics",
    label: "SKILLS.Acrobatics",
    category: "exp",
    abilities: ["strength", "dexterity"],
    paths: ["gymnast", "traceur", "dancer"]
  },
  perception: {
    id: "perception",
    label: "SKILLS.Perception",
    category: "exp",
    abilities: ["intellect", "wisdom"],
    paths: ["scout", "sentry", "empath"]
  },
  stealth: {
    id: "stealth",
    label: "SKILLS.Stealth",
    category: "exp",
    abilities: ["dexterity", "intellect"],
    paths: ["infiltrator", "safecracker", "pickpocket"]
  },
  survival: {
    id: "survival",
    label: "SKILLS.Survival",
    category: "exp",
    abilities: ["toughness", "wisdom"],
    paths: ["explorer", "hunter", "herbalist"]
  },
  arcana: {
    id: "arcana",
    label: "SKILLS.Arcana",
    category: "kno",
    abilities: ["intellect", "wisdom"],
    paths: ["diviner", "elementalist", "enchanter"]
  },
  investigation: {
    id: "investigation",
    label: "SKILLS.Investigation",
    category: "kno",
    abilities: ["intellect", "presence"],
    paths: ["detective", "spy", "tinkerer"]
  },
  lore: {
    id: "lore",
    label: "SKILLS.Lore",
    category: "kno",
    abilities: ["intellect", "wisdom"],
    paths: ["scholar", "historian", "storyteller"]
  },
  religion: {
    id: "religion",
    label: "SKILLS.Religion",
    category: "kno",
    abilities: ["wisdom", "presence"],
    paths: ["theologian", "crusader", "druid"]
  },
  bartering: {
    id: "bartering",
    label: "SKILLS.Bartering",
    category: "soc",
    abilities: ["intellect", "presence"],
    paths: ["antiquarian", "caravaner", "negotiator"]
  },
  deception: {
    id: "deception",
    label: "SKILLS.Deception",
    category: "soc",
    abilities: ["intellect", "presence"],
    paths: ["grifter", "illusionist", "mesmer"]
  },
  diplomacy: {
    id: "diplomacy",
    label: "SKILLS.Diplomacy",
    category: "soc",
    abilities: ["wisdom", "presence"],
    paths: ["dip1", "dip2", "dip3"]
  },
  intimidation: {
    id: "intimidation",
    label: "SKILLS.Intimidation",
    category: "soc",
    abilities: ["strength", "presence"],
    paths: ["int1", "int2", "int3"]
  },
  animal: {
    id: "animal",
    label: "SKILLS.AnimalHandling",
    category: "trd",
    abilities: ["strength", "wisdom"],
    paths: ["knight", "beastmaster", "warden"]
  },
  craftsmanship: {
    id: "craftsmanship",
    label: "SKILLS.Craftsmanship",
    category: "trd",
    abilities: ["dexterity", "intellect"],
    paths: ["trademaster", "artificer", "runekeeper"]
  },
  medicine: {
    id: "medicine",
    label: "SKILLS.Medicine",
    category: "trd",
    abilities: ["toughness", "intellect"],
    paths: ["apothecary", "chirurgeon", "occultist"]
  },
  performance: {
    id: "performance",
    label: "SKILLS.Performance",
    category: "trd",
    abilities: ["dexterity", "presence"],
    paths: ["musician", "artist", "athlete"]
  },
};


/**
 * Combine and configure Skills data to create an official record of skill progression throughout the system
 * Freeze the resulting object so it cannot be modified downstream
 * @param {Object} skills
 * @return {Object}
 */
function expandSkillConfig(skills) {
  for ( let [id, skill] of Object.entries(skills) ) {

    // Cache the internationalization prefix
    const langPrefix = skill.name;

    // Construct the skill object
    skill.id = id;
    skill.icon = `icons/skills/${id}.jpg`;
    skill.description = `${langPrefix}/Info`;
    skill.ranks = [];

    // Construct specialization paths
    skill.paths = skill.paths.reduce((paths, id) => {
      const lang = langPrefix + id.titleCase();
      paths[id] = {
        name: lang,
        icon: `icons/skills/${id}.jpg`,
        description: `${lang}Info`,
        ranks: []
      };
      return paths;
    }, {});

    // Populate rank information
    for (let [i, rank] of Object.entries(SKILL_RANKS)) {
      skill.ranks[i] = {
        rank: i,
        description: `${langPrefix}Rank${i}`
      };
      if ( i === "3" ) skill.ranks[i].description = "SKILL.ChoosePath";
      else if ( i === "5" ) skill.ranks[i].description = "SKILL.MasterPath";
      if (rank.path) {
        for (let path of Object.values(skill.paths)) {
          path.ranks[i] = {
            rank: i,
            description: `${path.name}${i}`
          };
        }
      }
    }
  }
  return skills;
}
expandSkillConfig(SKILLS);


/**
 * Translate the SKILLS configuration object using localization strings
 */
export function localizeSkillConfig(SYSTEM) {
  for ( let skill of Object.values(SYSTEM.SKILLS) ) {
    skill.label = game.i18n.localize(skill.label);
    skill.icon = `systems/${SYSTEM.id}/${skill.icon}`;
    skill.description = game.i18n.localize(`SKILLS.${skill.name}Info`);
    skill.tooltips = {
      value: game.i18n.format("SKILL.TooltipCheck", {
        a1: SYSTEM.ABILITIES[skill.abilities[0]].label,
        a2: SYSTEM.ABILITIES[skill.abilities[1]].label
      }),
      passive: game.i18n.localize("SKILL.TooltipPassive")
    };
    for ( let p of Object.values(skill.paths) ) {
      p.name = game.i18n.localize(p.name);
      p.description = game.i18n.localize(p.description);
      p.ranks.forEach(r => r.description = game.i18n.localize(r.description));
    }
    skill.ranks.forEach(r => r.description = game.i18n.localize(r.description));
  }
  Object.freeze(SYSTEM.SKILLS);
}
