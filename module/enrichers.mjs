/**
 * Register custom text editor enrichers that are applied to Crucible content.
 */
export function registerEnrichers() {
  CONFIG.TextEditor.enrichers.push(
    { // Crucible Hazards
      id: "crucibleHazard",
      pattern: /\[\[\/hazard ([\w\s]+)]](?:{([^}]+)})?/g,
      enricher: enrichHazard,
      onRender: renderHazard
    },
    { // Crucible Skill Checks
      id: "crucibleSkill",
      pattern: /\[\[\/skillCheck ([\w\s]+)]]/g,
      enricher: enrichSkillCheck,
      onRender: renderSkillCheck
    },
    { // Knowledge Test
      id: "crucibleKnowledge",
      pattern: /\[\[\/knowledge (\w+)]]/g,
      enricher: enrichKnowledge
    },
    { // Language Test
      id: "crucibleLanguage",
      pattern: /\[\[\/language (\w+)]]/g,
      enricher: enrichLanguage
    },
    { // D&D5e Skill Checks
      id: "dnd5eSkill",
      pattern: /\[\[\/skill ([\w\s]+)]]/g,
      enricher: enrichDND5ESkill,
      onRender: renderSkillCheck
    },
    {
      id: "crucibleCondition",
      pattern: /@Condition\[(\w+)]/g,
      enricher: enrichCondition
    },
    {
      id: "crucibleSpell",
      pattern: /@Spell\[([\w.]+)]/g,
      enricher: enrichSpell
    },
    {
      id: "reference",
      pattern: /@ref\[([\w.]+)](?:{([^}]+)})?/g,
      enricher: enrichRef
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
  if ( !(skillId in DND5E_SKILL_MAPPING) ) return new Text(match);
  const skill = SYSTEM.SKILLS[DND5E_SKILL_MAPPING[skillId]];
  const passive = rest.includes("passive");
  const tag = createSkillCheckElement(skill, dc, {passive, group: false});
  tag.classList.add("dnd5e-skill-check");
  return tag;
}

/* -------------------------------------------- */
/*  Hazard Tests                                */
/* -------------------------------------------- */

/**
 * Enrich a hazard test with the format [[/hazard {level} {...tags}]]
 * @param {string} match
 * @param {string} terms
 * @param {string} name
 */
function enrichHazard([match, terms, name]) {
  const [hazard, ...tags] = terms.split(" ");
  const action = crucible.api.models.CrucibleAction.createHazard(undefined, {hazard: Number(hazard), tags});

  // Construct label
  const hazardRank = `Hazard ${hazard}`;
  const tooltip = `${hazardRank} vs. ${SYSTEM.DEFENSES[action.usage.defenseType]?.label} dealing 
  ${SYSTEM.DAMAGE_TYPES[action.usage.damageType]?.label} damage to ${SYSTEM.RESOURCES[action.usage.resource]?.label}`;

  // Return the enriched content tag
  const tag = document.createElement("enriched-content");
  tag.classList.add("hazard-check");
  tag.dataset.hazard = hazard;
  tag.dataset.tags = tags;
  tag.innerHTML = name ? `${name} (${hazardRank})` : hazardRank;
  tag.dataset.tooltip = tooltip;
  return tag;
}

/* -------------------------------------------- */

/**
 * Add interactivity to a rendered hazard enrichment.
 * @param {HTMLElement} element
 */
function renderHazard(element) {
  element.addEventListener("click", onClickHazard);
}

/* -------------------------------------------- */

async function onClickHazard(event) {
  event.preventDefault();

  // Select a target
  let actor = inferEnricherActor();
  const partyMembers = crucible.party?.system.members || [];
  if ( !actor ) {
    const partyMemberInput = foundry.applications.fields.createMultiSelectInput({
      name: "partyMember",
      type: "checkboxes",
      options: partyMembers.reduce((arr, m) => {
        if ( m.actor ) arr.push({value: m.actorId, label: m.actor.name});
        return arr;
      }, [])
    })
    const partyMember = foundry.applications.fields.createFormGroup({
      label: "Party Members",
      hint: "Choose characters in the active party.",
      stacked: true,
      input: partyMemberInput
    });
    const anyActorInput = foundry.applications.elements.HTMLDocumentTagsElement.create({
      type: "Actor",
      name: "anyActor",
    });
    const anyActor = foundry.applications.fields.createFormGroup({
      label: "Any Actor",
      hint: "Alternatively, choose any Actors.",
      input: anyActorInput
    });
    const response = await foundry.applications.api.DialogV2.input({
      window: {title: "Choose Target", icon: "fa-solid fa-bullseye"},
      content: `\
      ${partyMember.outerHTML}${anyActor.outerHTML}
      `,
    });

    // Iterate over actor targets
    const element = event.target;
    const {hazard, tags} = element.dataset;
    const targets = new Set([...response.partyMember, ...response.anyActor]);
    for ( const actorId of targets ) {
      const actor = game.actors.get(actorId);
      const action = crucible.api.models.CrucibleAction.createHazard(actor, {
        name: element.innerText,
        hazard: Number(hazard),
        tags: tags.split(",")
      });
      // noinspection ES6MissingAwait
      action.use();
    }
  }
}

