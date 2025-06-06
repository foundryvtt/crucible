/**
 * Handle pointer enter events to take control over crucible dynamic system tooltips.
 * @param {PointerEvent} event
 */
export function onPointerEnter(event) {
  if ( "crucibleTalentTooltip" in event.target.dataset ) return displayTalentTooltip(event);
}

/* -------------------------------------------- */

/**
 * Display a talent card as a tooltip.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayTalentTooltip(event) {
  const element = event.target;
  delete element.dataset.crucibleTalentTooltip;
  const talent = await fromUuid(element.dataset.uuid);
  if ( !talent ) return;
  event.stopImmediatePropagation();
  element.dataset.tooltipHtml = await talent.renderCard();
  element.dataset.tooltipClass = "crucible crucible-tooltip";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}
