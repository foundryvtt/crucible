export default {
  beastShapeRevert: {
    confirm: async (actor) => {
      const effect = actor.effects.get(SYSTEM.EFFECTS.getEffectId("beastShape"));
      await effect.delete();
    }
  },
  bodyBlock: {
    can: (actor, action) => {
      const messageIds = Array.from(game.messages.keys());
      for ( let i=messageIds.length-1; i>=0; i--) {
        const message = game.messages.get(messageIds[i]);
        if ( !message.flags.crucible?.action ) continue;
        const targetAction = action.constructor.fromChatMessage(message);
        for ( const outcome of targetAction.outcomes.values() ) {
          if ( outcome.target.uuid !== actor.uuid ) continue;
          if ( !targetAction.tags.has("melee") ) {
            throw new Error("You may only use Body Block against an incoming melee attack.");
          }
          if ( message.flags.crucible.confirmed ) {
            throw new Error("The attack against you has already been confirmed and can no longer be blocked.");
          }
          const results = game.system.api.dice.AttackRoll.RESULT_TYPES;
          for ( const r of outcome.rolls ) {
            if ( [results.ARMOR, results.GLANCE].includes(r.data.result) ) {
              action.usage.targetAction = message.id;
              return true;
            }
          }
        }
        throw new Error("You may only use Body Block after an attack against you is defended by Armor or Glance.");
      }
    },
    confirm: async (actor, action) => {
      const message = game.messages.get(action.usage.targetAction);
      const results = game.system.api.dice.AttackRoll.RESULT_TYPES;
      const outcomes = message.flags.crucible.outcomes
      for ( const outcome of outcomes ) {
        if ( outcome.target !== actor.uuid ) continue;
        for ( const i of outcome.rolls ) {
          const roll = message.rolls[i];
          if ( [results.ARMOR, results.GLANCE].includes(roll.data.result) ) {
            const damage = roll.data.damage;
            outcome.resources[damage.resource || "health"] += roll.data.damage.total; // refund damage
            roll.data.result = results.BLOCK;
            roll.data.damage = null;
          }
        }
      }
      const rolls = message.rolls.map(r => r.toJSON());
      await message.update({rolls, "flags.crucible.outcomes": outcomes}, {diff: false});
    }
  },
  cadence: {
    roll: async function(actor, action, target, rolls) {
      let roll = rolls[0];
      const boons = action.usage.boons;
      boons.cadence = {label: "Cadence", number: 0};
      const cadence = [];
      for ( let i=1; i<=2; i++ ) {
        if ( roll.isSuccess ) boons.cadence.number++;
        roll = await actor.weaponAttack(action, target);
        cadence.push(roll);
      }
      return cadence;
    }
  },
  clarifyIntent: {
    post: async (actor, action, target, rolls) => {
      const roll = rolls[0];
      if ( roll.isSuccess ) {
        roll.data.damage.multiplier = 0;
        roll.data.damage.base = roll.data.damage.total = 1;
      }
    }
  },
  defend: {
    prepare: (actor, action) => {
      if ( actor.talentIds.has("bulwark000000000") && actor.equipment.weapons.shield && !actor.system.status.hasMoved ) {
        action.cost.action -= 1;
        action.usage.actorUpdates["system.status.hasMoved"] = true;
      }
    },
  },
  delay: {
    can: (actor, action) => {
      if ( game.combat?.combatant?.actor !== actor ) {
        throw new Error("You may only use the Delay action on your own turn in combat.");
      }
      if ( actor.flags.crucible?.delay ) {
        throw new Error("You may not delay your turn again this combat round.");
      }
    },
    display: (actor, action, combatant) => {
      return !!combatant && (game.combat.combatant === combatant) && !actor.flags.crucible?.delay;
    },
    roll: async function(actor, action, target, rolls) {
      const combatant = game.combat.getCombatantByActor(actor);
      const maximum = combatant.getDelayMaximum();
      const response = await Dialog.prompt({
        title: "Delay Turn",
        content: `<form class="delay-turn" autocomplete="off">
            <div class="form-group">
                <label>Delayed Initiative</label>
                <input name="initiative" type="number" min="1" max="${maximum}" step="1">
                <p class="hint">Choose an initiative value between 1 and ${maximum} when you wish to act.</p>
            </div>
        </form>`,
        label: "Delay",
        callback: dialog => dialog.find(`input[name="initiative"]`)[0].valueAsNumber,
        rejectClose: false
      });
      if ( response ) action.usage.initiativeDelay = response;
    },
    confirm: async (actor, action) => await actor.delay(action.usage.initiativeDelay)
  },
  disengagementStrike: {
    can: (actor) => {
      for ( const s of ["unaware", "flanked"] ) {
        if ( actor.statuses.has(s) ) throw new Error(`You may not perform a Disengagement Strike while ${s}.`);
      }
    },
    prepare: (actor, action) => {
      const w = actor.equipment.weapons.mainhand;
      action.cost.action -= w.actionCost;
    }
  },
  distract: {
    post: async (actor, action, target, rolls) => {
      for ( const r of rolls ) {
        if ( r.isSuccess ) {
          r.data.damage.multiplier = 0;
          r.data.damage.base = 1;
          r.data.damage.total = 1;
        }
      }
    }
  },
  executionersStrike: {
    prepare: (actor, action) => {
      const w = actor.equipment.weapons.mainhand;
      action.effects[0] = foundry.utils.mergeObject(SYSTEM.EFFECTS.bleeding(actor, undefined, {
        ability: "strength",
        damageType: w.system.damageType,
      }), action.effects[0]);
    }
  },
  flurry: {
    roll: async function(actor, action, target, rolls) {
      if ( !rolls.every(r => r.isSuccess ) ) return;
      rolls.push(await actor.weaponAttack(action, target, actor.equipment.weapons.mainhand));
    }
  },
  recover: {
    can: (actor, action) => {
      if ( actor.inCombat ) throw new Error("You may not Recover during Combat.");
    },
    confirm: async (actor, action, outcomes) => {

      // Expire active effects
      const toDeleteEffects = actor.effects.reduce((arr, effect) => {
        if ( effect.id === "weakened00000000" ) arr.push(effect.id);
        else if ( effect.id === "broken0000000000" ) arr.push(effect.id);
        else if ( !effect.duration.seconds || (effect.duration.seconds <= 600) ) arr.push(effect.id);
        return arr;
      }, []);
      await actor.deleteEmbeddedDocuments("ActiveEffect", toDeleteEffects);

      // Set resources to recover
      const self = outcomes.get(actor);
      self.resources.health = Infinity;
      self.resources.morale = Infinity;
      self.resources.action = Infinity;
      self.resources.focus = Infinity;
    }
  },
  secondWind: {
    confirm: async (actor, action, outcomes) => {
      const self = outcomes.get(actor);
      self.resources.health = (self.resources.health || 0) + actor.system.abilities.toughness.value;
    }
  },
  shieldBash: {
    can: (actor) => {
      const {basicStrike, lastAction} = actor.system.status;
      if ( !basicStrike || (lastAction !== "strike") ) {
        throw new Error("You can only perform Shield Bash after a basic Strike which did not critically miss.");
      }
    }
  },
  strike: {
    post: async (actor, action, target, rolls) => {
      if ( !rolls[0].isCriticalFailure ) action.usage.actorUpdates["system.status.basicStrike"] = true;
    }
  },
  offhandStrike: {
    prepare: (actor, action) => {
      const {basicStrike, offhandStrike, lastAction} = actor.system.status;
      if ( basicStrike && (lastAction === "strike") && !offhandStrike ) {
        action.cost.action = 0;
        action.usage.actorUpdates["system.status.offhandStrike"] = true;
      }
    }
  },
  refocus: {
    confirm: async (actor, action, outcomes) => {
      const self = outcomes.get(actor);
      const {mainhand: mh, offhand: oh} = actor.equipment.weapons
      const talisman = ["talisman1", "talisman2"].includes(mh.system.category) ? mh : oh;
      self.resources.focus = (self.resources.focus || 0) + talisman.system.config.category.hands;
    }
  },
  reload: {
    prepare: (actor, action) => {
      const {reloaded} = actor.system.status;
      if ( actor.talentIds.has("pistoleer0000000") && !reloaded ) action.cost.action = 0;
    },
    post: async (actor, action) => action.usage.actorUpdates["system.status.reloaded"] = true
  },
  uppercut: {
    can: (actor) => {
      const {basicStrike, lastAction} = actor.system.status;
      if ( basicStrike && (lastAction !== "strike") ) {
        throw new Error("You can only perform Uppercut after a basic Strike which did not critically miss.");
      }
    }
  },
  vampiricBite: {
    pre: (actor, action) => {
      const cls = getDocumentClass("Item");
      const bite = new cls(SYSTEM.WEAPON.VAMPIRE_BITE, {parent: actor});
      action.usage.weapon = bite;
      action.usage.context.tags.add("Vampiric Bite");
      foundry.utils.mergeObject(action.usage.bonuses, bite.system.actionBonuses);
      foundry.utils.mergeObject(action.usage.context, {
        type: "weapons",
        label: "Weapon Tags",
        icon: "fa-solid fa-swords",
        hasDice: true
      });
    },
    roll: (actor, action, target) => actor.weaponAttack(action, target),
    confirm: async (actor, action, outcomes) => {
      const self = outcomes.get(actor);
      for ( const outcome of outcomes.values() ) {
        if ( outcome === self ) continue;
        if ( outcome.rolls.some(r => r.isSuccess) ) {
          self.resources.health = (self.resources.health || 0) + actor.system.abilities.toughness.value;
        }
      }
    }
  },
}