/* -------------------------------------------- */
/*  Conditions                                  */
/* -------------------------------------------- */

function enrichCondition([match, conditionId]) {
  const cfg = CONFIG.statusEffects.find(c => c.id === conditionId);
  if ( !cfg ) return new Text(match);
  const tag = document.createElement("enriched-content");
  tag.innerHTML = game.i18n.localize(cfg.name);
  tag.dataset.crucibleTooltip = "condition";
  tag.dataset.condition = conditionId;
  tag.classList.add("condition");
  return tag;
}

/* -------------------------------------------- */
/*  Spells                                      */
/* -------------------------------------------- */

function enrichSpell([match, spellId]) {
  let spell;
  if ( !spellId.startsWith("spell.") ) spellId = `spell.${spellId}`;
  try {
    spell = crucible.api.models.CrucibleSpellAction.fromId(spellId);
  } catch(err) {
    return new Text(match);
  }
  const tag = document.createElement("enriched-content");
  tag.innerHTML = spell.name;
  tag.dataset.spellId = spell.id;
  tag.classList.add("spell");
  tag.dataset.tooltip = "Spell tooltips are still TO-DO."; // TODO
  return tag;
}

/* -------------------------------------------- */
/*  Skill Checks                                */
/* -------------------------------------------- */

function enrichSkillCheck([match, terms]) {
  let [skillId, dc, ...rest] = terms.split(" ");
  if ( skillId in DND5E_SKILL_MAPPING ) skillId = DND5E_SKILL_MAPPING[skillId];
  const skill = SYSTEM.SKILLS[skillId];
  if ( !skill ) return new Text(match);
  const passive = rest.includes("passive");
  const group = rest.includes("group");
  return createSkillCheckElement(skill, dc, {passive, group});
}

/* -------------------------------------------- */

function createSkillCheckElement(skill, dc, {passive=false, group=false}={}) {
  const tag = document.createElement("enriched-content");
  tag.classList.add("skill-check", skill.category);
  if ( group ) tag.classList.add("group-check");
  tag.dataset.skillId = skill.id;
  tag.dataset.dc = dc;
  let dcLabel = `DC ${dc}`;

  // Passive checks only
  if ( passive ) {
    dcLabel += `, Passive`;
    tag.classList.add("passive-check");
    tag.dataset.crucibleTooltip = "passiveCheck";
  }

  // Group checks only
  if ( group ) dcLabel += `, Group`;

  // Create label
  tag.innerHTML = `${skill.label} (${dcLabel})`;
  return tag;
}

/* -------------------------------------------- */

/**
 * Enrich a knowledge check with format [[/knowledge {knowledgeId}]]
 * @param {string} match              The full matched string
 * @param {string} knowledgeId        The matched knowledge ID
 * @returns {HTMLSpanElement|string}
 */
function enrichKnowledge([match, knowledgeId]) {
  const knowledge = crucible.CONFIG.knowledge[knowledgeId];
  if ( !knowledge ) return new Text(match);
  const tag = document.createElement("enriched-content");
  tag.classList.add("knowledge-check", "passive-check", "group-check");
  tag.dataset.crucibleTooltip = "knowledgeCheck";
  tag.dataset.knowledgeId = knowledgeId;
  tag.innerHTML = `Knowledge: ${knowledge.label}`;
  return tag;
}

/* -------------------------------------------- */

/**
 * Enrich a language check with format [[/language {languageId}]]
 * @param {string} match              The full matched string
 * @param {string} knowledgeId        The matched knowledge ID
 * @returns {HTMLSpanElement|string}
 */
function enrichLanguage([match, languageId]) {
  const language = SYSTEM.ACTOR.LANGUAGES[languageId];
  if ( !language ) return new Text(match);
  const tag = document.createElement("enriched-content");
  tag.classList.add("language-check", "passive-check", "group-check");
  tag.dataset.crucibleTooltip = "languageCheck";
  tag.dataset.languageId = languageId;
  tag.innerHTML = `Language: ${language.label}`;
  return tag;
}

/* -------------------------------------------- */
/*  Helpers                                     */
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
    if ( controlledToken.actor?.isOwner && !controlledToken.document.isGroup ) return controlledToken.actor;
  }
  else if ( !game.user.isGM && game.user.character ) {
    if ( game.user.character?.isOwner ) return game.user.character;
  }
  return null;
}

/* -------------------------------------------- */
/*  Journal Helpers                             */
/* -------------------------------------------- */

function enrichRef([match, path, fallback], options) {
  const doc = options.relativeTo;
  if ( !doc ) return new Text(fallback || match);
  const attr = foundry.utils.getProperty(doc, path);
  return new Text(attr || fallback || match);
}
