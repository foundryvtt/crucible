const HOOKS = {};

/* -------------------------------------------- */

HOOKS.adrenalineSurge0 = {
  useAction(item, action) {
    if ( !this.effects.has(item.id) || !action.scaling?.includes("strength") ) return;
    action.usage.boons[item.id] = {label: item.name, number: 2};
  },
  preActivateAction(item, action) {
    if ( !action.scaling?.includes("strength") ) delete action.usage.boons[item.id]; // Double-check
  }
};

/* -------------------------------------------- */

HOOKS.amorphous0000000 = {
  prepareDefenses(item, defenses) {
    this.statuses.delete("restrained");
    defenses.dodge.bonus += this.getAbilityBonus("toughness");
  }
};

/* -------------------------------------------- */

HOOKS.arcanearcher0000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") ) return;
    const mh = this.equipment.weapons.mainhand;
    if ( !["projectile1", "projectile2"].includes(mh.category) ) return;

    // Ignore hands for Gesture: Arrow
    if ( action.gesture.id === "arrow" ) {
      action.cost.hands = 0;
      action.range.weapon = true;
      action.range.maximum = mh.system.range;
    }

    // Reduce cost of spell following strike
    const lastAction = this.lastConfirmedAction;
    if ( lastAction?.tags.has("strike") ) action.cost.action -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.armoredShell0000 = {
  prepareDefenses(item, defenses) {
    if ( !this.statuses.has("guarded") ) return;
    const offhand = this.equipment.weapons.offhand;
    if ( offhand?.category !== "shieldHeavy" ) return;
    const halfArmor = Math.ceil(defenses.armor.base / 2);
    defenses.armor.base -= halfArmor;
    defenses.block.bonus += halfArmor;
  }
};

/* -------------------------------------------- */

