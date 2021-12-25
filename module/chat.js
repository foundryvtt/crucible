

export function addChatMessageContextOptions(html, options)  {

  // Assign difficulty for non-attack rolls
  options.push({
    name: game.i18n.localize("DICE.SetDifficulty"),
    icon: '<i class="fas fa-bullseye"></i>',
    condition: li => {
      if ( !game.user.isGM ) return false;
      const message = game.messages.get(li.data("messageId"));
      return message.isRoll && !message.getFlag("crucible", "isAttack");
    },
    callback: li => {
      const message = game.messages.get(li.data("messageId"));
      Dialog.prompt({
        title: game.i18n.localize("DICE.SetDifficulty"),
        content: `<form><div class="form-group"><label>DC Target</label><input type="text" name="dc" value="15" data-dtype="Number"/></div></form>`,
        callback: html => {
          const roll = message.roll;
          roll.data.dc = parseInt(html[0].querySelector('input').value);
          message.update({roll: JSON.stringify(roll)});
        },
        options: {
          width: 260
        }
      })
    }
  });

  // Apply damage for attack rolls
  options.push({
    name: game.i18n.localize("DICE.ApplyDamage"),
    icon: '<i class="fas fa-first-aid"></i>',
    condition: li => {
      const message = game.messages.get(li.data("messageId"));
      if ( !message.isRoll || !message.getFlag("crucible", "isAttack") ) return false;
      const targets = message.getFlag("crucible", "targets");
      return targets.every(t => {
        if ( t.uuid.startsWith("Compendium") ) return false;  // Don't apply damage to compendium targets
        const [documentName, documentId, embeddedName, embeddedId] = t.uuid.split(".");
        if ( documentName === "Actor" ) return game.actors.get(documentId)?.isOwner;
        else if ( embeddedName === "Token" ) {
          const scene = game.scenes.get(documentId);
          if ( !scene ) return false;
          return scene.tokens.get(embeddedId)?.isOwner;
        }
      });
    },
    callback: async li => {
      const message = game.messages.get(li.data("messageId"));
      const targets = message.getFlag("crucible", "targets");
      for ( let t of targets ) {

        // Get target actor
        const target = await fromUuid(t.uuid);
        if ( !target ) continue;
        const actor = target instanceof TokenDocument ? target.actor : target;

        // Apply damage
        await actor.alterResources({"health": -1 * message.roll.data.damage.total });
      }
      return message.setFlag("crucible", "damageApplied", true);
    }
  })
  return options;
}

/* -------------------------------------------- */

/**
 * Custom alterations to apply when rendering chat message HTML
 */
export function renderChatMessage(message, html, data, options) {
  const flags = message.data.flags.crucible || {};
  if ( flags.isAttack && flags.damageApplied ) {
    html.find(".damage-result .target").addClass("applied");
  }
}

/* -------------------------------------------- */

/**
 * Hover over chat target links to highlight the token of that target.
 * @param {MouseEvent} event      The originating pointer event
 * @returns {Promise<void>}
 */
export async function onChatTargetLinkHover(event) {
  const link = event.currentTarget;
  const isActive = event.type === "mouseenter";

  // Get the target Token object;
  const target = await fromUuid(link.dataset.uuid);
  let token;
  if ( target instanceof TokenDocument ) {
    if ( !target.parent.isView ) return;
    token = target.object;
  } else {
    const tokens = target.getActiveTokens(true);
    if ( !tokens.length ) return;
    token = tokens[0];
  }

  // Toggle hover display
  if ( isActive ) token._onHoverIn(event, {hoverOutOthers: false});
  else token._onHoverOut(event);
}
