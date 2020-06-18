import {skills} from "./skills.js";
import {attributes} from "./attributes.js";
import * as dice from "./dice.js";

const SYSTEM_ID = "crucible";

/**
 * Include all constant definitions within the SYSTEM global export
 * @type {Object}
 */
export const SYSTEM = {
  id: SYSTEM_ID,
  name: "Crucible (WIP)",
  attributes: attributes,
  skills: prepareSkillConfig(skills),
  attributeScores: ["strength", "dexterity", "constitution", "intellect", "willpower", "charisma"],
  attributePools: ["health", "wounds", "sanity", "stress", "action", "spell"],
  activeCheckFormula: "3d8",
  dice: dice
};


/* -------------------------------------------- */


/**
 * Combine and configure Skills data to create an official record of skill progression throughout the system
 * Freeze the resulting object so it cannot be modified downstream
 * @param {Object} skills
 * @return {Object}
 */
function prepareSkillConfig(skills) {
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