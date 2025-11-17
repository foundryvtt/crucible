const HOOKS = {};

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
}

/* -------------------------------------------- */

HOOKS.armoredShell0000 = {
  prepareDefenses(item, defenses) {
    if ( !this.statuses.has("guarded") ) return;
    const offhand = this.equipment.weapons.offhand;
    if ( offhand.category !== "shieldHeavy" ) return;
    const halfArmor = Math.ceil(defenses.armor.base / 2);
    defenses.armor.base -= halfArmor;
    defenses.block.bonus += halfArmor;
  }
};

/* -------------------------------------------- */

HOOKS.bard000000000000 = {
  prepareSpellAttack(item, spell, _target, rollData) {
    if ( spell.rune.id === "soul" ) rollData.boons.bard = {label: item.name, number: 2};
  }
}

/* -------------------------------------------- */

HOOKS.battlefocus00000 = {
  applyCriticalEffects(_item, _action, outcome, self) {
    // Must damage health or morale
    const damageHealth = outcome.resources.health < 0;
    const damageMorale = outcome.resources.morale < 0;
    if ( !(damageHealth || damageMorale) ) return;

    // Can only happen once per round
    const updates = self.actorUpdates;
    const hasStatus = this.status.battleFocus || updates.system?.status?.battleFocus;
    if ( hasStatus ) return;

    // Increase Focus
    self.resources.focus = (self.resources.focus || 0) + 1;
    foundry.utils.setProperty(updates, "system.status.battleFocus", true);
  }
}

/* -------------------------------------------- */

HOOKS.bloodfrenzy00000 = {
  applyCriticalEffects(_item, _action, outcome, self) {
    // Must damage health
    const damageHealth = outcome.resources.health < 0;
    if ( !damageHealth ) return;

    // Can only happen once per round
    const updates = self.actorUpdates;
    const hasStatus = this.status.bloodFrenzy || updates.system?.status?.bloodFrenzy;
    if ( hasStatus ) return;

    // Increase Action
    self.resources.action = (self.resources.action || 0) + 1;
    foundry.utils.setProperty(updates, "system.status.bloodFrenzy", true);
  }
}

/* -------------------------------------------- */

HOOKS.bloodletter00000 = {
  applyCriticalEffects(item, action, outcome, self) {
    // Must damage health
    const damageHealth = outcome.resources.health < 0;
    if ( !damageHealth ) return;

    // Must deal slashing or piercing damage
    const dt = action.usage.weapon?.system.damageType;
    if ( !["piercing", "slashing"].includes(dt) ) return;
    
    // Bleeding effect
    const bleed = SYSTEM.EFFECTS.bleeding(this, {damageType: dt});
    outcome.effects.push(bleed);
  }
}

/* -------------------------------------------- */

HOOKS.bloodmagic000000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("spell") ) return;
    action.cost.health = action.cost.focus * 10;
    action.cost.focus = 0;
  },
  finalizeAction(item, action, outcome) {
    if ( !outcome.self ) return;
    outcome.resources.health = Math.min(outcome.resources.health, -action.cost.health);
  }
};

/* -------------------------------------------- */

HOOKS.bloodSense000000 = {
  prepareWeaponAttack(_item, _action, target, rollData) {
    if ( target.resources.health.value < target.resources.health.max ) delete rollData.banes.blind;
  },
  prepareSkillAttack(_item, _action, target, rollData) {
    if ( target.resources.health.value < target.resources.health.max ) delete rollData.banes.blind;
  }
}

/* -------------------------------------------- */

HOOKS.bulwark000000000 = {
  prepareActions(item, actions) {
    const defend = actions.defend;
    if ( !defend || !this.equipment.weapons.shield || this.system.status.bulwark ) return;
    defend.cost.action -= 1;
    defend.usage.actorUpdates["system.status.bulwark"] = true;
  }
}

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
  }
}

/* -------------------------------------------- */

HOOKS.cadence000000000 = {
  prepareWeaponAttack(item, action, _target, rollData) {
    if ( action.usage.weapon.config.category.hands !== 1 ) return;
    const {cadence} = this.status;
    const {actorStatus} = action.usage;
    actorStatus.cadence = (cadence ?? 0) + 1;
    if ( cadence ) rollData.boons.cadence = {label: item.name, number: cadence};
  }
}

