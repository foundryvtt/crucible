export default {
  beastShapeRevert: {
    async confirm() {
      const effect = this.actor.effects.get(SYSTEM.EFFECTS.getEffectId("beastShape"));
      await effect.delete();
    }
  },
  bodyBlock: {
    canUse() {
      const messageIds = Array.from(game.messages.keys());
      for ( let i=messageIds.length-1; i>=0; i--) {
        const message = game.messages.get(messageIds[i]);
        if ( !message.flags.crucible?.action ) continue;
        const targetAction = this.constructor.fromChatMessage(message);
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
              this.usage.targetAction = message.id;
              return true;
            }
          }
        }
        throw new Error("You may only use Body Block after an attack against you is defended by Armor or Glance.");
      }
    },
    async confirm() {
      const message = game.messages.get(this.usage.targetAction);
      const results = game.system.api.dice.AttackRoll.RESULT_TYPES;
      const outcomes = message.flags.crucible.outcomes;
      for ( const outcome of outcomes ) {
        if ( outcome.target !== this.actor.uuid ) continue;
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
    async roll(target, rolls) {
      let roll = rolls[0];
      const boons = this.usage.boons;
      boons.cadence = {label: "Cadence", number: 0};
      for ( let i=1; i<=2; i++ ) {
        if ( roll.isSuccess ) boons.cadence.number++;
        roll = await this.actor.weaponAttack(this, target);
        rolls.push(roll);
      }
    }
  },
  clarifyIntent: {
    async postActivate(outcome) {
      const roll = outcome.rolls[0];
      if ( roll.isSuccess ) {
        roll.data.damage.multiplier = 0;
        roll.data.damage.base = roll.data.damage.total = 1;
      }
    }
  },
  defend: {
    prepare() {
      const a = this.actor;
      if ( a.talentIds.has("bulwark000000000") && a.equipment.weapons.shield && !a.system.status.hasMoved ) {
        this.cost.action -= 1;
        this.usage.actorUpdates["system.status.hasMoved"] = true;
      }
    },
  },
  delay: {
    canUse() {
      if ( game.combat?.combatant?.actor !== this.actor ) {
        throw new Error("You may only use the Delay action on your own turn in combat.");
      }
      if ( this.actor.flags.crucible?.delay ) {
        throw new Error("You may not delay your turn again this combat round.");
      }
    },
    displayOnSheet(combatant) {
      return !!combatant && (game.combat.combatant === combatant) && !this.actor.flags.crucible?.delay;
    },
    async preActivate(targets) {
      const combatant = game.combat.getCombatantByActor(this.actor);
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
      if ( response ) this.usage.initiativeDelay = response;
    },
    async confirm() {
      return this.actor.delay(this.usage.initiativeDelay);
    }
  },
  disengagementStrike: {
    canUse() {
      for ( const s of ["unaware", "flanked"] ) {
        if ( this.actor.statuses.has(s) ) throw new Error(`You may not perform a Disengagement Strike while ${s}.`);
      }
    },
    prepare() {
      const w = this.actor.equipment.weapons.mainhand;
      this.cost.action -= w.actionCost;
    }
  },
  distract: {
    async postActivate(outcome) {
      for ( const r of outcome.rolls ) {
        if ( r.isSuccess ) {
          r.data.damage.multiplier = 0;
          r.data.damage.base = 1;
          r.data.damage.total = 1;
        }
      }
    }
  },
  executionersStrike: {
    prepare() {
      const w = this.actor.equipment.weapons.mainhand;
      this.effects[0] = foundry.utils.mergeObject(SYSTEM.EFFECTS.bleeding(this.actor, undefined, {
        ability: "strength",
        damageType: w.system.damageType,
      }), this.effects[0]);
    }
  },
  flurry: {
    async roll(target, rolls) {
      if ( !rolls.every(r => r.isSuccess ) ) return;
      const bonus = await this.actor.weaponAttack(this, target, this.actor.equipment.weapons.mainhand)
      rolls.push(bonus);
    }
  },
  recover: {
    canUse() {
      if ( this.actor.inCombat ) throw new Error("You may not Recover during Combat.");
    },
    async confirm() {

      // Expire active effects
      const toDeleteEffects = this.actor.effects.reduce((arr, effect) => {
        if ( effect.id === "weakened00000000" ) arr.push(effect.id);
        else if ( effect.id === "broken0000000000" ) arr.push(effect.id);
        else if ( !effect.duration.seconds || (effect.duration.seconds <= 600) ) arr.push(effect.id);
        return arr;
      }, []);
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", toDeleteEffects);

      // Set resources to recover
      const self = this.outcomes.get(this.actor);
      self.resources.health = Infinity;
      self.resources.morale = Infinity;
      self.resources.action = Infinity;
      self.resources.focus = Infinity;
    }
  },
  secondWind: {
    async confirm() {
      const self = this.outcomes.get(this.actor);
      self.resources.health = (self.resources.health || 0) + this.actor.system.abilities.toughness.value;
    }
  },
  shieldBash: {
    canUse() {
      const {basicStrike, lastAction} = this.actor.system.status;
      if ( !basicStrike || (lastAction !== "strike") ) {
        throw new Error("You can only perform Shield Bash after a basic Strike which did not critically miss.");
      }
    }
  },
  strike: {
    async postActivate(outcome) {
      if ( outcome.rolls.some(r => !r.isCriticalFailure) ) {
        this.usage.actorUpdates["system.status.basicStrike"] = true;
      }
    }
  },
  offhandStrike: {
    prepare() {
      const {basicStrike, offhandStrike, lastAction} = this.actor.system.status;
      if ( basicStrike && (lastAction === "strike") && !offhandStrike ) {
        this.cost.action = 0;
        this.usage.actorUpdates["system.status.offhandStrike"] = true;
      }
    }
  },
  refocus: {
    async confirm() {
      const self = this.outcomes.get(this.actor);
      const {mainhand: mh, offhand: oh} = this.actor.equipment.weapons
      const talisman = ["talisman1", "talisman2"].includes(mh.system.category) ? mh : oh;
      self.resources.focus = (self.resources.focus || 0) + talisman.system.config.category.hands;
    }
  },
  reload: {
    prepare() {
      const a = this.actor;
      const {reloaded} = a.system.status;
      if ( a.talentIds.has("pistoleer0000000") && !reloaded ) this.cost.action = 0;
    },
    async postActivate() {
      this.usage.actorUpdates["system.status.reloaded"] = true;
    }
  },
  uppercut: {
    canUse() {
      const {basicStrike, lastAction} = this.actor.system.status;
      if ( basicStrike && (lastAction !== "strike") ) {
        throw new Error("You can only perform Uppercut after a basic Strike which did not critically miss.");
      }
    }
  },
  vampiricBite: {
    prepare() {
      const cls = getDocumentClass("Item");
      const bite = new cls(SYSTEM.WEAPON.VAMPIRE_BITE, {parent: this.actor});
      this.usage.weapon = bite;
      this.usage.context.tags.add("Vampiric Bite");
      foundry.utils.mergeObject(this.usage.bonuses, bite.system.actionBonuses);
      foundry.utils.mergeObject(this.usage.context, {
        type: "weapons",
        label: "Weapon Tags",
        icon: "fa-solid fa-swords",
        hasDice: true
      });
    },
    async roll(target, rolls) {
      const bite = await this.actor.weaponAttack(this, target);
      rolls.push(bite);
    },
    async confirm() {
      const self = this.outcomes.get(this.actor);
      for ( const outcome of this.outcomes.values() ) {
        if ( outcome === self ) continue;
        if ( outcome.rolls.some(r => r.isSuccess) ) {
          self.resources.health = (self.resources.health || 0) + this.actor.system.abilities.toughness.value;
        }
      }
    }
  },
}