HOOKS.bard000000000000 = {
  prepareAttack(item, action, _target, rollData) {
    if ( !action.tags.has("spell") ) return;
    if ( action.rune.id === "soul" ) rollData.boons.bard = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.battlefocus00000 = {
  applyCriticalEffects(_item, action) {
    if ( this.status.battleFocus ) return;
    for ( const event of action.events ) {
      if ( (event.target === this) || !event.isCriticalSuccess || !event.isDamage ) continue;
      const idx = action.events.indexOf(event) + 1;
      action.recordEvent({
        resources: [{resource: "focus", delta: 1}],
        actorUpdates: {system: {status: {battleFocus: true}}}
      }, {index: idx});
      return;
    }
  }
};

/* -------------------------------------------- */

HOOKS.bestialSenses000 = {
  prepareAttack(item, action, _target, rollData) {
    if ( !(action.tags.has("skill") && (action.usage.skillId === "awareness")) ) return;
    rollData.boons.bestialSenses = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.bloodfrenzy00000 = {
  applyCriticalEffects(item, action) {
    if ( this.status.bloodFrenzy ) return;
    for ( const event of action.events ) {
      if ( (event.target === this) || !event.isCriticalSuccess || !event.damagesHealth ) continue;
      const idx = action.events.indexOf(event) + 1;
      action.recordEvent({
        resources: [{resource: "action", delta: 1}],
        actorUpdates: {system: {status: {bloodFrenzy: true}}},
        statusText: [{text: item.name, fillColor: SYSTEM.RESOURCES.action.color.css}]
      }, {index: idx});
      return;
    }
  }
};

/* -------------------------------------------- */

HOOKS.bloodletter00000 = {
  applyCriticalEffects(_item, action) {
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.damagesHealth ) continue;
        const dt = event.weaponItem?.system.damageType;
        if ( ["piercing", "slashing"].includes(dt) ) {
          event.effects.push(SYSTEM.EFFECTS.bleeding(this, {damageType: dt}));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.bloodmagic000000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("spell") ) return;
    action.cost.health = action.cost.focus * 10;
    action.cost.focus = 0;
  },
  finalizeAction(_item, action) {
    const selfHealth = action.events.reduce((total, e) => {
      return total + ((e.target === this) ? (e.resourceTotals.health ?? 0) : 0);
    }, 0);
    const minCost = -action.cost.health;
    if ( selfHealth > minCost ) action.recordEvent({resources: [{resource: "health", delta: minCost - selfHealth}]});
  }
};

/* -------------------------------------------- */

HOOKS.bloodSense000000 = {
  prepareAttack(_item, action, target, rollData) {
    if ( !["strike", "skill"].some(t => action.tags.has(t)) ) return;
    if ( target.resources.health.value < target.resources.health.max ) delete rollData.banes.blind;
  }
};

/* -------------------------------------------- */

HOOKS.bulwark000000000 = {
  prepareActions(item, actions) {
    const defend = actions.defend;
    if ( !defend || !this.equipment.weapons.shield || this.system.status.bulwark ) return;
    defend.cost.action -= 1;
    defend.usage.actorUpdates["system.status.bulwark"] = true;
  }
};

/* -------------------------------------------- */

const absorptionTalents = {
  acidAbsorption00: "acid",
  coldAbsorption00: "cold",
  corruptionAbsorp: "corruption",
  electricityAbsor: "electricity",
  fireAbsorption00: "fire",
  psychicAbsorptio: "psychic",
  radiantAbsorptio: "radiant",
  voidAbsorption00: "void"
};

for ( const [talentId, damageType] of Object.entries(absorptionTalents) ) {
  HOOKS[talentId] = {
    prepareResistances(_item, resistances) {
      resistances[damageType].base *= 2;
    },
    receiveAttack(_item, _action, roll) {
      const dmg = roll.data.damage;
      if ( (dmg.type !== damageType) || dmg.restoration || (dmg.total > 0) ) return;
      const unmitigatedTotal = crucible.api.models.CrucibleAction.computeDamage({...dmg, resistance: 0});
      dmg.restoration = true;
      dmg.total = dmg.resistance - unmitigatedTotal;
    }
  };
}

/* -------------------------------------------- */

HOOKS.cadence000000000 = {
  prepareAttack(item, action, _target, rollData) {
    if ( !action.tags.has("strike") ) return;
    if ( action.usage.weapon.config.category.hands !== 1 ) return;
    const {cadence} = this.status;
    const {actorStatus} = action.usage;
    actorStatus.cadence = (cadence ?? 0) + 1;
    if ( cadence ) rollData.boons.cadence = {label: item.name, number: cadence};
  }
};

/* -------------------------------------------- */

HOOKS.carefree00000000 = {
  prepareDefenses(_item, defenses) {
    defenses.madness.bonus -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.chirurgeon000000 = {
  prepareAction(item, action) {
    if ( action.tags.has("medicine") && this.inCombat ) {
      action.usage.boons[item.id] = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */

HOOKS.concussiveblows0 = {
  applyCriticalEffects(_item, action) {
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.damagesHealth ) continue;
        if ( event.weaponItem?.system.damageType === "bludgeoning" ) {
          event.effects.push(SYSTEM.EFFECTS.staggered(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.conjurer00000000 = {
  prepareAction(_item, action) {
    if ( action.gesture?.id !== "create" ) return;
    const effectIds = Array.fromRange(3, 1).map(i => SYSTEM.EFFECTS.getEffectId("conjurercreate", {suffix: String(i)}));
    const effectId = effectIds.find(id => !this.effects.has(id)) || effectIds[0];
    action.usage.summons[0].effectId = effectId;
  }
};

/* -------------------------------------------- */

HOOKS.conserveeffort00 = {
  endTurn(item, {resourceChanges, statusText}) {
    if ( this.resources.action.value ) {
      resourceChanges.focus.push({label: item.name, amount: 1});
      statusText.push({text: item.name, fillColor: SYSTEM.RESOURCES.focus.color.css});
    }
  }
};

/* -------------------------------------------- */

HOOKS.deftgrip00000000 = {
  prepareAction(_item, action) {
    const isTwoHanded = this.equipment.weapons.twoHanded;
    const isRanged = this.equipment.weapons.ranged;
    if ( isTwoHanded && isRanged ) action.usage.availableHands += 1;
  }
};

/* -------------------------------------------- */

HOOKS.demolitionist000 = {
  prepareAction(item, action) {
    if ( action.item?.config?.category.id === "bomb" ) {
      if ( action.target.scope === SYSTEM.ACTION.TARGET_SCOPES.ALL ) action.target.self = false;
      if ( !action.actor.system.status.demolitionist ) {
        action.cost.action = Math.max(action.cost.action - 1, 0);
        action.usage.actorStatus.demolitionist = true;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.distancerunner00 = {
  prepareMovement(_item, movement) {
    movement.strideBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.dustbinder000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "earth" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.damagesHealth ) {
          event.effects.push(SYSTEM.EFFECTS.corroding(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.evasiveshot00000 = {
  prepareAttack(item, action, _target, _rollData) {
    if ( !action.tags.has("strike") ) return;
    const isRanged = action.usage.strikes.some(w => w.system.config.category.ranged);
    if ( isRanged ) {
      const movementBonus = (this.system.status.movement?.bonus ?? 0) + Math.ceil(this.system.movement.stride / 2);
      foundry.utils.setProperty(action.usage.actorStatus, "movement.bonus", movementBonus);
    }
  }
};

/* -------------------------------------------- */

HOOKS.focusedanticipat = {
  startTurn(item, {resourceChanges, statusText}, {turn}) {
    if ( turn > 0 ) return;
    resourceChanges.focus.push({label: item.name, amount: 1});
    statusText.push({text: item.name, fillColor: SYSTEM.RESOURCES.focus.color.css});
  }
};

/* -------------------------------------------- */

HOOKS.healer0000000000 = {
  prepareAttack(item, action, _target, rollData) {
    if ( !action.tags.has("spell") ) return;
    if ( action.rune.id === "life" ) rollData.boons.healer = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.holdfast00000000 = {
  prepareMovement(item, movement) {
    if ( this.equipment.weapons.shield ) movement.engagementBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.impetus000000000 = {
  startTurn(item, {effectChanges}, {turn}) {
    if ( turn > 0 ) return;
    const effectData = {
      _id: SYSTEM.EFFECTS.getEffectId("impetus"),
      name: item.name,
      img: item.img,
      statuses: ["hastened"],
      duration: {
        units: "rounds",
        expiry: "turnStart",
        value: 1
      }
    };
    const existingEffect = this.effects.get(effectData._id);
    if ( existingEffect ) {
      effectData.duration.value += existingEffect.duration.value;
      effectChanges.toUpdate.push(effectData);
    } else {
      effectChanges.toCreate.push(effectData);
    }
  }
};

/* -------------------------------------------- */

HOOKS.inspirator000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "soul" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.healsMorale ) {
          event.effects.push(SYSTEM.EFFECTS.inspired(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.intellectualsupe = {
  prepareAttack(item, action, target, rollData) {
    if ( !["strike", "spell"].some(t => action.tags.has(t)) ) return;
    const ac = this.combatant;
    const tc = target.combatant;
    if ( ac?.initiative > tc?.initiative ) rollData.boons.intellectualSuperiority = {label: item.name, number: 1};
  }
};

/* -------------------------------------------- */

HOOKS.irrepressiblespi = {
  startTurn(item, {resourceChanges, statusText}) {
    if ( this.system.isBroken ) return;
    resourceChanges.morale.push({label: item.name, amount: 1});
    statusText.push({text: item.name, fillColor: SYSTEM.RESOURCES.morale.color.heal.css});
  }
};

/* -------------------------------------------- */

HOOKS.kineturge0000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "kinesis" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.isDamage ) continue;
        const bleeding = SYSTEM.EFFECTS.bleeding(this, {ability: "presence"});
        bleeding.duration = {value: 1, units: "rounds", expiry: "turnStart"};
        event.effects.push(bleeding);
        break;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.lesserregenerati = {
  startTurn(item, {resourceChanges, statusText}) {
    if ( this.system.isWeakened ) return;
    resourceChanges.health.push({label: item.name, amount: 1});
    statusText.push({text: item.name, fillColor: SYSTEM.RESOURCES.health.color.heal.css});
  }
};

/* -------------------------------------------- */

HOOKS.lightbringer0000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "illumination" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.isDamage ) {
          event.effects.push(SYSTEM.EFFECTS.irradiated(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.mender0000000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "life" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.healsHealth ) {
          event.effects.push(SYSTEM.EFFECTS.mending(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.mentalfortress00 = {
  prepareResistances(item, resistances) {
    resistances.psychic.base += 5;
  },
  prepareDefenses(item, defenses) {
    defenses.willpower.bonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.mesmer0000000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "illusion" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.damagesMorale ) {
          event.effects.push(SYSTEM.EFFECTS.confused(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.necromancer00000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "death" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.damagesHealth ) {
          event.effects.push(SYSTEM.EFFECTS.decay(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.nosferatu0000000 = {
  prepareResistances(_item, resistances) {
    resistances.radiant.base -= 10;
  }
};

/* -------------------------------------------- */

HOOKS.operator00000000 = {
  prepareStandardCheck(item, rollData) {
    if ( !this.inCombat || !game.combat.started || this.isIncapacitated ) return;
    const health = this.system.resources.health;
    if ( health.value < Math.ceil(health.max * 0.25) ) {
      rollData.boons.operator = {label: item.name, number: 2};
    } else if ( health.value < Math.ceil(health.max * 0.5) ) {
      rollData.boons.operator = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */

HOOKS.packhunter000000 = {
  prepareAttack(item, action, target, rollData) {
    if ( !action.tags.has("strike") ) return;
    if ( target.statuses.has("flanked") ) {
      rollData.boons.packHunter = {
        label: item.name,
        number: rollData.boons.flanked.number
      };
    }
  }
};

/* -------------------------------------------- */

HOOKS.patientdeflectio = {
  prepareDefenses(_item, defenses) {
    const weapons = this.equipment.weapons;
    if ( weapons.unarmed ) {
      const wisdom = this.system.abilities.wisdom.value;
      defenses.parry.bonus += Math.ceil(wisdom / 2);
    }
  }
};

/* -------------------------------------------- */

HOOKS.planneddefense00 = {
  defendAttack(item, action, origin, rollData) {
    if ( !["spell", "strike"].some(tag => action.tags.has(tag)) ) return;
    const ac = this.combatant;
    const oc = origin.combatant;
    if ( ac?.initiative > oc?.initiative ) rollData.banes.plannedDefense = {label: item.name, number: 1};
  }
};

/* -------------------------------------------- */

HOOKS.poisoner00000000 = {
  applyCriticalEffects(_item, action) {
    if ( !this.effects.get(SYSTEM.EFFECTS.getEffectId("poisonBlades")) ) return;
    if ( !action.tags.has("melee") ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.damagesHealth ) continue;
        const dt = event.weaponItem?.system.damageType;
        if ( ["piercing", "slashing"].includes(dt) ) {
          event.effects.push(SYSTEM.EFFECTS.poisoned(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.powerfulphysique = {
  prepareInitiativeCheck(_item, rollData) {
    const {weapons, armor} = this.equipment;
    const slowBanes = rollData.banes.slow;
    if ( weapons.slow && slowBanes ) slowBanes.number -= weapons.slow;
    const bulkyBanes = rollData.banes.bulky;
    if ( armor.system.properties.has("bulky") && bulkyBanes ) bulkyBanes.number -= 2;
  }
};

/* -------------------------------------------- */

HOOKS.powerfulThrow000 = {
  prepareAction(item, action) {
    if ( action.tags.has("thrown") || (action.item?.config?.category.id === "bomb") ) {
      action.range.maximum *= 2;
    }
  }
};

/* -------------------------------------------- */

HOOKS.preparedness0000 = {
  preActivateAction(item, action) {
    if ( action.id !== "equipWeapon" ) return;
    if ( action.cost.action && !this.system.status.hasMoved ) {
      action.cost.action = 0;
      action.usage.actorStatus.hasMoved = true;
    }
  }
};

/* -------------------------------------------- */

HOOKS.preternaturalins = {
  prepareInitiativeCheck(item, rollData) {
    rollData.boons.preternaturalInstinct = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.pyromancer000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "flame" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.damagesHealth ) {
          event.effects.push(SYSTEM.EFFECTS.burning(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.resilient0000000 = {
  prepareDefenses(_item, defenses) {
    defenses.wounds.bonus -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.rimecaller000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "frost" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.damagesHealth ) {
          event.effects.push(SYSTEM.EFFECTS.freezing(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.runewarden000000 = {
  prepareResistances(_item, resistances) {
    for ( const rune of this.grimoire.runes.values() ) {
      const dt = rune.damageType;
      if ( (dt === "physical") || (SYSTEM.DAMAGE_TYPES[dt].type === "physical") ) continue;
      resistances[dt].base += Math.ceil(this.abilities.wisdom.value / 2);
    }
  }
};

/* -------------------------------------------- */

HOOKS.saboteur00000000 = {
  prepareAction(item, action) {
    if ( action.item?.config?.category.id === "bomb" ) {
      action.usage.bonuses.skill = Math.max(action.usage.bonuses.skill, SYSTEM.TALENT.TRAINING_RANKS.trained.bonus);
      action.usage.boons[item.id] = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */

HOOKS.inexorableFlame0 = {
  prepareSpells(_item, grimoire) {
    const flame = grimoire.runes.get("flame");
    if ( !flame ) return;
    grimoire.runes.set("flame", flame.clone({scaling: "wisdom"}, {once: true}));
  }
};

/* -------------------------------------------- */

HOOKS.seasonedveteran0 = {
  prepareMovement(_item, movement) {
    movement.engagementBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.shieldward000000 = {
  prepareAction(_item, action) {
    if ( (action.gesture?.id === "ward") && this.equipment.weapons.shield ) action.cost.hands = 0;
  }
};

/* -------------------------------------------- */

HOOKS.snakeblood000000 = {
  prepareResistances(_item, resistances) {
    resistances.poison.base += 5;
  }
};

/* -------------------------------------------- */

HOOKS.sorcerer00000000 = {
  useAction(item, action) {
    if ( action.tags.has("iconicSpell") ) {
      throw new Error(_loc("SPELL.WARNINGS.SorcererNoIconic", {talent: item.name}));
    }
  },
  preActivateAction(item, action) {
    if ( action.tags.has("spell") ) {
      this.usage.bonuses.damageBonus ||= 0;
      this.usage.bonuses.damageBonus += this.grimoire.iconicSlots;
    }
  }
};

/* -------------------------------------------- */

HOOKS.spellblade000000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") ) return;
    const mh = this.equipment.weapons.mainhand;
    if ( mh.config.category.ranged ) return;

    // Add weapon damage bonus to Strike gesture
    if ( action.gesture.id === "strike" ) {
      action.damage.bonus = (action.damage.bonus ?? 0) + mh.system.damage.bonus;
    }

    // Reduce cost of spell following strike
    const lastAction = this.lastConfirmedAction;
    if ( lastAction?.tags.has("strike") ) action.cost.action -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.spellmute0000000 = {
  defendAttack(item, action, origin, rollData) {
    if ( action.tags.has("spell") ) rollData.banes.spellmute = {label: item.name, number: 2};
  },
  prepareActions(_item, actions) {
    for ( const [id, action] of Object.entries(actions) ) {
      if ( action.tags.has("spell") ) delete actions[id];
    }
    delete actions.cast;
  }
};

/* -------------------------------------------- */

HOOKS.stilllake0000000 = {
  defendAttack(item, action, _origin, rollData) {
    if ( !action.tags.has("skill") ) return;
    if ( CONFIG.SYSTEM.SKILLS[action.usage.skillId].category !== "soc" ) return;
    rollData.banes.stillLake = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.strikefirst00000 = {
  prepareAttack(item, action, target, rollData) {
    if ( !["strike", "spell"].some(t => action.tags.has(t)) ) return;
    const ac = this.combatant;
    const tc = target.combatant;
    if ( ac?.initiative > tc?.initiative ) rollData.boons.strikeFirst = {label: item.name, number: 1};
  }
};

/* -------------------------------------------- */

HOOKS.stronggrip000000 = {
  prepareAction(_item, action) {
    const isTwoHanded = this.equipment.weapons.twoHanded;
    const isMelee = !this.equipment.weapons.ranged;
    if ( isTwoHanded && isMelee ) action.usage.availableHands += 1;
  },
  defendAttack(item, action, _origin, rollData) {
    const isDisarm = action.tags.has("disarm");
    const isTwoHanded = this.equipment.weapons.twoHanded;
    const isMelee = !this.equipment.weapons.ranged;
    if ( isDisarm && isTwoHanded && isMelee ) rollData.banes.strongGrip = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.surgeweaver00000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "lightning" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.isDamage ) {
          event.effects.push(SYSTEM.EFFECTS.shocked(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.testudo000000000 = {
  defendAttack(item, action, _origin, rollData) {
    if ( action.tags.has("strike") && this.statuses.has("guarded") && this.equipment.weapons.shield ) {
      rollData.banes.testudo = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */

HOOKS.thickskin0000000 = {
  prepareResistances(_item, resistances) {
    resistances.bludgeoning.base += 2;
    resistances.slashing.base += 2;
    resistances.piercing.base += 2;
  }
};

/* -------------------------------------------- */

HOOKS.thoughtbinder000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "control" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.isDamage ) {
          event.effects.push(SYSTEM.EFFECTS.dominated(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.truegrit00000000 = {
  prepareMovement(_item, movement) {
    movement.engagementBonus += 1;
  }
};

/* -------------------------------------------- */

HOOKS.unarmedblocking0 = {
  prepareDefenses(_item, defenses) {
    const weapons = this.equipment.weapons;
    if ( weapons.unarmed ) {
      const toughness = this.system.abilities.toughness.value;
      defenses.block.bonus += Math.ceil(toughness / 2);
    }
  }
};

/* -------------------------------------------- */

HOOKS.voidcaller000000 = {
  applyCriticalEffects(_item, action) {
    if ( action.rune?.id !== "oblivion" ) return;
    for ( const [target, events] of action.eventsByTarget ) {
      for ( const event of events.roll ) {
        if ( event.isCriticalSuccess && event.isDamage ) {
          event.effects.push(SYSTEM.EFFECTS.entropy(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */


HOOKS.weakpoints000000 = {
  prepareAttack(_item, action, target, rollData) {
    if ( !action.tags.has("strike") ) return;
    const weapon = action.usage.weapon;
    if ( !weapon?.system.config.category.scaling.includes("dexterity") ) return;
    if ( ["exposed", "flanked", "unaware"].some(s => target.statuses.has(s)) ) rollData.damageBonus += 2;
  }
};

/* -------------------------------------------- */

HOOKS.vowofanimus00000 = {
  // TODO would be better handled if hooks can exist on active effects as a defendAttack hook
  prepareAttack(item, action, target, rollData) {
    if ( !["strike", "skill"].some(t => action.tags.has(t)) ) return;
    if ( !target.effects.has(SYSTEM.EFFECTS.getEffectId(item.actions[0].id)) ) return;
    rollData.boons.vowOfAnimus = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

HOOKS.warmage000000000 = {
  prepareAction(item, action) {
    if ( action.id === "counterspell" ) action.usage.boons.warMage = {label: item.name, number: 2};
  }
};

/* -------------------------------------------- */

export default HOOKS;
