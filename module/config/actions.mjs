export default {
  "beast-shape-revert": {
    confirm: async (actor, action, outcomes) => {
      const effect = actor.effects.find(e => e.getFlag("crucible", "action") === "beast-shape");
      await effect.delete();
    }
  },
  "second-wind": {
    post: (actor, action, target) => {
      return actor.alterResources({health: actor.attributes.toughness.value}, {}, {statusText: action.name});
    }
  },
  "vampiric-bite": {
    pre: (actor, action) => {
      const cls = getDocumentClass("Item");
      const bite = new cls(CONFIG.SYSTEM.WEAPON.VAMPIRE_BITE, {parent: actor});
      action.context.weapon = bite;
      action.context.tags.add("Vampiric Bite");
      foundry.utils.mergeObject(action.bonuses, bite.system.actionBonuses);
      foundry.utils.mergeObject(action.context, {
        type: "weapons",
        label: "Weapon Tags",
        icon: "fa-solid fa-swords",
        hasDice: true
      });
    },
    execute: (actor, action, target) => action.context.weapon.attack(target, action.bonuses),
    confirm: async (actor, action, outcomes) => {
      for ( const outcome of outcomes.values() ) {
        if ( outcome.total ) {
          await actor.alterResources({"health": actor.attributes.toughness.value}, {}, {statusText: action.name});
          break;
        }
      }
    }
  },
}
