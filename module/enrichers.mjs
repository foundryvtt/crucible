import { chooseActorsDialog } from "./interaction.mjs";

/**
 * Register custom text editor enrichers that are applied to Crucible content.
 */
export function registerEnrichers() {
  CONFIG.TextEditor.enrichers.push(
    {
      id: "award",
      pattern: /\[\[\/award ([-\w\s]+)]]/g,
      enricher: enrichAward,
      onRender: renderAward
    },
    {
      id: "crucibleCounterspell",
      pattern: /\[\[\/counterspell ([\w\s=]+)]]/g,
      enricher: enrichCounterspell,
      onRender: renderCounterspell
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
      id: "crucibleTalent",
      pattern: /\[\[\/talent ([\w.]+)]]/g,
      enricher: enrichTalent
    },
    {
      id: "crucibleCondition",
      pattern: /@Condition\[(\w+)]/g,
      enricher: enrichCondition
    },
    {
      id: "crucibleAction",
      pattern: /@Action\[([\w.]+) (\w+)]/g,
      enricher: enrichAction
    },
    {
      id: "crucibleSpell",
      pattern: /@Spell\[([\w.]+)]/g,
      enricher: enrichSpell
    },
    {
      id: "milestone",
      pattern: /\[\[\/milestone( \d+)?\]\]/g,
      enricher: enrichMilestone,
      onRender: renderMilestone
    },
    {
      id: "reference",
      pattern: /@ref\[([\w.]+)](?:{([^}]+)})?/g,
      enricher: enrichRef
    }
  );
}

/* -------------------------------------------- */

const DND5E_SKILL_MAPPING = {
  acr: "athletics",
  acrobatics: "athletics",
  ani: "wilderness",
  animalHandling: "wilderness",
  arc: "arcana",
  arcana: "arcana",
  ath: "athletics",
  athletics: "athletics",
  dec: "deception",
  deception: "deception",
  his: "society",
  history: "society",
  ins: "deception",
  insight: "deception",
  itm: "intimidation",
  intimidation: "intimidation",
  inv: "awareness",
  investigation: "awareness",
  med: "medicine",
  medicine: "medicine",
  nat: "wilderness",
  nature: "wilderness",
  prc: "awareness",
  perception: "awareness",
  prf: "performance",
  performance: "performance",
  per: "diplomacy",
  persuasion: "diplomacy",
  rel: "arcana",
  religion: "arcana",
  slt: "stealth",
  sleightOfHand: "stealth",
  ste: "stealth",
  stealth: "stealth",
  sur: "wilderness",
  survival: "wilderness"
};

/**
 * Enrich a D&D 5e skill check notation and convert it to the equivalent Crucible skill check element.
 * @param {RegExpMatchArray} matchArray
 */
