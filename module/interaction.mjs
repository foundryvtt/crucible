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
    case "condition":
      return displayCondition(event);
    case "activeEffect":
    case "spell":
    case "talent":
      return displayFromUuid(event);
    case "knowledgeCheck":
      return displayKnowledgeCheck(event);
    case "passiveCheck":
      return displayPassiveCheck(event);
  }
}

/* -------------------------------------------- */

/**
 * Handle pointer leave events to remove the crucible tooltip so it is later regenerated.
 * @param {PointerEvent} event
 */
export function onPointerLeave(event) {
  const element = event.target;
  // TODO delete
  // if ( "crucibleTooltip" in element.dataset ) {
  //   window.setTimeout(() => {
  //     if ( (game.tooltip.element === element) || element.matches(":hover") ) return;
  //     element.dataset[element.dataset.crucibleTooltip] = true;
  //     delete element.dataset.crucibleTooltip;
  //     delete element.dataset.tooltipHtml;
  //   }, 2000);
  // }
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
  const owner = await fromUuid(element.dataset.uuid);
  let action;
  if ( owner instanceof Actor ) action = owner.actions[element.dataset.actionId];
  else if ( owner instanceof Item ) action = owner.actions.find(a => a.id === element.dataset.actionId);
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
  }

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
 * Display condition tooltip descriptions.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayCondition(event) {
  const element = event.target;
  const cfg = CONFIG.statusEffects.find(c => c.id === element.dataset.condition);
  if ( !cfg ) return;
  event.stopImmediatePropagation();
  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

  const page = await fromUuid(cfg.page);
  if ( !page ) return;
  const html = `<h3 class="tooltip-title divider">${page.name}</h3>${page.text.content}`;
  element.dataset.tooltipHtml = await CONFIG.ux.TextEditor.enrichHTML(html);
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
  if ( !item ) return;
  event.stopImmediatePropagation();

  element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation
  element.dataset.tooltipHtml = await item.renderCard();
  element.dataset.tooltipClass = "crucible crucible-tooltip";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */
