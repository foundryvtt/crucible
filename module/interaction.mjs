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

/* -------------------------------------------- */

/**
 * @typedef CrucibleGroupTooltipResult
 * @property {StandardCheck} [roll]
 * @property {boolean} [success]
 */

/**
 * Create a group check tooltip
 * @param {CrucibleActor} group
 * @param {function(group: CrucibleActor, member: CrucibleActor): CrucibleGroupTooltipResult} check
 * @returns {Promise<void>}
 */
export async function createGroupTooltip() {
  const results = [];
  for ( const member of group.system.members ) {
    if ( !member.actor ) continue;
    let {roll, success} = check(group, member.actor);
    const result = {actor: member.actor, name: member.actor.name, tags: member.actor.getTags()};

    // Roll-based results
    if ( roll ) Object.assign(result, {
      total: roll.total,
      dc: roll.data.dc,
      isSuccess: roll.isSuccess,
      isFailure:  roll.isFailure,
      isCriticalSuccess: roll.isCriticalSuccess,
      isCriticalFailure: roll.isCriticalFailure,
      icon: roll.isSuccess ? "fa-light fa-hexagon-check" : "fa-light fa-hexagon-xmark",
      hasValue: true
    });

    // Binary checks
    else if ( typeof success === "boolean" ) Object.assign(result, {
      isSuccess: success,
      isFailure: !success,
      icon: success ? "fa-light fa-hexagon-check" : "fa-light fa-hexagon-xmark",
      hasValue: false
    });
    else throw new Error("A CrucibleGroupTooltipResult must either provide a roll or a binary success");
    results.push(result);
  }


}