/* -------------------------------------------- */

HOOKS.carefree00000000 = {
  prepareDefenses(_item, defenses) {
    defenses.madness.bonus -= 1;
  }
}

/* -------------------------------------------- */

HOOKS.concussiveblows0 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Must damage health
    const damageHealth = outcome.resources.health < 0;
    if ( !damageHealth ) return;

    // Must deal bludgeoning damage
    const dt = action.usage.weapon?.system.damageType;
    if ( dt !== "bludgeoning" ) return;

    // Apply stagger
    const stagger = SYSTEM.EFFECTS.staggered(this, outcome.target);
    outcome.effects.push(stagger);
  }
}

/* -------------------------------------------- */

HOOKS.conjurer00000000 = {
  prepareAction(_item, action) {
    if ( action.gesture?.id !== "create" ) return;
    const effectIds = Array.fromRange(3, 1).map(i => SYSTEM.EFFECTS.getEffectId(`conjurercreate${i}`));
    const effectId = effectIds.find(id => !this.effects.has(id)) || effectIds[0];
    action.usage.summons = [{effectId}];
  }
}

/* -------------------------------------------- */

HOOKS.conserveeffort00 = {
  endTurn(item, {resourceRecovery, statusText}) {
    if ( this.resources.action.value ) {
      resourceRecovery.focus = (resourceRecovery.focus || 0) + 1;
      statusText.push({text: "Conserve Effort", fillColor: SYSTEM.RESOURCES.focus.color.css});
    }
  }
}

/* -------------------------------------------- */

HOOKS.distancerunner00 = {
  prepareMovement(_item, movement) {
    movement.stride += 1;
  }
}

/* -------------------------------------------- */

HOOKS.dustbinder000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Earth rune
    if ( action.rune?.id !== "earth" ) return;

    // Require damage to Health
    const damageHealth = outcome.resources.health < 0;
    if ( !damageHealth ) return;

    // Apply Corroding effect
    outcome.effects.push(SYSTEM.EFFECTS.corroding(this));
  }
}

/* -------------------------------------------- */

HOOKS.evasiveshot00000 = {
  prepareWeaponAttack(item, action, _target, _rollData) {
    const isRanged = action.usage.strikes.some(w => w.system.config.category.ranged);
    if ( isRanged ) {
      const movementBonus = (this.system.status.movement?.bonus ?? 0) + Math.ceil(this.system.movement.stride / 2);
      foundry.utils.setProperty(action.usage.actorStatus, "movement.bonus", movementBonus);
    }
  }
}

/* -------------------------------------------- */

HOOKS.healer0000000000 = {
  prepareSpellAttack(item, spell, _target, rollData) {
    if ( spell.rune.id === "life" ) rollData.boons.healer = {label: item.name, number: 2};
  }
}
/* -------------------------------------------- */

HOOKS.holdfast00000000 = {
  prepareMovement(item, movement) {
    if ( this.equipment.weapons.shield ) movement.engagement += 1;
  }
}

/* -------------------------------------------- */

HOOKS.inspirator000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Soul rune
    if ( action.rune?.id !== "soul" ) return;

    // Require restoration to Morale
    const restoreMorale = outcome.resources.morale > 0;
    if ( !restoreMorale ) return;

    // Apply Inspired effect
    const inspired = SYSTEM.EFFECTS.inspired(this, outcome.target);
    outcome.effects.push(inspired);
  }
}

/* -------------------------------------------- */

HOOKS.intellectualsupe = {
  prepareWeaponAttack(item, _action, target, rollData) {
    const ac = this.combatant;
    const tc = target.combatant;
    if ( ac?.initiative > tc?.initiative ) rollData.boons.intellectualSuperiority = {label: item.name, number: 1};
  },
  prepareSpellAttack(item, _action, target, rollData) {
    const ac = this.combatant;
    const tc = target.combatant;
    if ( ac?.initiative > tc?.initiative ) rollData.boons.intellectualSuperiority = {label: item.name, number: 1};
  }
}

