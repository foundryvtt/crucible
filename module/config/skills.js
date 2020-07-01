import {SYSTEM_ID} from "./system.js";


/**
 * The cost in skill points to obtain the next skill rank
 * @type {number[]}
 */
export const SKILL_RANKS = {
  0: {
    label: "SKILL.Untrained",
    description: "You have no formal training in this area. Any success you have is due to luck.",
    cost: 0,
    bonus: -4,
    progression: 0
  },
  1: {
    label: "SKILL.Novice",
    description: "You have been provided basic instruction or acquired practical experience in the basics of this skill.",
    cost: 1,
    bonus: 0,
    progression: 0
  },
  2: {
    label: "SKILL.Apprentice",
    description: "You have practiced and honed your skills to a strong functional degree.",
    cost: 2,
    bonus: 2,
    progression: 1,
  },
  3: {
    label: "SKILL.Journeyman",
    description: "You are a subject matter expert in this area.",
    cost: 4,
    bonus: 4,
    progression: 0
  },
  4: {
    label: "SKILL.Master",
    description: "You are a true master of this skill and its techniques.",
    cost: 7,
    bonus: 8,
    progression: 2
  },
  5: {
    label: "SKILL.Grandmaster",
    description: "You are peerless in your mastery of this area.",
    cost: 12,
    bonus: 12,
    progression: 3
  }
};


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
const SKILL_SCHEMA = {
  "acrobatics": {
    name:"SKILLS.Acrobatics",
    category:"exp",
    attributes: ["strength", "dexterity"],
    paths: ["gymnast", "traceur", "dancer"] // This specific array is not itself carried over to the new data structure
  },
  "perception": {
    name:"SKILLS.Perception",
    category:"exp",
    attributes: ["intellect", "wisdom"],
    paths: ["scout", "sentry", "empath"]
  },
  "stealth": {
    name:"SKILLS.Stealth",
    category:"exp",
    attributes: ["dexterity", "intellect"],
    paths: ["infiltrator", "safecracker", "pickpocket"]
  },
  "survival": {
    name:"SKILLS.Survival",
    category:"exp",
    attributes: ["constitution", "wisdom"],
    paths: ["explorer", "hunter", "herbalist"]
  },
  "arcana": {
    name:"SKILLS.Arcana",
    category:"kno",
    attributes: ["intellect", "wisdom"],
    paths: ["diviner", "elementalist", "enchanter"]
  },
  "investigation": {
    name:"SKILLS.Investigation",
    category:"kno",
    attributes: ["intellect", "charisma"],
    paths: ["detective", "spy", "tinkerer"]
  },
  "lore": {
    name:"SKILLS.Lore",
    category:"kno",
    attributes: ["intellect", "wisdom"],
    paths: ["scholar", "historian", "storyteller"]
  },
  "religion": {
    name:"SKILLS.Religion",
    category:"kno",
    attributes: ["wisdom", "charisma"],
    paths: ["theologian", "crusader", "druid"]
  },
  "bartering": {
    name:"SKILLS.Bartering",
    category:"soc",
    attributes: ["intellect", "charisma"],
    paths: ["antiquarian", "caravaner", "negotiator"]
  },
  "deception": {
    name:"SKILLS.Deception",
    category:"soc",
    attributes: ["intellect", "charisma"],
    paths: ["grifter", "illusionist", "mesmer"]
  },
  "diplomacy": {
    name:"SKILLS.Diplomacy",
    category:"soc",
    attributes: ["wisdom", "charisma"],
    paths: ["dip1", "dip2", "dip3"]
  },
  "intimidation": {
    name:"SKILLS.Intimidation",
    category:"soc",
    attributes: ["strength", "charisma"],
    paths: ["int1", "int2", "int3"]
  },
  "animal": {
    name:"SKILLS.AnimalHandling",
    category:"trd",
    attributes: ["strength", "wisdom"],
    paths: ["knight", "beastmaster", "warden"]
  },
  "craftsmanship": {
    name:"SKILLS.Craftsmanship",
    category:"trd",
    attributes: ["dexterity", "intellect"],
    paths: ["trademaster", "artificer", "runekeeper"]
  },
  "medicine": {
    name:"SKILLS.Medicine",
    category:"trd",
    attributes: ["constitution", "intellect"],
    paths: ["apothecary", "chirurgeon", "occultist"]
  },
  "performance": {
    name:"SKILLS.Performance",
    category:"trd",
    attributes: ["dexterity", "charisma"],
    paths: ["musician", "artist", "athlete"]
  },
};

const SKILL_THRESHOLDS = { // Ranks at which a skill or path gains extra descriptions.
  "skills": [0, 1, 3, 5],
  "paths": [2, 4, 5]
};

// Builds the SKILLS const based on the SKILL_SCHEMA and SKILL_THRESHOLDS constants
export const SKILLS = {};

for (let skillString in SKILL_SCHEMA) {
  let data = SKILL_SCHEMA[skillString];
  let skillLang = data.name; // text in lang keys for "Animal Handling" should be "SKILLS.AnimalHandling", etc.
  // skillLang is used BEFORE LOCALIZATION - Make sure that Acrobatics' name remains as literally "SKILLS.Acrobatics" for this process
  let skill = {
    name: data.name, category: data.category, attributes: data.attributes,
    icon: `icons/skills/${skillString}.jpg`,
    description: `${skillLang}Info`,
    ranks: [],
    paths: []
  };

  data.paths.forEach(path => { // Set up each path with basic data
    let pathLang = path.charAt(0).toUpperCase() + path.slice(1);
    skill.paths.push({
      id: path,
      name: `${skillLang}${pathLang}`,
      icon: `icons/skills/${path}.jpg`,
      description: `${skillLang}${pathLang}Info`,
      ranks: []
    });
  });

  for (let i=0; i<=5; i++) {
    skill.ranks[i] = { rank: i };
    if (SKILL_THRESHOLDS.skills.includes(i)) { skill.ranks[i].description = `${skillLang}Rank${i}` } // If a skill threshold exists here, add its description as an i18n key
    if (SKILL_THRESHOLDS.paths.includes(i)) { // If a path threshold exists here, add the relevant data, including its own description
      skill.ranks[i].progression = true;
      skill.paths.forEach(path => {
        path.ranks.push({ rank: i, description: `${skillLang}${path.name}${i}` }) // Example: {rank: 2, description: SKILLS.AcrobaticsTraceur2}
      })
    }
  }

  SKILLS[skillString] = skill;
}


/**
 * Combine and configure Skills data to create an official record of skill progression throughout the system
 * Freeze the resulting object so it cannot be modified downstream
 * @param {Object} skills
 * @return {Object}
 */
export function prepareSkillConfig(skills) {
  for ( let [id, skill] of Object.entries(skills.skills) ) {

    // Skill id, icon, and category
    skill.skillId = id;
    skill.icon = `systems/${SYSTEM_ID}/${skill.icon}`;
    skill.category = skills.categories[skill.category];

    // Skill ranks
    const ranks = duplicate(skills.ranks);
    skill.ranks.forEach(r => mergeObject(ranks[r.rank], r));
    skill.ranks = ranks;

    // Skill progression paths
    skill.paths.forEach(p => p.icon = `systems/${SYSTEM_ID}/${p.icon}`);
    skill.paths.unshift(duplicate(skills.noPath));
    skill.paths[0].icon = `systems/${SYSTEM_ID}/${skill.category.noPathIcon}`;
  }

  // Freeze the skills config so it cannot be modified
  Object.freeze(skills);
  return skills;
}
