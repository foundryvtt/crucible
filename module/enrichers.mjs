/**
 * Register custom text editor enrichers that are applied to Crucible content.
 */
export function registerEnrichers() {
  CONFIG.TextEditor.enrichers.push(
    { // D&D5e Skill Checks
      id: "dnd5eSkill",
      pattern: /\[\[\/skill ([\w\s]+)]]/g,
      enricher: enrichDND5ESkill,
      onRender: renderSkillCheck
    },
    { // Crucible Skill Checks
      id: "crucibleSkill",
      pattern: /\[\[\/skillCheck ([\w\s]+)]]/g,
      enricher: enrichSkillCheck,
      onRender: renderSkillCheck
    }
  )
}

/* -------------------------------------------- */

const DND5E_SKILL_MAPPING = {
  "acr": "athletics",
  "acrobatics": "athletics",
  "ani": "wilderness",
  "animalHandling": "wilderness",
  "arc": "arcana",
  "arcana": "arcana",
  "ath": "athletics",
  "athletics": "athletics",
  "dec": "deception",
  "deception": "deception",
  "his": "society",
  "history": "society",
  "ins": "deception",
  "insight": "deception",
  "itm": "intimidation",
  "intimidation": "intimidation",
  "inv": "awareness",
  "investigation": "awareness",
  "med": "medicine",
  "medicine": "medicine",
  "nat": "wilderness",
  "nature": "wilderness",
  "prc": "awareness",
  "perception": "awareness",
  "prf": "performance",
  "performance": "performance",
  "per": "diplomacy",
  "persuasion": "diplomacy",
  "rel": "arcana",
  "religion": "arcana",
  "slt": "stealth",
  "sleightOfHand": "stealth",
  "ste": "stealth",
  "stealth": "stealth",
  "sur": "wilderness",
  "survival": "wilderness"
};

function enrichDND5ESkill([match, terms]) {
  let [skillId, dc, ...rest] = terms.split(" ");
  if ( !(skillId in DND5E_SKILL_MAPPING) ) return match;
  // Scale difficulty for the translation between D&D and crucible
  dc = 12 + Math.round((dc - 10) * 1.5);
  const skill = SYSTEM.SKILLS[DND5E_SKILL_MAPPING[skillId]];
  const passive = rest.includes("passive");
  const tag = createSkillCheckElement(skill, dc, {passive, group: false});
  tag.classList.add("dnd5e-skill-check");
  return tag;
}

/* -------------------------------------------- */

function enrichSkillCheck([match, terms]) {
  let [skillId, dc, ...rest] = terms.split(" ");
  if ( skillId in DND5E_SKILL_MAPPING ) skillId = DND5E_SKILL_MAPPING[skillId];
  const skill = SYSTEM.SKILLS[skillId];
  if ( !skill ) return match;
  const passive = rest.includes("passive");
  const group = rest.includes("group");
  return createSkillCheckElement(skill, dc, {passive, group});
}

/* -------------------------------------------- */

function createSkillCheckElement(skill, dc, {passive=false, group=false}={}) {
  const tag = document.createElement("enriched-content");
  tag.classList.add("skill-check", skill.category);
  if ( passive ) tag.classList.add("passive-check");
  if ( group ) tag.classList.add("group-check");
  tag.dataset.skillId = skill.id;
  tag.dataset.dc = dc;
  tag.toggleAttribute("passive", !!passive);

  // Create label
  const label = [skill.label, `(DC ${dc})`];
  if ( group ) label.push("Group");
  if ( passive ) label.push("Passive");
  tag.innerHTML = label.join(" ");

  // Create tooltip
  tag.dataset.tooltipText = `${skill.label} Skill Check`;
  return tag;
}

/* -------------------------------------------- */

function renderSkillCheck(element) {
  element.addEventListener("click", onClickSkillCheck);
}

/* -------------------------------------------- */

function onClickSkillCheck(event) {
  event.preventDefault();
  const element = event.currentTarget;
  const {skillId, dc} = element.dataset;
  const actor = inferEnricherActor();
  const check = actor ? actor.getSkillCheck(skillId, {dc}) : new crucible.api.dice.StandardCheck({type: skillId, dc});
  check.dialog({request: game.user.isGM && !actor});
}

/* -------------------------------------------- */

function inferEnricherActor() {
  if ( canvas.ready && (canvas.tokens.controlled.length === 1) ) {
    const controlledToken = canvas.tokens.controlled[0];
    if ( controlledToken.actor?.isOwner ) return controlledToken.actor;
  }
  else if ( !game.user.isGM && game.user.character ) {
    if ( game.user.character?.isOwner ) return game.user.character;
  }
  return null;
}