/* -------------------------------------------- */

HOOKS.irrepressiblespi = {
  startTurn(item, {resourceRecovery}) {
    if ( !this.system.isBroken ) resourceRecovery.morale = (resourceRecovery.morale || 0) + 1;
  }
}

/* -------------------------------------------- */

HOOKS.kineturge0000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Kinesis rune
    if ( action.rune?.id !== "kinesis" ) return;

    // Require damage to Health or Morale
    const damageHealth = outcome.resources.health < 0;
    const damageMorale = outcome.resources.morale < 0;
    if ( !(damageHealth || damageMorale) ) return;

    // Apply Bleeding effect
    const bleeding = SYSTEM.EFFECTS.bleeding(this, {ability: "presence"});
    bleeding.duration = {rounds: 1};
  }
}

/* -------------------------------------------- */

HOOKS.lesserregenerati = {
  startTurn(item, {resourceRecovery}) {
    if ( !this.system.isWeakened ) resourceRecovery.health = (resourceRecovery.health || 0) + 1;
  }
}

/* -------------------------------------------- */

HOOKS.lightbringer0000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Illumination rune
    if ( action.rune?.id !== "illumination" ) return;

    // Require damage to Health or Morale
    const damageHealth = outcome.resources.health < 0;
    const damageMorale = outcome.resources.morale < 0;
    if ( !(damageHealth || damageMorale) ) return;

    // Apply Irradiated effect
    const irradiated = SYSTEM.EFFECTS.irradiated(this, outcome.target);
    outcome.effects.push(irradiated);
  }
}

/* -------------------------------------------- */

HOOKS.mender0000000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Life rune
    if ( action.rune?.id !== "life" ) return;

    // Require restoration to Health
    const restoreHealth = outcome.resources.health > 0;
    if ( !restoreHealth ) return;

    // Apply Mending effect
    const mending = SYSTEM.EFFECTS.mending(this, outcome.target);
    outcome.effects.push(mending);
  }
}

/* -------------------------------------------- */

HOOKS.mentalfortress00 = {
  prepareResistances(item, resistances) {
    resistances.psychic.base += 5;
  },
  prepareDefenses(item, defenses) {
    defenses.willpower.bonus += 1;
  }
}

/* -------------------------------------------- */

HOOKS.mesmer0000000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Illusion rune
    if ( action.rune?.id !== "illusion" ) return;

    // Require damage to Morale
    const damageMorale = outcome.resources.morale < 0;
    if ( !damageMorale ) return;

    // Apply Confused effect
    const confused = SYSTEM.EFFECTS.confused(this);
    outcome.effects.push(confused);
  }
}

/* -------------------------------------------- */

HOOKS.necromancer00000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Death rune
    if ( action.rune?.id !== "death" ) return;

    // Require damage to Health
    const damageHealth = outcome.resources.health < 0;
    if ( !damageHealth ) return;

    // Apply Decay effect
    const decay = SYSTEM.EFFECTS.decay(this, outcome.target);
    outcome.effects.push(decay);
  }
}

/* -------------------------------------------- */

HOOKS.nosferatu0000000 = {
  prepareResistances(_item, resistances) {
    resistances.radiant.base -= 10;
  }
}

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
}

/* -------------------------------------------- */

HOOKS.packhunter000000 = {
  prepareWeaponAttack(item, _action, target, rollData) {
    if ( target.statuses.has("flanked") ) {
      rollData.boons.packHunter = {
        label: item.name, 
        number: rollData.boons.flanked.number
      };
    }
  }
}

/* -------------------------------------------- */

HOOKS.patientdeflectio = {
  prepareDefenses(_item, defenses) {
    const weapons = this.equipment.weapons;
    if ( weapons.unarmed ) {
      const wisdom = this.system.abilities.wisdom.value;
      defenses.parry.bonus += Math.ceil(wisdom / 2);
    }
  }
}

/* -------------------------------------------- */

HOOKS.planneddefense00 = {
  defendAttack(item, action, origin, rollData) {
    if ( !["spell", "strike"].some(tag => action.tags.has(tag)) ) return;
    const ac = this.combatant;
    const oc = origin.combatant;
    if ( ac?.initiative > oc?.initiative ) rollData.banes.plannedDefense = {label: item.name, number: 1};
  }
}

