/**
 * Register custom text editor enrichers that are applied to Crucible content.
 */
export function registerEnrichers() {
  CONFIG.TextEditor.enrichers.push(
    {
      id: "award",
      pattern: /\[\[\/award ([\w\s]+)]]/g,
      enricher: enrichAward,
      onRender: renderAward
    },
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
      id: `crucibleTalent`,
      pattern: /\[\[\/talent (\w+)]]/g,
      enricher: enrichTalent
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
/*  Awards                                      */
/* -------------------------------------------- */

/**
 * Parse an award's terms into an object representing what should be gained
 * @param {string} terms
 * @returns {{currency: Record<string, string>, milestones: number | undefined, each: boolean}}
 * @throws {Error}
 */
function parseAwardTerms(terms) {
  const pattern = new RegExp(/^(.+?)(\D+)$/);
  const currency = {};
  const invalid = [];
  let milestones;
  let each = false;
  for ( const part of terms.split(" ") ) {
    if ( !part ) continue;
    let [, amount, label] = part.match(pattern) ?? [];
    label = label?.toLowerCase();
    try {
      new Roll(amount);
      if ( label in crucible.CONFIG.currency ) currency[label] = amount;
      else if ( ["milestone", "milestones"].includes(label) ) milestones = Number(amount);
      else if ( part === "each" ) each = true;
      else throw new Error();
    } catch(err) {
      invalid.push(part);
    }
  }

  if ( invalid.length ) throw new Error(game.i18n.format("AWARD.WARNINGS.InvalidTerms", {
    terms: game.i18n.getListFormatter().format(invalid.map(i => `"${i}"`))
  }));

  return { currency, milestones, each }
}

/**
 * Enrich an Award with the format [[/award {...awards}]]
 * @param {string} match
 * @param {string} terms
 */
function enrichAward([match, terms]) {
  let parsed;
  try {
    parsed = parseAwardTerms(terms);
  } catch(err) {
    return new Text(match);
  }
  const {currency, milestones, each} = parsed;
  const entries = [];
  const dataset = {};
  let tooltip;

  // Award Currency
  for ( const [currencyKey, amount] of Object.entries(currency) ) {
    const {icon, abbreviation} = crucible.CONFIG.currency[currencyKey];
    if ( icon ) {
      const i = `<i class="currency ${currencyKey}" style="background-image: url(${icon});"></i>`;
      entries.push(i, amount);
    }
    else entries.push(amount, abbreviation);
    tooltip = "AWARD.TOOLTIPS.Currency";
  }
  if ( entries.length && each ) entries.push(game.i18n.localize("AWARD.Each"));

  // Award Milestones
  if ( milestones ) {
    if ( entries.length ) {
      entries.push(game.i18n.localize("and"));
      tooltip = "AWARD.TOOLTIPS.CurrencyMilestone";
    }
    else tooltip = "AWARD.TOOLTIPS.Milestone";
    const plurals = new Intl.PluralRules(game.i18n.lang);
    const label = game.i18n.localize("AWARD.Milestone." + plurals.select(milestones));
    entries.push(milestones, label);
    dataset.milestones = milestones;
  }

  // Return the enriched content tag
  const tag = document.createElement("enriched-content");
  tag.classList.add("award");
  Object.assign(tag.dataset, dataset);
  tag.innerHTML = entries.join(" ");
  tag.setAttribute("aria-label", game.i18n.localize(tooltip));
  tag.toggleAttribute("data-tooltip", true);
  return tag;
}

/* -------------------------------------------- */

/**
 * Add interactivity to a rendered hazard enrichment.
 * @param {HTMLElement} element
 */
function renderAward(element) {
  element.addEventListener("click", onClickAward);
}

/* -------------------------------------------- */

async function onClickAward(event) {
  event.preventDefault();
  if ( !game.user.isGM ) return ui.notifications.warn("AWARD.WARNINGS.RequiresGM", { localize: true })

  const { currency, milestones, each } = foundry.utils.expandObject({...event.currentTarget.dataset});

  for ( const [key, formula] of Object.entries(currency) ) {
    const roll = await new Roll(`${formula}`).evaluate();
    currency[key] = roll.total;
  }

  let currencyEach = crucible.api.documents.CrucibleActor.convertCurrency(currency);

  // TODO: Consider pulling this logic out and using it for both hazard & award
  const partyMembers = crucible.party?.system.members || [];
  const partyMemberInput = foundry.applications.fields.createMultiSelectInput({
    name: "partyMember",
    type: "checkboxes",
    options: partyMembers.reduce((arr, m) => {
      if ( m.actor ) arr.push({value: m.actorId, label: m.actor.name, selected: true});
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
    window: {title: "Choose Recipient(s)", icon: "fa-solid fa-trophy"},
    content: `\
    ${partyMember.outerHTML}${anyActor.outerHTML}
    `,
  });

  if (!response) return;

  // Iterate over actor targets
  const targets = new Set([...response.partyMember, ...response.anyActor]);
  if ( each !== "true" ) currencyEach = Math.floor(currencyEach / targets.size);
  for ( const actorId of targets ) {
    const actor = game.actors.get(actorId);
    const startingCurrency = actor.system.currency;
    const newCurrency = Math.max(startingCurrency + currencyEach, 0);
    const startingMilestones = actor.system._source.advancement.milestones;
    const newMilestones = Math.max(startingMilestones + Number(milestones), 0);
    actor.update({
      "system.advancement.milestones": newMilestones,
      "system.currency": newCurrency
    });
  }
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
 * Enrich a talent check with format [[/talent {talentId}]]
 * @param {string} match       The full matched string
 * @param {string} talentId    The matched talent ID
 * @returns {HTMLSpanElement|string}
 */
function enrichTalent([match, talentId]) {
  let talentName = null;

  for ( const pack of crucible.CONFIG.packs.talent ) {
    const talent = fromUuidSync(foundry.utils.buildUuid({
      id: talentId,
      pack,
      documentName: `Item`
    }));

    if ( talent ) {
      talentName = talent.name;
      break;
    };
  };

  if ( !talentName || !talentId ) return new Text(match);
  const tag = document.createElement("enriched-content");
  tag.classList.add("talent-check", "passive-check", "group-check");
  tag.dataset.crucibleTooltip = "talentCheck";
  tag.dataset.talentId = talentId;
  tag.innerHTML = `Talent: ${talentName}`;
  return tag;
};

/* -------------------------------------------- */

/**
 * Enrich a language check with format [[/language {languageId}]]
 * @param {string} match              The full matched string
 * @param {string} knowledgeId        The matched knowledge ID
 * @returns {HTMLSpanElement|string}
 */
function enrichLanguage([match, languageId]) {
  const language = crucible.CONFIG.languages[languageId];
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
