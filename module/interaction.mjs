/**
 * The shared template which renders a rule tooltip as a title followed by description content.
 * @type {string}
 */
export const RULE_TOOLTIP_TEMPLATE = "systems/crucible/templates/tooltips/tooltip-rule.hbs";

/* -------------------------------------------- */

/**
 * Prepare the rendering context for {@link RULE_TOOLTIP_TEMPLATE}.
 * @param {string} name       Title displayed above the description
 * @param {string} tooltip    Description content, either HTML or a plain string
 * @returns {Promise<{name: string, tooltip: string}>}
 */
export async function getRuleTooltipContext(name, tooltip) {
  const enriched = await CONFIG.ux.TextEditor.enrichHTML(tooltip);
  return {name, tooltip: enriched.trimStart().startsWith("<p") ? enriched : `<p>${enriched}</p>`};
}

/* -------------------------------------------- */

/**
 * Handle pointer enter events to take control over crucible dynamic system tooltips.
 * @param {PointerEvent} event
 */
export function onPointerEnter(event) {
  if ( !("crucibleTooltip" in event.target.dataset) ) return;
  if ( "tooltipHtml" in event.target.dataset ) return; // Don't double-render
  switch ( event.target.dataset.crucibleTooltip ) {
    case "action":
      return displayActionTooltip(event);
    case "equipment":
    case "accessory":
    case "activeEffect":
    case "armor":
    case "backpack":
    case "spell":
    case "talent":
    case "toolbelt":
    case "weapon":
      return displayFromUuid(event);
    case "knowledgeCheck":
      return displayKnowledgeCheck(event);
    case "talentCheck":
      return displayTalentCheck(event);
    case "languageCheck":
      return displayLanguageCheck(event);
    case "passiveCheck":
      return displayPassiveCheck(event);
    case "tag":
      return displayTagTooltip(event);
  }
}

/* -------------------------------------------- */

/**
 * Handle pointer leave events to remove the crucible tooltip so it is later regenerated.
 * @param {PointerEvent} event
 */
export function onPointerLeave(event) {
  const element = event.target;
  if ( "crucibleTooltip" in element.dataset ) {
    window.setTimeout(() => {
      if ( (game.tooltip.element === element) || element.matches(":hover") ) return;
      delete element.dataset.tooltipHtml;
    }, 2000);
  }
}

/* -------------------------------------------- */

/**
 * Display an action card as a tooltip.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayActionTooltip(event) {
  const element = event.target;
  const {uuid, actionId} = element.dataset;
  let action;
  if ( uuid === "default" ) action = crucible.api.models.CrucibleAction.getDefaultAction(actionId);
  else {
    const owner = await fromUuid(uuid);
    if ( owner instanceof Actor ) action = owner.actions[actionId];
    else if ( owner instanceof Item ) action = owner.actions.find(a => a.id === actionId);
  }
  if ( !action ) return;
  event.stopImmediatePropagation();

  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation
  element.dataset.tooltipHtml = await action.renderCard();
  element.dataset.tooltipClass = "crucible crucible-tooltip";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */

/**
 * On pointerenter, display a dynamic tooltip for the group passive check.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayPassiveCheck(event) {
  if ( !crucible.party ) return;
  const element = event.target;
  event.stopImmediatePropagation();
  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

  // Define the passive check
  const skillId = element.dataset.skillId;
  const dc = Number(element.dataset.dc);
  const check = async (_group, actor) => {
    const roll = actor.getSkillCheck(skillId, {dc, passive: true});
    await roll.evaluate();
    return {roll};
  };

  // Construct the tooltip
  element.dataset.tooltipHtml = await crucible.party.system.renderGroupCheckTooltip(check, {title: element.innerText});
  element.dataset.tooltipClass = "crucible crucible-tooltip wide";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */

/**
 * On pointerenter, display a dynamic tooltip for the group knowledge check.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayKnowledgeCheck(event) {
  const element = event.target;
  const knowledgeId = element.dataset.knowledgeId;
  const knowledge = crucible.CONFIG.knowledge[knowledgeId];
  if ( !knowledge || !crucible.party ) return;
  event.stopImmediatePropagation();
  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

  const check = async (group, actor) => ({success: actor.hasKnowledge(knowledgeId)});
  element.dataset.tooltipHtml = await crucible.party.system.renderGroupCheckTooltip(check, {title: element.innerText});
  element.dataset.tooltipClass = "crucible crucible-tooltip wide";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */

/**
 * On pointerenter, display a tooltip for which group members have a specific talent.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayTalentCheck(event) {
  const element = event.target;
  if ( !crucible.party ) return;
  event.stopImmediatePropagation();
  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

  const parsed = foundry.utils.parseUuid(element.dataset.talentUuid);
  if ( !parsed?.id ) return;
  const check = async (group, actor) => ({success: actor.talentIds.has(parsed.id)});
  element.dataset.tooltipHtml = await crucible.party.system.renderGroupCheckTooltip(check, {title: element.innerText});
  element.dataset.tooltipClass = "crucible crucible-tooltip wide";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */

/**
 * On pointerenter, display a dynamic tooltip for the group language check.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayLanguageCheck(event) {
  const element = event.target;
  const languageId = element.dataset.languageId;
  const language = crucible.CONFIG.languages[languageId];
  if ( !language || !crucible.party ) return;
  event.stopImmediatePropagation();
  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

  const check = async (group, actor) => ({success: actor.system.details.languages.has(languageId)});
  element.dataset.tooltipHtml = await crucible.party.system.renderGroupCheckTooltip(check, {title: element.innerText});
  element.dataset.tooltipClass = "crucible crucible-tooltip wide";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */

/**
 * Extract the source HTML which documents a rule from the journal page it lives on.
 * Content is returned un-enriched; enrichment happens once for every rule tooltip in {@link getRuleTooltipContext}.
 * @param {JournalEntryPage} page   The page which documents this rule
 * @param {string} ruleId           Dot-path id of the rule, matched against a `data-rule` attribute
 * @returns {string}                Source HTML, or an empty string if an annotated page does not document this rule
 */
function extractRuleContent(page, ruleId) {
  const content = page.text?.content;
  if ( !content ) return "";
  const doc = new DOMParser().parseFromString(content, "text/html");
  const el = doc.querySelector(`[data-rule="${ruleId}"]`);
  if ( el ) return el.innerHTML.trim();
  // Pages without a matching selector contribute their whole content (e.g. conditions)
  return doc.querySelector("[data-rule]") ? "" : content;
}

/* -------------------------------------------- */

/**
 * Display tag tooltip descriptions.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayTagTooltip(event) {
  const element = event.target;
  const ruleId = element.dataset.ruleId;
  let tooltip = element.dataset.crucibleTooltipText || SYSTEM.ACTION.TAGS[element.dataset.tag]?.tooltip;
  let name = element.innerText;
  const cfg = foundry.utils.getProperty(SYSTEM.RULES, ruleId);
  if ( cfg ) {
    const page = cfg.page ? await fromUuid(cfg.page) : null;
    tooltip ||= _loc(cfg.tooltip) || cfg.description;
    // Maybe derive tooltip content from authoritative journal text
    if ( !tooltip && page ) {
      tooltip = extractRuleContent(page, ruleId);
      if ( tooltip && cfg.tooltip ) foundry.utils.setProperty(game.i18n.translations, cfg.tooltip, tooltip);
    }
    name = _loc(cfg.name) ?? _loc(cfg.label) ?? page?.name;
  }
  if ( !tooltip ) return;
  event.stopImmediatePropagation();
  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

  element.dataset.tooltipHtml = await foundry.applications.handlebars.renderTemplate(RULE_TOOLTIP_TEMPLATE,
    await getRuleTooltipContext(name, tooltip));
  element.dataset.tooltipClass = "crucible crucible-tooltip";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */

/**
 * Display any element retrievable by an uuid which exposes a renderCard function.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayFromUuid(event) {
  const element = event.target;
  const item = await fromUuid(element.dataset.uuid);
  if ( typeof item?.renderCard !== "function" ) return;
  event.stopImmediatePropagation();

  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation
  element.dataset.tooltipHtml = await item.renderCard();
  element.dataset.tooltipClass = "crucible crucible-tooltip";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */

/**
 * Creates a dialog for selecting from a specific group of world actors, and/or from arbitrary world actors
 * @param {object} [options]
 * @param {string} [options.dialogTitle]    The title of the dialog
 * @param {string} [options.dialogIcon]     The FontAwesome classes used for the dialog's Icon
 * @param {Actor[]} [options.actors]        Which specific actors to show checkboxes for
 * @param {boolean} [options.showSpecific]  Whether to show checkboxes for specific actors
 * @param {boolean} [options.showAny]       Whether to show the inputs for "any actor"
 * @returns {Promise<Set<CrucibleActor>>} A set of selected actor UUIDs
 */
export async function chooseActorsDialog({dialogTitle="DICE.REQUESTS.ChooseTarget", dialogIcon="fa-solid fa-bullseye", actors, showSpecific=true, showAny=true}={}) {
  let content = "";
  if ( showSpecific ) {
    actors ??= crucible.party?.system.members.map(a => a.actor) || [];
    const specificActorInput = foundry.applications.fields.createMultiSelectInput({
      name: "specificActor",
      type: "checkboxes",
      options: actors.reduce((arr, actor) => {
        if ( actor ) arr.push({value: actor.uuid, label: actor.name, selected: true});
        return arr;
      }, [])
    });
    const specificActor = foundry.applications.fields.createFormGroup({
      label: "DICE.REQUESTS.SpecificActors",
      hint: "DICE.REQUESTS.SpecificActorsHint",
      stacked: true,
      localize: true,
      input: specificActorInput
    });
    content += specificActor.outerHTML;
  }

  // Don't respect showAny if showSpecific is false or there are no specific actors to show
  if ( showAny || !showSpecific || !actors?.length ) {
    const anyActorInput = foundry.applications.elements.HTMLDocumentTagsElement.create({
      type: "Actor",
      name: "anyActor"
    });
    const anyActor = foundry.applications.fields.createFormGroup({
      label: "DICE.REQUESTS.AnyActor",
      hint: "DICE.REQUESTS.AnyActorHint",
      localize: true,
      input: anyActorInput
    });
    content += anyActor.outerHTML;
  }
  const result = await foundry.applications.api.DialogV2.input({
    window: {title: dialogTitle, icon: dialogIcon},
    content
  });
  if ( !result ) return new Set();
  const selectedActors = [...(result.specificActor ?? []), ...(result.anyActor ?? [])].reduce((acc, uuid) => {
    if ( !uuid.startsWith("Compendium") ) acc.push(fromUuidSync(uuid));
    return acc;
  }, []);
  return new Set(selectedActors);
}