/* -------------------------------------------- */

HOOKS.poisoner00000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Must damage health
    const damageHealth = outcome.resources.health < 0; if ( !damageHealth ) return;

    // Active effect must be active
    const hasEffect = this.effects.get(SYSTEM.EFFECTS.getEffectId("poisonBlades"));
    if ( !hasEffect ) return;

    // Requires piercing or slashing damage with a melee action
    if ( !action.tags.has("melee") ) return;
    const dt = action.usage.weapon?.system.damageType;
    if ( !["piercing", "slashing"].includes(dt) ) return;

    // Apply the poisoned condition
    const poisoned = SYSTEM.EFFECTS.poisoned(this, outcome.target);
    outcome.effects.push(poisoned);
  }
}

/* -------------------------------------------- */

HOOKS.powerfulphysique = {
  prepareInitiativeCheck(_item, rollData) {
    const {weapons, armor} = this.equipment;

    const slowBanes = rollData.banes.slow;
    if ( weapons.slow && slowBanes ) slowBanes.number -= weapons.slow;

    const bulkyBanes = rollData.banes.bulky;
    if ( armor.system.properties.has("bulky") && bulkyBanes ) bulkyBanes.number -= 2;
  }
}

/* -------------------------------------------- */

HOOKS.powerfulThrow000 = {
  prepareAction(item, action) {
    if ( action.tags.has("thrown") ) {
      action.range.maximum *= 2;
    }
  }
}

/* -------------------------------------------- */

HOOKS.preparedness0000 = {
  preActivateAction(item, action, _targets) {
    if ( action.id !== "equipWeapon" ) return;
    if ( action.cost.action && !this.system.status.hasMoved ) {
      action.cost.action = 0;
      action.usage.actorStatus.hasMoved = true;
    }
  }
}

/* -------------------------------------------- */

HOOKS.preternaturalins = {
  prepareInitiativeCheck(item, rollData) {
    rollData.boons.preternaturalInstinct = {label: item.name, number: 2};
  }
}

/* -------------------------------------------- */

HOOKS.pyromancer000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Flame rune
    if ( action.rune?.id !== "flame" ) return;

    // Require damage to Health
    const damageHealth = outcome.resources.health < 0;
    if ( !damageHealth ) return;

    // Apply Burning effect
    const burning = SYSTEM.EFFECTS.burning(this);
    outcome.effects.push(burning);
  }
}

/* -------------------------------------------- */

HOOKS.resilient0000000 = {
  prepareDefenses(_item, defenses) {
    defenses.wounds.bonus -= 1;
  }
}

/* -------------------------------------------- */

HOOKS.rimecaller000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Frost rune
    if ( action.rune?.id !== "frost" ) return;

    // Require damage to Health
    const damageHealth = outcome.resources.health < 0;
    if ( !damageHealth ) return;

    // Apply Freezing effect
    outcome.effects.push(SYSTEM.EFFECTS.freezing(this));
  }
}

/* -------------------------------------------- */

HOOKS.runewarden000000 = {
  prepareResistances(_item, resistances) {
    for ( const [id, r] of Object.entries(resistances) ) {
      if ( SYSTEM.DAMAGE_TYPES[id].type === "physical" ) continue;
      if ( this.grimoire.runes.find(r => r.damageType === id) )  {
        r.base += Math.ceil(this.abilities.wisdom.value / 2);
      }
    }
  }
}

/* -------------------------------------------- */

HOOKS.seasonedveteran0 = {
  prepareMovement(_item, movement) {
    movement.engagement += 1;
  }
}

/* -------------------------------------------- */

HOOKS.shieldward000000 = {
  prepareAction(_item, action) {
    if ( (action.gesture?.id === "ward") && this.equipment.weapons.shield ) action.cost.hands = 0;
  }
}

/* -------------------------------------------- */

HOOKS.snakeblood000000 = {
  prepareResistances(_item, resistances) {
    resistances.poison.base += 5;
  }
}

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
}

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
}

/* -------------------------------------------- */