function enrichDND5ESkill([match, terms]) {
  const [skillId, dc, ...rest] = terms.split(" ");
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
 * @returns {{currency: Record<string, string>, each: boolean}}
 * @throws {Error}
 */
function parseAwardTerms(terms) {
  const pattern = new RegExp(/^(.+?)(\D+)$/);
  const currency = {};
  const invalid = [];
  let each = false;
  for ( const part of terms.split(" ") ) {
    if ( !part ) continue;
    let [, amount, label] = part.match(pattern) ?? [];
    label = label?.toLowerCase();
    if ( part === "each" ) each = true;
    else if ( !Roll.validate(amount) ) invalid.push(part);
    else if ( label in crucible.CONFIG.currency ) currency[label] = amount;
    else invalid.push(part);
  }

  if ( invalid.length ) throw new Error(game.i18n.format("AWARD.WARNINGS.InvalidTerms", {
    terms: game.i18n.getListFormatter().format(invalid.map(i => `"${i}"`))
  }));

  return { currency, each };
}

/* -------------------------------------------- */

/**
 * Transform a currency object (currency key to amount) into a list of HTML entries for well-formatted display
 * @param {Record<string, string>} currency Currency object
 * @param {boolean} [forcePositive=false]   Whether to return positive-formatted text (to avoid double-negatives)
 * @returns {string[]}
 */
function formatAwardEntries(currency, forcePositive=false) {
  const entries = [];
  for ( const [currencyKey, amount] of Object.entries(currency) ) {
    const {icon, abbreviation} = crucible.CONFIG.currency[currencyKey];
    if ( icon ) {
      const i = `<i class="currency ${currencyKey}" style="background-image: url(${icon});"></i>`;
      entries.push(i, forcePositive ? Math.abs(amount) : amount);
    } else entries.push(forcePositive ? Math.abs(amount) : amount, abbreviation);
  }
  return entries;
}

/* -------------------------------------------- */

/**
 * Enrich an Award with the format [[/award {...awards}]]
 * @param {RegExpMatchArray} matchArray
 */
function enrichAward([match, terms]) {
  let parsed;
  try {
    parsed = parseAwardTerms(terms);
  } catch(err) {
    return new Text(match);
  }
  const {currency, each} = parsed;
  const dataset = {};

  // Award Currency
  for ( const [currencyKey, amount] of Object.entries(currency) ) dataset[`currency.${currencyKey}`] = amount;
  dataset.each = each;
  const entries = formatAwardEntries(currency);
  if ( entries.length && each ) entries.push(game.i18n.localize("AWARD.Each"));

  // Return the enriched content tag
  const tag = document.createElement("enriched-content");
  tag.classList.add("award");
  tag.classList.add("currencies-inline");
  Object.assign(tag.dataset, dataset);
  tag.innerHTML = entries.join(" ");
  tag.setAttribute("aria-label", game.i18n.localize("AWARD.TOOLTIPS.Currency"));
  tag.toggleAttribute("data-tooltip", true);
  return tag;
}

/* -------------------------------------------- */

/**
 * Add interactivity to a rendered award enrichment.
 * @param {HTMLElement} element
 */
function renderAward(element) {
  element.addEventListener("click", onClickAward);
}

/* -------------------------------------------- */

/**
 * Handle a click on an award enriched element, prompting the GM to distribute currency to selected actors.
 * @param {Event} event
 */
async function onClickAward(event) {
  event.preventDefault();
  if ( !game.user.isGM ) return ui.notifications.warn("AWARD.WARNINGS.RequiresGM", { localize: true });

  const { currency, each: eachString } = foundry.utils.expandObject({...event.currentTarget.dataset});
  const each = eachString === "true";

  const rolls = [];

  for ( const [key, formula] of Object.entries(currency) ) {
    const roll = await new Roll(`${formula}[${crucible.CONFIG.currency[key]?.label ?? key}]`).evaluate();
    currency[key] = roll.total;
    if ( !roll.isDeterministic ) rolls.push(roll);
  }

  let currencyEach = crucible.api.documents.CrucibleActor.convertCurrency(currency);

  const targets = await chooseActorsDialog({
    dialogTitle: game.i18n.localize(`AWARD.Title${currencyEach < 0 ? "Cost" : "Reward"}`),
    dialogIcon: "fa-solid fa-trophy"
  });
  if (!targets.size) return;

  // Iterate over actor targets
  if ( !each ) currencyEach = Math.floor(currencyEach / targets.size);
  if ( currencyEach < 0 ) {
    const cannotAfford = targets.filter(a => a.system.currency < -currencyEach).map(a => a.name);
    if ( cannotAfford.size ) return ui.notifications.warn(game.i18n.format("AWARD.WARNINGS.CannotAfford", {actors: Array.from(cannotAfford).join(", ")}));
  }
  for ( const actor of targets ) {
    const startingCurrency = actor.system.currency;
    const newCurrency = Math.max(startingCurrency + currencyEach, 0);
    actor.update({
      "system.currency": newCurrency
    });
  }

  const currencyEntries = formatAwardEntries(currency, true);
  const rollsHTML = await Promise.all(rolls.map(r => r.render()));
  await ChatMessage.implementation.create({
    content: `
    <section class="crucible">
      <div class="currencies-inline">
        ${game.i18n.format(`AWARD.SUMMARIES.${(currencyEach < 0) ? "Cost" : "Reward"}${each ? "" : "Split"}`, {award: currencyEntries.join(" ")})}
      </div>
      <ul class="plain">${Array.from(targets.map(a => `<li>${a.name}</li>`)).join("")}</ul>
    </section>
    `.concat(rollsHTML.join("")),
    rolls,
    speaker: {user: game.user},
    flags: {crucible: {isAwardSummary: true}}
  });
}

/* -------------------------------------------- */
/*                 Counterspell                 */
/* -------------------------------------------- */

/**
 * Parse a counterspell's terms into an object representing the configuration of the counterspell
 * @param {string} terms
 * @returns {{rune: string, gesture: string, inflection: string|undefined, dc: string}}
 * @throws {Error}
 */
function parseCounterspellTerms(terms) {
  const pattern = new RegExp(/^(\w+)=?(\w+)?$/);
  const matches = {};
  const invalid = [];

  // TODO: Handle multiple same-component values. Currently, just keeping the last one
  for ( const part of terms.split(" ") ) {
    if ( !part ) continue;
    const [, component, value] = part.match(pattern) ?? [];
    switch ( component ) {
      case "rune":
        if ( value in SYSTEM.SPELL.RUNES ) matches[component] = value;
        else invalid.push(part);
        break;
      case "gesture":
        if ( value in SYSTEM.SPELL.GESTURES ) matches[component] = value;
        else invalid.push(part);
        break;
      case "inflection":
        if ( value in SYSTEM.SPELL.INFLECTIONS ) matches[component] = value;
        else invalid.push(part);
        break;
      case "dc":
        matches[component] = value;
        break;
      default:
        invalid.push(part);
    }
  }

  if ( invalid.length ) throw new Error(game.i18n.format("SPELL.COUNTERSPELL.WARNINGS.InvalidTerms", {
    terms: game.i18n.getListFormatter().format(invalid.map(i => `"${i}"`))
  }));

  if ( ["rune", "gesture"].some(c => !(c in matches)) ) throw new Error(game.i18n.localize("SPELL.COUNTERSPELL.WARNINGS.MissingComponents"));

  return matches;
}

/**
 * Enrich a Counterspell with the format [[/counterspell {...config}]]
 * @param {RegExpMatchArray} matchArray
 */
function enrichCounterspell([match, terms]) {
  let parsed;
  try {
    parsed = parseCounterspellTerms(terms);
  } catch(err) {
    return new Text(match);
  }
  const {rune, gesture, inflection, dc="15"} = parsed;
  const dataset = {rune, gesture, dc};
  if ( inflection ) dataset.inflection = inflection;

  // Return the enriched content tag
  const tag = document.createElement("enriched-content");
  tag.classList.add("counterspell");
  Object.assign(tag.dataset, dataset);
  const innerElements = [];
  innerElements.push(SYSTEM.SPELL.RUNES[rune].name);
  innerElements.push(SYSTEM.SPELL.GESTURES[gesture].name);
  if ( inflection ) innerElements.push(SYSTEM.SPELL.INFLECTIONS[inflection].name);
  innerElements.push(game.i18n.format("DICE.DCSpecific", {dc}));
  tag.innerHTML = game.i18n.format("SPELL.COUNTERSPELL.Detailed", {details: innerElements.join(", ")});
  tag.dataset.crucibleTooltip = "talentCheck";
  tag.dataset.talentUuid = "Compendium.crucible.talent.Item.counterspell0000";
  return tag;
}

/* -------------------------------------------- */

/**
 * Add interactivity to a rendered counterspell enrichment.
 * @param {HTMLElement} element
 */
function renderCounterspell(element) {
  element.addEventListener("click", onClickCounterspell);
}

/* -------------------------------------------- */

/**
 * Handle a click on a counterspell enriched element, prompting eligible actors to attempt a counterspell.
 * @param {Event} event
 */
async function onClickCounterspell(event) {
  event.preventDefault();
  const {rune, gesture, inflection, dc: dcString} = event.currentTarget.dataset;
  const dc = Number(dcString);
  const actor = inferEnricherActor();

  // If inferred can counterspell, prompt
  if ( actor?.actions.counterspell ) return crucible.api.models.CrucibleCounterspellAction
    .prompt(actor, {rune, gesture, inflection, dc});

  // Prompt GM to pick among counterspellable party members
  const actors = crucible.party?.system.members.reduce((acc, {actor}) => {
    if ( actor.actions.counterspell ) acc.push(actor);
    return acc;
  }, []);
  const targets = await chooseActorsDialog({
    dialogTitle: "SPELL.COUNTERSPELL.Name",
    dialogIcon: "fa-solid fa-magic-wand",
    actors
  });
  if (!targets.size) return;

  // Iterate over actor targets
  for ( const actor of targets ) {
    if ( !actor?.actions.counterspell ) {
      ui.notifications.warn(game.i18n.format("SPELL.COUNTERSPELL.WARNINGS.NoTalent", {actor: actor?.name}));
      continue;
    }
    // TODO: Consider whether to prompt multiple users
    const designatedUser = game.users.getDesignatedUser(user => {
      if ( !user.active ) return false;
      if ( user.isGM ) return false;
      return actor?.testUserPermission(user, "OWNER");
    });
    if ( designatedUser ) designatedUser.query("requestCounterspell", {actorUuid: actor.uuid, rune, gesture, inflection, dc});
    else {
      ui.notifications.warn(game.i18n.format("SPELL.COUNTERSPELL.WARNINGS.NoUser", {actor: actor?.name}));
      crucible.api.models.CrucibleCounterspellAction.prompt(actor, {rune, gesture, inflection, dc});
    }
  }
}

/* -------------------------------------------- */
/*  Milestones                                  */
/* -------------------------------------------- */

/**
 * Enrich a Milestone award with the format [[/milestone]] or [[/milestone {quantity}]].
 * @param {RegExpMatchArray} terms
 * @returns {HTMLEnrichedContentElement}
 */
function enrichMilestone([_match, term]) {
  const quantity = Number.isNumeric(term) ? Number(term) : 1;
  const plurals = new Intl.PluralRules(game.i18n.lang);
  const tag = document.createElement("enriched-content");
  tag.classList.add("award", "milestone");
  tag.dataset.quantity = String(quantity);
  tag.innerHTML = `${quantity} ${game.i18n.localize(`AWARD.MILESTONE.${plurals.select(quantity)}`)}`;
  tag.setAttribute("aria-label", game.i18n.localize("AWARD.TOOLTIPS.Milestone"));
  tag.toggleAttribute("data-tooltip", true);
  return tag;
}

/* -------------------------------------------- */

/**
 * Add interactivity to a rendered milestone enrichment.
 * @param {HTMLElement} element
 */
function renderMilestone(element) {
  element.addEventListener("click", onClickMilestone);
}

/* -------------------------------------------- */

/**
 * Handle a click on a milestone enriched element, prompting the GM to award milestones to party members.
 * @param {Event} event
 */
async function onClickMilestone(event) {
  event.preventDefault();
  if ( !crucible.party ) return ui.notifications.warn("WARNING.NoParty", { localize: true });

  const quantity = event.currentTarget.dataset.quantity;
  await crucible.party.system.awardMilestoneDialog(quantity);
}

/* -------------------------------------------- */
/*  Hazard Tests                                */
/* -------------------------------------------- */

/**
 * Enrich a hazard test with the format [[/hazard {level} {...tags}]]
 * @param {RegExpMatchArray} matchArray
 */
function enrichHazard([_match, terms, name]) {
  const [hazard, ...tags] = terms.split(" ");
  const action = crucible.api.models.CrucibleAction.createHazard(undefined, {hazard: Number(hazard), tags});

  // Prepare label
  const hazardRank = `Hazard ${hazard}`;
  const parenthetical = name ? [hazardRank] : [];
  for ( const t of tags ) {
    const cfg = SYSTEM.ACTION.TAGS[t];
    if ( cfg && cfg.label && !cfg.internal ) parenthetical.push(cfg.label);
  }
  let label = name || hazardRank;
  if ( parenthetical.length ) label += ` (${parenthetical.join(", ")})`;

  // Prepare tooltip
  const tooltip = `${hazardRank} vs. ${SYSTEM.DEFENSES[action.usage.defenseType]?.label} dealing
  ${SYSTEM.DAMAGE_TYPES[action.usage.damageType]?.label} damage to ${SYSTEM.RESOURCES[action.usage.resource]?.label}`;

  // Return the enriched content tag
  const tag = document.createElement("enriched-content");
  tag.classList.add("hazard-check");
  Object.assign(tag.dataset, {hazard, tags, tooltip});
  tag.innerHTML = label;
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

/**
 * Handle a click on a hazard enriched element, executing the hazard check action for the actor.
 * @param {Event} event
 */
async function onClickHazard(event) {
  event.preventDefault();
  const element = event.target;
  const {hazard, tags} = element.dataset;

  // Select a target
  const actor = inferEnricherActor();
  const targets = actor ? [actor] : (await chooseActorsDialog());

  // Iterate over actor targets
  for ( const actor of targets ) {
    const action = crucible.api.models.CrucibleAction.createHazard(actor, {
      name: element.innerText,
      hazard: Number(hazard),
      tags: tags.split(",")
    });
    // noinspection ES6MissingAwait
    action.use();
  }
}

/* -------------------------------------------- */
/*  Conditions                                  */
/* -------------------------------------------- */

/**
 * Enrich a condition reference into an interactive element displaying the condition name and tooltip.
 * @param {RegExpMatchArray} matchArray
 */
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
/*  Actions                                     */
/* -------------------------------------------- */

/**
 * Enrich a reference to a specific action using syntax @Action[{actorUUID} {actionId}].
 * @param {RegExpMatchArray} matchArray
 * @returns {HTMLEnrichedContentElement|string}
 */
function enrichAction([match, actorUUID, actionId]) {
  const actor = fromUuidSync(actorUUID);
  if ( !actor ) return match;
  const action = actor.actions[actionId];
  if ( !action ) return match;
  const tag = document.createElement("enriched-content");
  tag.classList.add("action");
  tag.dataset.uuid = actorUUID;
  tag.dataset.actionId = actionId;
  tag.dataset.crucibleTooltip = "action";
  tag.innerText = action.name;
  return tag;
}

/* -------------------------------------------- */


/**
 * Enrich a spell reference into an interactive element linking to the spell action.
 * @param {RegExpMatchArray} matchArray
 */
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
  tag.classList.add("action", "spell");
  tag.dataset.tooltip = "Spell tooltips are still TO-DO."; // TODO
  return tag;
}


/* -------------------------------------------- */
/*  Skill Checks                                */
/* -------------------------------------------- */

/**
 * Enrich a skill check notation into an interactive element that triggers a skill roll.
 * @param {RegExpMatchArray} matchArray
 */
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

/**
 * Create an enriched-content element representing a skill check with the given skill, DC, and options.
 * @param {object} skill
 * @param {number} dc
 * @param {object} options
 * @param {boolean} options.passive
 * @param {boolean} options.group
 */
function createSkillCheckElement(skill, dc, {passive=false, group=false}={}) {
  const tag = document.createElement("enriched-content");
  tag.classList.add("skill-check", skill.category);
  if ( group ) tag.classList.add("group-check");
  tag.dataset.skillId = skill.id;
  tag.dataset.dc = dc;
  let dcLabel = `DC ${dc}`;

  // Passive checks only
  if ( passive ) {
    dcLabel += ", Passive";
    tag.classList.add("passive-check");
    tag.dataset.crucibleTooltip = "passiveCheck";
  }

  // Group checks only
  if ( group ) dcLabel += ", Group";

  // Create label
  tag.innerHTML = `${skill.label} (${dcLabel})`;
  return tag;
}

/* -------------------------------------------- */

/**
 * Enrich a knowledge check with format [[/knowledge {knowledgeId}]]
 * @param {RegExpMatchArray} matchArray
 * @returns {HTMLSpanElement|string}
 */
function enrichKnowledge([match, knowledgeId]) {
  const knowledge = crucible.CONFIG.knowledge[knowledgeId];
  if ( !knowledge ) return new Text(match);
  const tag = document.createElement("enriched-content");
  tag.classList.add("knowledge-check", "passive-check", "group-check");
  tag.dataset.crucibleTooltip = "knowledgeCheck";
  tag.dataset.knowledgeId = knowledgeId;
  tag.innerHTML = game.i18n.format("ACTOR.KnowledgeSpecific", {knowledge: knowledge.label});
  return tag;
}

/* -------------------------------------------- */

/**
 * Enrich a talent check with format [[/talent {talentUuid}]]
 * @param {RegExpMatchArray} matchArray
 * @returns {HTMLSpanElement|string}
 */
function enrichTalent([match, talentUuid]) {
  const talentIndex = fromUuidSync(talentUuid); // We only need the index
  if ( !talentIndex ) return new Text(match);
  const tag = document.createElement("enriched-content");
  tag.classList.add("talent-check", "passive-check", "group-check");
  tag.dataset.crucibleTooltip = "talentCheck";
  tag.dataset.talentUuid = talentUuid;
  tag.innerHTML = `Talent: ${talentIndex.name}`;
  return tag;
}

/* -------------------------------------------- */

/**
 * Enrich a language check with format [[/language {languageId}]]
 * @param {RegExpMatchArray} matchArray
 * @returns {HTMLSpanElement|string}
 */
function enrichLanguage([match, languageId]) {
  const language = crucible.CONFIG.languages[languageId];
  if ( !language ) return new Text(match);
  const tag = document.createElement("enriched-content");
  tag.classList.add("language-check", "passive-check", "group-check");
  tag.dataset.crucibleTooltip = "languageCheck";
  tag.dataset.languageId = languageId;
  tag.innerHTML = game.i18n.format("ACTOR.LanguageSpecific", {language: language.label});
  return tag;
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/**
 * Add interactivity to a rendered skill check enrichment.
 * @param {HTMLElement} element
 */
function renderSkillCheck(element) {
  element.addEventListener("click", onClickSkillCheck);
}

/* -------------------------------------------- */

/**
 * Handle a click on a skill check enriched element, creating and optionally displaying a skill check roll.
 * @param {Event} event
 */
function onClickSkillCheck(event) {
  event.preventDefault();
  const element = event.currentTarget;
  const {skillId, dc} = element.dataset;
  const actor = inferEnricherActor();
  const check = actor ? actor.getSkillCheck(skillId, {dc}) : new crucible.api.dice.StandardCheck({type: skillId, dc});
  check.dialog({request: game.user.isGM && !actor});
}

/* -------------------------------------------- */

/**
 * Infer the actor associated with the current user for use in enricher click handlers.
 */
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

/**
 * Enrich a reference annotation by resolving a property path on the relative document.
 * @param {RegExpMatchArray} matchArray
 * @param {object} options
 */
function enrichRef([match, path, fallback], options) {
  const doc = options.relativeTo;
  if ( !doc ) return new Text(fallback || match);
  const attr = foundry.utils.getProperty(doc, path);
  return new Text(attr || fallback || match);
}
