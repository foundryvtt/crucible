/**
 * Handle pointer enter events to take control over crucible dynamic system tooltips.
 * @param {PointerEvent} event
 */
export function onPointerEnter(event) {
  if ( "crucibleTalentTooltip" in event.target.dataset ) return displayTalentTooltip(event);
  else if ( "crucibleActionTooltip" in event.target.dataset ) return displayActionTooltip(event);
}

/* -------------------------------------------- */

/**
 * Handle pointer leave events to remove the crucible tooltip so it is later regenerated.
 * @param {PointerEvent} event
 */
export function onPointerLeave(event) {
  if ( "crucibleTooltip" in event.target.dataset ) {
    window.setTimeout(() => {
      if ( game.tooltip.element !== event.target ) {
        event.target.dataset[event.target.dataset.crucibleTooltip] = true;
        delete event.target.dataset.crucibleTooltip;
        delete event.target.dataset.tooltipHtml;
      }
    }, 2000);
  }
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
  element.dataset.crucibleTooltip = "crucibleTalentTooltip";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}

/* -------------------------------------------- */

/**
 * Display an action card as a tooltip.
 * @param {PointerEvent} event
 * @returns {Promise<void>}
 */
async function displayActionTooltip(event) {
  const element = event.target;
  delete element.dataset.crucibleActionTooltip;
  const owner = await fromUuid(element.dataset.uuid);
  let action;
  if ( owner instanceof Actor ) action = owner.actions[element.dataset.actionId];
  else if ( owner instanceof Item ) action = owner.actions.find(a => a.id === element.dataset.actionId);
  if ( !action ) return;
  event.stopImmediatePropagation();
  element.dataset.tooltipHtml = await action.renderCard();
  element.dataset.tooltipClass = "crucible crucible-tooltip";
  element.dataset.crucibleTooltip = "crucibleActionTooltip";
  const pointerover = new event.constructor(event.type, event);
  element.dispatchEvent(pointerover);
}