HOOKS.stilllake0000000 = {
  defendAttack(item, action, _origin, rollData) {
    if ( !action.tags.has("skill") ) return;
    if ( CONFIG.SYSTEM.SKILLS[action.usage.skillId].category !== "soc" ) return;
    rollData.banes.stillLake = {label: item.name, number: 2};
  }
}

/* -------------------------------------------- */

HOOKS.strikefirst00000 = {
  prepareWeaponAttack(item, _action, target, rollData) {
    const ac = this.combatant;
    const tc = target.combatant;
    if ( ac?.initiative > tc?.initiative ) rollData.boons.strikeFirst = {label: item.name, number: 1};
  },
  prepareSpellAttack(item, _action, target, rollData) {
    const ac = this.combatant;
    const tc = target.combatant;
    if ( ac?.initiative > tc?.initiative ) rollData.boons.strikeFirst = {label: item.name, number: 1};
  }
}

/* -------------------------------------------- */

HOOKS.stronggrip000000 = {
  prepareActions(_actions) {
    const weapons = this.equipment.weapons;
    if ( weapons.twoHanded ) {
      weapons.freeHands += 1;
      weapons.spellHands += 1;
    }
  }
}

/* -------------------------------------------- */

HOOKS.surgeweaver00000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Lightning rune
    if ( action.rune?.id !== "lightning" ) return;

    // Require damage to Health or Morale
    const damageHealth = outcome.resources.health < 0;
    const damageMorale = outcome.resources.morale < 0;
    if ( !(damageHealth || damageMorale) ) return;

    // Apply Shocked effect
    outcome.effects.push(SYSTEM.EFFECTS.shocked(this));
  }
}

/* -------------------------------------------- */

HOOKS.testudo000000000 = {
  defendAttack(item, action, _origin, rollData) {
    if ( action.tags.has("strike") && this.statuses.has("guarded") && this.equipment.weapons.shield ) {
      rollData.banes.testudo = {label: item.name, number: 1};
    }
  }
}

/* -------------------------------------------- */

HOOKS.thickskin0000000 = {
  prepareResistances(_item, resistances) {
    resistances.bludgeoning.base += 2;
    resistances.slashing.base += 2;
    resistances.piercing.base += 2;
  }
}

/* -------------------------------------------- */

HOOKS.thoughtbinder000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Control rune
    if ( action.rune?.id !== "control" ) return;
  
    // Require damage to Health or Morale
    const damageHealth = outcome.resources.health < 0;
    const damageMorale = outcome.resources.morale < 0;
    if ( !(damageHealth || damageMorale) ) return;
  
    // Apply Restrained effect
    const restrained = SYSTEM.EFFECTS.restrained(this, outcome.target);
    restrained.duration = {rounds: 1};
    outcome.effects.push(restrained);
  }
}

/* -------------------------------------------- */

HOOKS.truegrit00000000 = {
  prepareMovement(_item, movement) {
    movement.engagement += 1;
  }
}

/* -------------------------------------------- */

HOOKS.unarmedblocking0 = {
  prepareDefenses(_item, defenses) {
    const weapons = this.equipment.weapons;
    if ( weapons.unarmed ) {
      const toughness = this.system.abilities.toughness.value;
      defenses.block.bonus += Math.ceil(toughness / 2);
    }
  }
}

/* -------------------------------------------- */

HOOKS.voidcaller000000 = {
  applyCriticalEffects(_item, action, outcome, _self) {
    // Require Oblivion rune
    if ( action.rune?.id !== "oblivion" ) return;
  
    // Require damage to Morale
    const damageHealth = outcome.resources.health < 0;
    const damageMorale = outcome.resources.morale < 0;
    if ( !(damageHealth || damageMorale) ) return;
  
    // Apply Entropy effect
    const entropy = SYSTEM.EFFECTS.entropy(this, outcome.target);
    outcome.effects.push(entropy);
  }
}

/* -------------------------------------------- */

HOOKS.warmage000000000 = {
  prepareAction(item, action) {
    if ( action.id === "counterspell" ) action.usage.boons.warMage = {label: item.name, number: 2};
  }
}

/* -------------------------------------------- */

export default HOOKS;
