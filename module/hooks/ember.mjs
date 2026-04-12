
/* -------------------------------------------- */
/*  Ember 0.5.0 - Remove in Crucible 0.9.2      */
/* -------------------------------------------- */

let ember;

const EMBER_050 = {
  action: {
    crystalizeWounds: {
      preActivate() {
        const health = this.actor.level * 2;
        this.selfEvents.activation.resources.push({resource: "health", delta: health});
        const res = this.actor.abilities.toughness.value;
        Object.assign(this.effects[0].system, {
          changes: [
            {key: "system.resistances.bludgeoning.bonus", value: res, type: "add"},
            {key: "system.resistances.piercing.bonus", value: res, type: "add"},
            {key: "system.resistances.slashing.bonus", value: res, type: "add"}
          ]
        });
      }
    },
    extremeMetabolism: {
      preActivate() {
        this.selfEvents.activation.resources.push({resource: "action", delta: 1});
        const dodgeBonus = Math.ceil(this.actor.abilities.dexterity.value / 2);
        Object.assign(this.effects[0].system, {
          changes: [
            {key: "system.movement.strideBonus", value: 2, type: "add"},
            {key: "system.defenses.dodge.bonus", value: dodgeBonus, type: "add"},
            {key: "system.resources.action.bonus", value: 1, type: "add"}
          ]
        });
      }
    },
    drakonbanePoisonIngest: {
      preActivate() {
        crucible.api.hooks.action.poisonIngest.preActivate.call(this);
        const target = this.targets.values().next().value?.actor;
        if ( !target ) return;
        const {type, system} = target;
        const isDrakon = ((type === "adversary") && (system.details.taxonomy.identifier === "emberDrakon"))
          || ((type === "hero") && (system.details.ancestry.identifier === "emberDrakon"));
        if ( isDrakon ) {
          this.usage.boons.drakonbane = {label: "Drakonbane", number: 3};
          this.effects[0].statuses.push("diseased");
        }
      }
    },
    bewilderingGaze: {
      postActivate() {
        for ( const [target, events] of this.eventsByTarget ) {
          const rollEvent = events.roll[0];
          if ( rollEvent?.roll.isSuccess && rollEvent.effects.length ) {
            foundry.utils.mergeObject(rollEvent.effects[0], crucible.CONST.EFFECTS.confused(this.actor));
          }
        }
      }
    },
    livingStone: {
      postActivate() {
        const effectEvent = this.selfEvents?.all.find(e => e.effects.length);
        if ( !effectEvent ) return;
        const res = this.actor.level + 1;
        Object.assign(effectEvent.effects[0].system, {
          _id: "emberLivingStone",
          changes: [
            {key: "system.resistances.bludgeoning.bonus", value: res, type: "add"},
            {key: "system.resistances.piercing.bonus", value: res, type: "add"},
            {key: "system.resistances.slashing.bonus", value: res, type: "add"},
            {key: "system.movement.strideBonus", value: -2, type: "add"}
          ]
        });
      }
    },
    oozeElectrifiedPseudopod: {
      postActivate() {
        for ( const event of this.events ) {
          if ( event.roll?.isCriticalSuccess ) {
            event.effects.push(crucible.CONST.EFFECTS.shocked(this.actor));
            break;
          }
        }
      }
    },
    regulatedRhythm: {
      postActivate() {
        const effectEvent = this.selfEvents?.all.find(e => e.effects.length);
        if ( effectEvent ) Object.assign(effectEvent.effects[0], {_id: "emberRegulatedRh"});
      }
    },
    emberBlaze: {
      confirm: _del,
      postActivate() {
        const {action: actionAdjust=0, focus: focusAdjust=0} = this.selfEvents.activation.resourceTotals;
        const {action, focus} = this.actor.resources;
        this.recordEvent({resources: [
          {resource: "action", delta: action.max - action.value - actionAdjust},
          {resource: "focus", delta: focus.max - focus.value - focusAdjust}
        ]});
      }
    },
    oozeMagneticDisarm: {
      confirm: _del,
      postActivate() {
        const health = this.actor.system.abilities.toughness.value;
        const isSuccess = this.eventsByTarget.values().next().value?.isSuccess;
        if ( isSuccess ) this.recordEvent({resources: [{resource: "health", delta: health}]});
      }
    }
  },
  weapon: {
    duskmawPickaxe: {
      finalizeAction(item, action) {
        const moraleDelta = (ember.calendar.moons.orbis.phase === "full" ? -2 : 0)
          + (ember.calendar.moons.mayis.phase === "full" ? -2 : 0);
        if ( !moraleDelta ) return;
        for ( const event of action.events ) {
          if ( (event.target === this) || !event.weapon || (event.weapon._id !== item.id) ) continue;
          event.resources.push({resource: "morale", delta: moraleDelta});
          break;
        }
      }
    },
    duskmawWarHammer: {
      finalizeAction(item, action) {
        const moraleDelta = (ember.calendar.moons.orbis.phase === "full" ? -2 : 0)
          + (ember.calendar.moons.mayis.phase === "full" ? -2 : 0);
        if ( !moraleDelta ) return;
        for ( const event of action.events ) {
          if ( (event.target === this) || !event.weapon || (event.weapon._id !== item.id) ) continue;
          event.resources.push({resource: "morale", delta: moraleDelta});
          break;
        }
      }
    }
  },
  talent: {
    emberKethLineage: {
      rollAction(_item, action, target, _token) {
        if ( (target === this) || (this.system.status.kethChaos === false) || !this.inCombat
          || action.tags.has("attack") ) return;
        const targetEvents = action.eventsByActor.get(target);
        if ( !targetEvents?.roll.some(e => e.roll.isFailure) ) return;
        const selfUpdate = action.selfEvents?.actorUpdate;
        if ( selfUpdate ) foundry.utils.setProperty(selfUpdate.actorUpdates, "system.status.kethChaos", true);
      }
    },
    emberVrjnharLine: {
      confirmAction: _del,
      finalizeAction(_item, action) {
        const effect = this.effects.get("formidableStamin");
        if ( !effect ) return;
        const actionDelta = action.events.reduce((total, e) => {
          return total + ((e.target === this) ? (e.resourceTotals.action ?? 0) : 0);
        }, 0);
        const a = this.system.resources.action;
        if ( (a.value > 0) && ((a.value + actionDelta) <= 0) && (Math.random() < 0.25) ) {
          action.recordEvent({target: this, resources: [{resource: "action", delta: 1}],
            statusText: [{text: effect.name}]});
        }
      }
    }
  }
};

/* -------------------------------------------- */
/*  Patch Application                           */
/* -------------------------------------------- */

/**
 * Compatibility patches for Ember module hooks. When the Crucible system updates ahead of the Ember module, this
 * infrastructure allows Crucible to overwrite specific Ember hook implementations with compatible versions.
 * Patches are version-gated so they only apply when running a known incompatible combination.
 * @type {Record<string, object>}
 */
const EMBER_PATCHES = {
  "0.5.0": EMBER_050
};

/**
 * Apply compatibility patches to Ember-registered hooks.
 * Called during the "setup" Foundry hook, after Ember has registered its hooks in "init".
 */
export function applyEmberPatches() {
  ember = globalThis.ember;
  if ( !ember?.active ) return;
  for ( const [emberVersion, patches] of Object.entries(EMBER_PATCHES) ) {
    if ( foundry.utils.isNewerVersion(ember.version, emberVersion) ) continue;
    for ( const [hookType, hooks] of Object.entries(patches) ) {
      foundry.utils.mergeObject(crucible.api.hooks[hookType], hooks, {inplace: true, applyOperators: true});
    }
  }
}
