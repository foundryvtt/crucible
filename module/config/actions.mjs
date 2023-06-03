import {SYSTEM} from "./system.js";

export default {
  beastShapeRevert: {
    confirm: async (actor) => {
      const effect = actor.effects.get(SYSTEM.EFFECTS.getEffectId("beastShape"));
      await effect.delete();
    }
  },
  cadence: {
    roll: async function(actor, action, target, rolls) {
      let lastRoll = rolls[0];
      const bonuses = foundry.utils.deepClone(action.usage.bonuses);
      const cadence = [];
      for ( let i=1; i<=2; i++ ) {
        if ( lastRoll.isSuccess ) bonuses.boons += 1;
        lastRoll = await actor.equipment.weapons.mainhand.attack(target, bonuses);
        cadence.push(lastRoll);
      }
      return cadence;
    }
  },
  clarifyIntent: {
    post: async (actor, action, target, rolls) => {
      const roll = rolls[0];
      if ( roll.isSuccess ) {
        roll.data.damage.multiplier = 0;
        roll.data.damage.base = roll.isCriticalSuccess ? 2 : 1;
        roll.data.damage.total = game.system.api.models.CrucibleAction.computeDamage(roll.data.damage);
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
      const chain = await actor.equipment.weapons.mainhand.attack(target, action.usage.bonuses);
      rolls.push(chain);
    }
  },
  recover: {
    can: (actor, action) => {
      if ( actor.inCombat ) throw new Error("You may not Recover during Combat.");
    },
    confirm: async (actor, action, outcomes) => {
      const self = outcomes.get(actor);
      const r = actor.system.resources;
      self.resources.health = r.health.max;
      self.resources.morale = r.morale.max;
      self.resources.action = r.action.max;
      self.resources.focus = r.focus.max;
    }
  },
  secondWind: {
    confirm: async (actor, action, outcomes) => {
      const self = outcomes.get(actor);
      self.resources.health = (self.resources.health || 0) + actor.system.abilities.toughness.value;
    }
  },
  shieldBash: {
    can: (actor, action) => {
      if ( !actor.system.status.basicStrike ) throw new Error("You can only perform Shield Bash after a basic Strike.");
      if ( actor.system.status.shieldBash ) throw new Error("You cannot use Shield Bash again this Turn.");
    },
    post: async (actor, action) => action.usage.actorUpdates["system.status.shieldBash"] = true
  },
  strike: {
    post: async (actor, action, target, rolls) => {
      if ( !rolls[0].isCriticalFailure ) action.usage.actorUpdates["system.status.basicStrike"] = true;
    }
  },
  offhandStrike: {
    prepare: (actor, action) => {
      const {basicStrike, offhandStrike} = actor.system.status;
      if ( basicStrike && !offhandStrike ) action.cost.action = 0;
    },
    post: async (actor, action) => action.usage.actorUpdates["system.status.offhandStrike"] = true
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
    can: (actor, action) => {
      if ( !actor.system.status.basicStrike ) throw new Error("You can only perform Uppercut after a basic Strike.");
      if ( actor.system.status.uppercut ) throw new Error("You cannot use Uppercut again this Turn.");
    },
    post: async (actor, action, target) => action.usage.actorUpdates["system.status.uppercut"] = true
  },
  vampiricBite: {
    pre: (actor, action) => {
      const cls = getDocumentClass("Item");
      const bite = new cls(CONFIG.SYSTEM.WEAPON.VAMPIRE_BITE, {parent: actor});
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
    roll: (actor, action, target) => action.usage.weapon.attack(target, action.usage.bonuses),
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
