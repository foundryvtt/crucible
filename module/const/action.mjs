import {SKILLS} from "./skills.mjs";
import {ABILITIES, DAMAGE_TYPES, RESOURCES} from "./attributes.mjs";
import Enum from "./enum.mjs";
import AttackRoll from "../dice/attack-roll.mjs";
import CrucibleAction from "../models/action.mjs";

/**
 * The different required conditions under which an Active Effect can be applied from an Action.
 * @type {Readonly<Record<string, {label: string}>>}
 */
export const EFFECT_RESULT_TYPES = Object.freeze({
  any: {
    label: "ACTION.EFFECT_RESULT_TYPES.Any"
  },
  custom: {
    label: "ACTION.EFFECT_RESULT_TYPES.Custom"
  },
  success: {
    label: "ACTION.EFFECT_RESULT_TYPES.Success"
  },
  successCritical: {
    label: "ACTION.EFFECT_RESULT_TYPES.CriticalSuccess"
  },
  failure: {
    label: "ACTION.EFFECT_RESULT_TYPES.Failure"
  },
  failureCritical: {
    label: "ACTION.EFFECT_RESULT_TYPES.CriticalFailure"
  }
});

/**
 * The scope of creatures affected by an action.
 * @enum {number}
 */
export const TARGET_SCOPES = new Enum({
  NONE: {value: 0, label: "ACTION.TARGET_SCOPES.None"},
  SELF: {value: 1, label: "ACTION.TARGET_SCOPES.Self"},
  ALLIES: {value: 2, label: "ACTION.TARGET_SCOPES.Allies"},
  ENEMIES: {value: 3, label: "ACTION.TARGET_SCOPES.Enemies"},
  ALL: {value: 4, label: "ACTION.TARGET_SCOPES.All"}
});

/**
 * The allowed target types which an Action may have.
 * @enum {{label: string}}
 */
export const TARGET_TYPES = Object.freeze({
  none: {
    label: "ACTION.TARGET_TYPES.None",
    template: null,
    scope: TARGET_SCOPES.NONE
  },
  self: {
    label: "ACTION.TARGET_TYPES.Self",
    template: null,
    scope: TARGET_SCOPES.SELF
  },
  single: {
    label: "ACTION.TARGET_TYPES.Single",
    template: null,
    scope: TARGET_SCOPES.ALL
  },
  cone: {
    label: "ACTION.TARGET_TYPES.Cone",
    template: {
      t: "cone",
      angle: 60,
      directionDelta: 15,
      anchor: "self",
      addSize: true
    },
    scope: TARGET_SCOPES.ALL
  },
  fan: {
    label: "ACTION.TARGET_TYPES.Fan",
    template: {
      t: "cone",
      angle: 210,
      directionDelta: 45,
      anchor: "self",
      addSize: true
    },
    scope: TARGET_SCOPES.ALL
  },
  pulse: {
    label: "ACTION.TARGET_TYPES.Pulse",
    template: {
      t: "circle",
      anchor: "self",
      addSize: true
    },
    scope: TARGET_SCOPES.ALL
  },
  blast: {
    label: "ACTION.TARGET_TYPES.Blast",
    template: {
      t: "circle",
      anchor: "vertex"
    },
    scope: TARGET_SCOPES.ALL
  },
  ray: {
    label: "ACTION.TARGET_TYPES.Ray",
    template: {
      t: "ray",
      width: 1,
      directionDelta: 3,
      anchor: "self",
      addSize: true
    },
    scope: TARGET_SCOPES.ALL
  },
  summon: {
    label: "ACTION.TARGET_TYPES.Summon",
    template: {
      t: "rect",
      direction: 45, // Square
      size: 3,
      anchor: "vertex"
    },
    scope: TARGET_SCOPES.SELF
  },
  wall: {
    label: "ACTION.TARGET_TYPES.Wall",
    template: {
      t: "ray",
      width: 2,
      anchor: "center"
    },
    scope: TARGET_SCOPES.ALL
  }
});

/* -------------------------------------------- */

/**
 * @typedef ActionTag
 * @property {string} tag
 * @property {string} label
 * @property {string[]} propagate     Propagate this tag to also apply other tags
 * @property {number} [priority]      A priority that this tag should be resolved in. Lower values are higher priority
 * @property {Function} [prepare]
 * @property {Function} [can]
 * @property {Function} [pre]
 * @property {Function} [roll]
 * @property {Function} [post]
 */

/**
 * Categories of action tags which are supported by the system.
 * @type {Readonly<Object<string, {label: string}>>}
 */
export const TAG_CATEGORIES = Object.freeze({
  attack: {label: "ACTION.TAG_CATEGORIES.Attack"},
  spellcraft: {label: "ACTION.TAG_CATEGORIES.Spellcraft"},
  skills: {label: "ACTION.TAG_CATEGORIES.Skills"},
  requirements: {label: "ACTION.TAG_CATEGORIES.Requirements"},
  context: {label: "ACTION.TAG_CATEGORIES.Context"},
  modifiers: {label: "ACTION.TAG_CATEGORIES.Modifiers"},
  defenses: {label: "ACTION.TAG_CATEGORIES.Defenses"},
  damage: {label: "ACTION.TAG_CATEGORIES.Damage"},
  scaling: {label: "ACTION.TAG_CATEGORIES.Scaling"},
  resources: {label: "ACTION.TAG_CATEGORIES.Resources"},
  special: {label: "ACTION.TAG_CATEGORIES.Special"}
});

/* -------------------------------------------- */

/**
 * Define special logic for action tag types
 * @enum {ActionTag}
 */
export const TAGS = {

  /* -------------------------------------------- */
  /*  Required Equipment                          */
  /* -------------------------------------------- */

  // Requires Dual-Wield
  dualwield: {
    tag: "dualwield",
    label: "ACTION.TagDualWield",
    tooltip: "ACTION.TagDualWieldTooltip",
    category: "requirements",
    canUse() {
      return this.actor.equipment.weapons.dualWield;
    }
  },

  // Requires One-Handed weapon
  onehand: {
    tag: "onehand",
    label: "ACTION.TagOneHand",
    tooltip: "ACTION.TagOneHandTooltip",
    category: "requirements",
    canUse() {
      return !this.actor.equipment.weapons.twoHanded;
    }
  },

  // Requires Dexterity Weapon
  finesse: {
    tag: "finesse",
    label: "ACTION.TagFinesse",
    tooltip: "ACTION.TagFinesseTooltip",
    category: "requirements",
    canUse() {
      if ( !this.usage.strikes.every(w => w.config.category.scaling.includes("dexterity")) ) {
        throw new Error("Every weapon used in this action must scale using dexterity.");
      }
    }
  },

  // Requires Strength Weapon
  brute: {
    tag: "brute",
    label: "ACTION.TagBrute",
    tooltip: "ACTION.TagBruteTooltip",
    category: "requirements",
    priority: 5,
    canUse() {
      if ( !this.usage.strikes.every(w => w.config.category.scaling.includes("strength")) ) {
        throw new Error("Every weapon used in this action must scale using strength.");
      }
    }
  },

  // Requires a Projectile Weapon
  projectile: {
    tag: "projectile",
    label: "ACTION.TagProjectile",
    tooltip: "ACTION.TagProjectileTooltip",
    category: "requirements",
    propagate: ["ranged"],
    canUse() {
      const {mainhand: mh, offhand: oh} = this.actor.equipment.weapons;
      if ( this.tags.has("offhand") ) return ["projectile1", "projectile2"].includes(oh.category);
      else return ["projectile1", "projectile2"].includes(mh.category);
    }
  },

  // Requires a Mechanical Weapon
  mechanical: {
    tag: "mechanical",
    label: "ACTION.TagMechanical",
    tooltip: "ACTION.TagMechanicalTooltip",
    category: "requirements",
    propagate: ["ranged"],
    canUse() {
      const {mainhand: mh, offhand: oh} = this.actor.equipment.weapons;
      if ( this.tags.has("offhand") ) return ["mechanical1", "mechanical2"].includes(oh.category);
      else return ["mechanical1", "mechanical2"].includes(mh.category);
    }
  },

  // Requires Shield
  shield: {
    tag: "shield",
    label: "ACTION.TagShield",
    tooltip: "ACTION.TagShieldTooltip",
    category: "requirements",
    canUse() {
      return this.actor.equipment.weapons.shield;
    }
  },

  // Requires Unarmed
  unarmed: {
    tag: "unarmed",
    label: "ACTION.TagUnarmed",
    tooltip: "ACTION.TagUnarmedTooltip",
    category: "requirements",
    propagate: ["melee"],
    canUse() {
      return this.actor.equipment.weapons.unarmed;
    }
  },

  // Requires Unarmored
  unarmored: {
    tag: "unarmored",
    label: "ACTION.TagUnarmored",
    tooltip: "ACTION.TagUnarmoredTooltip",
    category: "requirements",
    canUse() {
      return this.actor.equipment.unarmored;
    }
  },

  // After a Basic Strike
  afterStrike: {
    tag: "afterStrike",
    label: "ACTION.TagAfterStrike",
    tooltip: "ACTION.TagActorStrikeTooltip",
    category: "requirements",
    canUse() {
      const lastAction = this.actor.lastConfirmedAction;
      if ( lastAction?.id !== "strike" ) {
        throw new Error(`You may only perform the ${this.name} action after a basic Strike action.`);
      }
      for ( const outcome of lastAction.outcomes.values() ) {
        if ( outcome.target === this.actor ) continue;
        if ( outcome.rolls.some(r => r.isCriticalFailure) ) {
          throw new Error(`You may only perform ${this.name} after a basic Strike which did not critically miss.`);
        }
      }
    }
  },

  /* -------------------------------------------- */
  /*  Context Requirements                        */
  /* -------------------------------------------- */

  // Involves Movement
  movement: {
    tag: "movement",
    label: "ACTION.TagMovement",
    tooltip: "ACTION.TagMovementTooltip",
    category: "context",
    canUse() {
      if ( this.actor.statuses.has("restrained") ) throw new Error("You may not move while Restrained!");
    },
    prepare() {
      const stride = this.actor.system.movement.stride;
      const movement = this.usage.movement || this.actor.getMovementActionCost(stride);
      if ( this.id === "move" ) this.cost.action = movement.cost;
      else if ( this.actor.system.hasFreeMove ) this.cost.action = Math.max(0, this.cost.action - 1);
      this.usage.actorStatus ||= {};
      this.usage.actorStatus.hasMoved = true;
      this.usage.actorStatus.lastMovementId = movement.id || null;
    },
    async confirm() {
      if ( this.actor.statuses.has("prone") ) {
        await this.actor.toggleStatusEffect("prone", {active: false});
      }
    }
  },

  // Requires Reaction
  reaction: {
    tag: "reaction",
    label: "ACTION.TagReaction",
    tooltip: "ACTION.TagReactionTooltip",
    category: "context",
    canUse() {
      if ( !this.actor.inCombat ) return false;
      if ( this.actor.statuses.has("unaware") ) throw new Error("You may not use a reaction while Unaware!");
      return this.actor !== game.combat?.combatant?.actor;
    },
    prepare() {
      const a = this.actor;
      const canFreeReact = a.talentIds.has("gladiator0000000") && !a.system.status.gladiator
        && (this.tags.has("mainhand") || this.tags.has("offhand"));
      if ( canFreeReact ) {
        this.cost.focus = -Infinity;
        this.usage.actorStatus.gladiator = true;
      }
    }
  },

  // Non-Combat Actions
  noncombat: {
    tag: "noncombat",
    label: "ACTION.TagNonCombat",
    tooltip: "ACTION.TagNonCombatTooltip",
    category: "context",
    canUse() {
      if ( this.actor.inCombat ) throw new Error(`You may not use ${this.name} during Combat.`);
    },
  },

  // Requires a Flanked Opponent
  flanking: {
    tag: "flanking",
    label: "ACTION.TagFlanking",
    tooltip: "ACTION.TagFlankingTooltip",
    category: "context",
    acquireTargets(targets) {
      for ( const target of targets ) {
        if ( !target.actor.statuses.has("flanked") ) target.error ??= `${this.name} requires a flanked target. Target "${target.actor.name}" is not flanked.`;
      }
    },
  },

  // Consumables
  consume: {
    tag: "consume",
    label: "ACTION.TagConsume",
    tooltip: "ACTION.TagConsumeTooltip",
    category: "special",
    initialize() {
      if ( this.item?.type === "consumable" ) this.usage.consumable = this.item;
    },
    canUse() {
      const item = this.usage.consumable;
      if ( !item ) throw new Error(`No consumable Item identified for Action "${this.id}"`);
      if ( item.system.isDepleted ) {
        throw new Error(`Consumable item "${item.name}" has no uses remaining for Action "${this.id}"`);
      }
    },
    async confirm(reverse) {
      await this.usage.consumable.system.consume(reverse ? -1 : 1);
    }
  },

  /* -------------------------------------------- */
  /*  Spellcasting Tags                           */
  /* -------------------------------------------- */

  spell: {
    tag: "spell",
    label: "ACTION.TagSpell",
    tooltip: "ACTION.TagSpellTooltip",
    category: "spellcraft",
    priority: 1,
    initialize() {
      Object.assign(this.usage.context, {
        type: "spell",
        label: "Spell Tags",
        icon: "fa-solid fa-sparkles",
        tags: {}
      });
    },
    preActivate() {
      let hands = this.cost.hands ?? 0;
      if ( hands > this.actor.equipment.weapons.spellHands ) {
        throw new Error(`The "${this.name}" spell requires ${this.cost.hands} free hands to cast.`);
      }
    }
  },

  // Composed Spells
  composed: {
    tag: "composed",
    label: "ACTION.TagComposed",
    tooltip: "ACTION.TagComposedTooltip",
    category: "spellcraft",
    priority: 2,
    initialize() {
      if ( this.composition === 0 ) return;
      this.usage.context.tags.rune = game.i18n.format("SPELL.COMPONENTS.RuneSpecific", {rune: this.rune.name});
      this.usage.context.tags.gesture = game.i18n.format("SPELL.COMPONENTS.GestureSpecific", {gesture: this.gesture.name});
      if ( this.inflection ) this.usage.context.tags.inflection = game.i18n.format("SPELL.COMPONENTS.InflectionSpecific", {inflection: this.inflection.name});
      this.usage.actorFlags.lastSpell = this.id;
      this.usage.actorStatus.hasCast = true;
      this.usage.isAttack = true;
      this.usage.isRanged = (this.gesture.target.type !== "self") && (this.range.maximum > 1);
    },
    preActivate() {
      if ( this.cost.hands > this.actor.equipment.weapons.spellHands ) {
        throw new Error(`A Spell using the ${this.gesture.name} gesture requires ${this.cost.hands} free hands for spellcraft.`);
      }
    },
    async roll(outcome) {
      const roll = await this.actor.spellAttack(this, outcome);
      if ( roll ) outcome.rolls.push(roll);
    }
  },

  // Iconic Spell
  iconicSpell: {
    tag: "iconicSpell",
    label: "ACTION.TagIconicSpell",
    tooltip: "ACTION.TagSpellTooltip",
    category: "spellcraft",
    priority: 2,
    prepare() {
      for ( const gestureId of this.parent.gestures ) {
        const gesture = SYSTEM.SPELL.GESTURES[gestureId];
        this.cost.hands = Math.max(this.cost.hands, gesture.hands);
      }
      this.usage.actorStatus.hasCast = true;
    }
  },

  summon: {
    tag: "summon",
    label: "ACTION.TagSummon",
    tooltip: "ACTION.TagSummonTooltip",
    category: "special",
    async postActivate(outcome) {
      if ( (outcome.target !== this.actor) || !outcome.summons?.length ) return;
      for ( const summon of outcome.summons ) {
        const position = this.template || this.token;
        summon.tokenData ||= {};
        summon.tokenData.x ??= position.x;
        summon.tokenData.y ??= position.y;
        if ( (summon.permanent === false) && !outcome.effects.length ) throw new Error(`ActiveEffect data must be 
          defined to track the non-permanent summon created by the action "${this.id}"`);
      }
    },
    async confirm(reverse) {
      if ( reverse ) return; // TODO support reverse
      if ( !this.token ) return; // No token acting  TODO eventually this shouldn't be required?
      const self = this.outcomes.get(this.actor);
      if ( !self.summons?.length ) return;

      // Create summoned tokens
      const summonedTokens = [];
      for ( const summon of self.summons ) {

        // Get or create a world level Actor for the summons
        const sourceActor = await fromUuid(summon.actorUuid);
        const ownership = this.actor.hasPlayerOwner ? {default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER} : {};
        let worldActor = game.actors.get(sourceActor.id);
        if ( !worldActor ) {
          worldActor = await game.actors.importFromCompendium(sourceActor.collection, sourceActor.id, {ownership},
            {keepId: true});
        }
        else await worldActor.update({ownership});

        // Create Token
        const tokenName = worldActor.name;
        const tokenData = foundry.utils.mergeObject({
          name: tokenName,
          disposition: this.actor.prototypeToken.disposition,
          delta: {
            name: tokenName,
            system: {
              resources: {
                "health.value": worldActor.resources.health.max,
                "morale.value": worldActor.resources.morale.max,
                "action.value": worldActor.resources.action.max,
                "focus.value": worldActor.resources.focus.max
              },
            }
          }
        }, summon.tokenData || {});
        Object.assign(tokenData, {actorId: worldActor.id, actorLink: false});
        const preparedToken = await worldActor.getTokenDocument(tokenData, {parent: this.token.parent});
        const token = await TokenDocument.implementation.create(preparedToken, {parent: this.token.parent});
        summonedTokens.push(token.uuid);

        // Create a Combatant
        if ( this.actor.inCombat ) {
          await game.combat.createEmbeddedDocuments("Combatant", [{
            tokenId: token.id,
            sceneId: canvas.scene.id,
            actorId: worldActor.id,
            initiative: 1
          }]);
        }
      }

      // Update Active Effect
      const ae = self.effects?.[0];
      if ( ae ) ae.system.summons = summonedTokens;
    }
  },

  /* -------------------------------------------- */
  /*  Attack Rolls                                */
  /* -------------------------------------------- */

  // Perform a Strike sequence
  strike: {
    tag: "strike",
    priority: Infinity, // Last
    internal: true,
    initialize() {
      this.usage.strikes = []; // Reset strike sequence
    },
    prepare() {
      const {strikes, weapon} = this.usage;

      // Default weapon-based strikes
      if ( !strikes.length && weapon ) strikes.push(weapon);
      if ( !strikes?.length ) return;

      // Record usage properties
      this.usage.actorStatus.hasAttacked = true;
      this.usage.hasDice = true;
      this.usage.isAttack = true;
      if ( this.tags.has("ranged") ) {
        if ( strikes.every(w => w.config.category.ranged) ) this.usage.isRanged = true;
        else this.tags.delete("ranged");
      }
      if ( this.tags.has("melee") ) {
        if ( strikes.every(w => !w.config.category.ranged) ) this.usage.isMelee = true;
        else this.tags.delete("melee");
      }
      this.usage.defenseType ??= "physical";

      // Prepare cost and range for the base strike sequence
      let weaponRange = 0;
      const contextTags = {};
      for ( const [i, weapon] of strikes.entries() ) {
        this.scaling.push(...weapon.config.category.scaling.split("."));
        if ( this.cost.weapon ) this.cost.action += (weapon.system.actionCost || 0);
        if ( this.range.weapon ) {
          if ( !weaponRange ) weaponRange = weapon.system.range;
          else weaponRange = Math.min(weaponRange, weapon.system.range);
        }
        if ( i === 0 ) Object.assign(this.usage.bonuses, weapon.system.actionBonuses);
      }

      // Repeat the sequence if multiple attacks are performed
      const n = this.target.multiple ?? 1;
      if ( n > 1 ) {
        const baseSequence = [...strikes];
        for ( let i=1; i<n; i++ ) {
          strikes.push(...baseSequence);
        }
      }

      // Context tags
      Object.assign(this.usage.context, {label: "Strikes", icon: "fa-solid fa-swords", tags: {}});
      for ( const v of Object.values(contextTags) ) {
        this.usage.context.tags[`weapon.${v.id}`] = v.count > 1 ? `${v.name} (x${v.count})` : v.name;
      }

      // Configure action range
      if ( this.range.weapon ) {
        const baseMaximum = this._source.range.maximum ?? 0;
        this.range.maximum = Math.max(this.range.maximum ?? 0, baseMaximum + weaponRange);
      }
    },
    async roll(outcome) {
      for ( const [i, weapon] of this.usage.strikes.entries() ) {
        const roll = await this.actor.weaponAttack(this, weapon, outcome);
        roll.data.strike = i; // TODO handle this better?
        outcome.rolls.push(roll);
      }
    }
  },

  // Requires a Melee Weapon
  melee: {
    tag: "melee",
    label: "ACTION.TagMelee",
    tooltip: "ACTION.TagMeleeTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 1,
    canUse() {
      if ( !this.actor.equipment.weapons.melee ) {
        throw new Error("You must have melee weapons equipped to use this action.");
      }
    },
    prepare() {
      if ( !this.usage.weapon ) {
        const {mainhand: mh, offhand: oh, natural} = this.actor.equipment.weapons;
        if ( mh && !mh.system.config.category.ranged ) this.usage.weapon = mh;
        else if ( oh && !oh.system.config.category.ranged ) this.usage.weapon = oh;
        else {
          for ( const n of natural ) {
            if ( !n.system.config.category.ranged ) {
              this.usage.weapon = n;
              break;
            }
          }
        }
      }
    }
  },

  // Requires a Ranged Weapon
  ranged: {
    tag: "ranged",
    label: "ACTION.TagRanged",
    tooltip: "ACTION.TagRangedTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 1,
    canUse() {
      if ( !this.actor.equipment.weapons.ranged ) {
        throw new Error("This action requires a ranged weapon equipped.");
      }
      if ( this.usage.strikes.some(w => w.config.category.reload && !w.system.loaded && !this.tags.has("reload")) ) {
        throw new Error("Your weapon requires reloading in order to use this action.");
      }
    },
    prepare() {
      this.usage.actorStatus.rangedAttack = true;
      if ( !this.usage.weapon ) {
        const {mainhand: mh, offhand: oh, natural} = this.actor.equipment.weapons;
        if ( mh && mh.system.config.category.ranged ) this.usage.weapon = mh;
        else if ( oh && oh.system.config.category.ranged ) this.usage.weapon = oh;
        else {
          for ( const n of natural ) {
            if ( n.system.config.category.ranged ) {
              this.usage.weapon = n;
              break;
            }
          }
        }
      }
    },
    preActivate(_targets) {
      for ( const w of this.usage.strikes ) {
        if ( w.config.category.reload ) {
          this.usage.actorUpdates.items ||= [];
          this.usage.actorUpdates.items.push({_id: w.id, "system.loaded": false});
        }
      }
    }
  },

  mainhand: {
    tag: "mainhand",
    label: "ACTION.TagMainHand",
    tooltip: "ACTION.TagMainHandTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 9,
    prepare() {
      this.usage.strikes ||= [];
      const mh = this.actor.equipment.weapons.mainhand;
      if ( mh ) this.usage.strikes.push(mh);
    }
  },

  twohand: {
    tag: "twohand",
    label: "ACTION.TagTwoHanded",
    tooltip: "ACTION.TagTwoHandedTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 9,
    prepare() {
      this.usage.strikes ||= [];
      const mh = this.actor.equipment.weapons.mainhand;
      if ( mh ) this.usage.strikes.push(mh);
    },
    canUse() {
      if ( !this.actor.equipment.weapons.twoHanded ) {
        throw new Error("This action requires a two-handed weapon equipped.");
      }
    }
  },

  offhand: {
    tag: "offhand",
    label: "ACTION.TagOffHand",
    tooltip: "ACTION.TagOffHandTooltip",
    category: "attack",
    propagate: ["strike"],
    priority: 9,
    prepare() {
      this.usage.strikes ||= [];
      const oh = this.actor.equipment.weapons.offhand;
      if ( oh ) this.usage.strikes.push(oh);
    },
    canUse() {
      if ( !this.actor.equipment.weapons.offhand ) {
        throw new Error("This action requires an offhand weapon equipped.");
      }
    }
  },

  thrown: {
    tag: "thrown",
    label: "ACTION.TagThrown",
    tooltip: "ACTION.TagThrownTooltip",
    category: "attack",
    propagate: ["melee"],
    canUse() {
      for ( const w of this.usage.strikes ) {
        if ( !w.system.canThrow() ) throw new Error("You cannot throw this weapon.");
      }
    },
    prepare() {
      this.range.maximum ??= 10;
      this.range.weapon = false;
    },
    preActivate(_targets) {
      if ( !this.usage.strikes?.length ) return;
      for ( const weapon of this.usage.strikes ) {
        if ( !weapon.system.canThrow() ) throw new Error("You cannot throw this weapon.");
        this.usage.actorUpdates.items ||= [];
        this.usage.actorUpdates.items.push({_id: weapon.id, system: {dropped: true, equipped: false}});
        if ( !weapon.system.properties.has("thrown") ) this.usage.banes[this.id] = {label: this.name, number: 2};
      }
    }
  },

  natural: {
    tag: "natural",
    category: "attack",
    label: "ACTION.TagNatural",
    tooltip: "ACTION.TagNaturalTooltip",
    propagate: ["melee"],
    priority: 9,
    canUse() {
      if ( !this.usage.strikes.every(w => w.system.properties.has("natural")) ) {
        throw new Error("This action requires use of a natural weapon.");
      }
    },
    prepare() {
      this.usage.strikes ||= [];
      const w = this.usage.weapon ?? this.actor.equipment.weapons.natural[0];
      if ( w ) this.usage.strikes.push(w);
    }
  },

  hazard: {
    tag: "hazard",
    category: "attack",
    priority: 0,
    internal: true,
    initialize() {
      Object.assign(this.usage, {hasDice: true, defenseType: "physical", resource: "health"});
      this.usage.bonuses.ability = this.usage.hazard;
      this.usage.bonuses.base = 1;
    },
    async roll(outcome) {
      const n = this.target.multiple ?? 1;
      for ( let i=0; i<n; i++ ) {
        const roll = await outcome.target.receiveAttack(this);
        outcome.rolls.push(roll);
      }
    }
  },

  /* -------------------------------------------- */
  /*  Special Actions                             */
  /* -------------------------------------------- */

  generic: {
    tag: "generic",
    label: "ACTION.TagGeneric",
    tooltip: "ACTION.TagGenericTooltip",
    category: "special",
    priority: 9,
    prepare() {
      this.usage.hasDice = true;
      this.usage.bonuses.enchantment = this.item.system.config?.enchantment.bonus || 0;
      this.usage.defenseType ??= "physical";
      this.usage.resource ??= "health";
      this.usage.damageType ??= "void";
    },
    async roll(outcome) {
      const {bonuses, damageType, defenseType, resource} = this.usage; // TODO outcome.usage?
      const target = outcome.target;

      // Create and evaluate a generic roll
      const roll = new AttackRoll({
        actorId: this.id,
        target: target.uuid,
        ability: bonuses.ability ?? 0,
        skill: bonuses.skill ?? 0,
        enchantment: bonuses.enchantment,
        defenseType,
        dc: target.defenses[defenseType].total
      });
      await roll.evaluate();

      // Compute the final result against defenses
      const r = roll.data.result = target.testDefense(defenseType, roll);
      if ( r < AttackRoll.RESULT_TYPES.GLANCE ) return roll;
      roll.data.damage = {
        overflow: roll.overflow,
        multiplier: 1,
        base: 0,
        bonus: 0,
        resistance: target.getResistance(resource, damageType),
        type: damageType,
        resource: resource,
        restoration: false
      };
      roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);
      outcome.rolls.push(roll);
    }
  },

  /* -------------------------------------------- */

  reload: {
    tag: "reload",
    label: "ACTION.TagReload",
    tooltip: "ACTION.TagReloadTooltip",
    category: "special",
    canUse() {
      const {mainhand: m, offhand: o, reload} = this.actor.equipment.weapons;
      if ( !reload || (m.system.loaded && (!o || o.system.loaded)) ) {
        throw new Error("Your weapons do not require reloading");
      }
    },
    prepare() {
      const {mainhand: m, offhand: o} = this.actor.equipment.weapons;
      this.usage.actorUpdates.items ||= [];
      if (m.config.category.reload && !m.system.loaded) {
        this.usage.actorUpdates.items.push({_id: m.id, "system.loaded": true});
      }
      else if (o?.config.category.reload && !o.system.loaded) {
        this.usage.actorUpdates.items.push({_id: o.id, "system.loaded": true});
      }
    }
  },

  /* -------------------------------------------- */

  disarm: {
    tag: "disarm",
    label: "ACTION.TagDisarm",
    tooltip: "ACTION.TagDisarmTooltip",
    category: "special",
    postActivate(outcome) {
      if ( outcome.target === this.actor ) return;
      if ( outcome.rolls.every(r => r.isSuccess) ) {
        const {mainhand} = outcome.target.equipment.weapons; // TODO - allow usage customization?
        if ( !mainhand?.id ) return;
        outcome.actorUpdates.items ||= [];
        outcome.actorUpdates.items.push({_id: mainhand.id, system: {dropped: true, equipped: false}});
        outcome.statusText.push({text: "Disarmed!", fontSize: 64});
      }
    }
  },

  /* -------------------------------------------- */
  /*  Attack Modifiers                            */
  /* -------------------------------------------- */

  deadly: {
    tag: "deadly",
    label: "ACTION.TagDeadly",
    tooltip: "ACTION.TagDeadlyTooltip",
    category: "modifiers",
    prepare() {
      this.usage.bonuses.multiplier += 1;
    },
  },

  difficult: {
    tag: "difficult",
    label: "ACTION.TagDifficult",
    tooltip: "ACTION.TagDifficultTooltip",
    category: "modifiers",
    prepare() {
      this.usage.banes.difficult = {label: "ACTION.TagDifficult", number: 1};
    }
  },

  empowered: {
    tag: "empowered",
    label: "ACTION.TagEmpowered",
    tooltip: "ACTION.TagEmpoweredTooltip",
    category: "modifiers",
    prepare() {
      this.usage.bonuses.damageBonus += 6;
    },
  },
  accurate: {
    tag: "accurate",
    label: "ACTION.TagAccurate",
    tooltip: "ACTION.TagAccurateTooltip",
    category: "modifiers",
    prepare() {
      this.usage.boons.accurate = {label: "ACTION.TagAccurate", number: 2};
    }
  },
  harmless: {
    tag: "harmless",
    label: "ACTION.TagHarmless",
    tooltip: "ACTION.TagHarmlessTooltip",
    category: "modifiers",
    async postActivate(outcome) {
      for ( const roll of outcome.rolls ) {
        if ( roll.data.damage ) {
          roll.data.damage.base = roll.data.damage.total = 0;
        }
      }
    }
  },
  weakened: {
    tag: "weakened",
    label: "ACTION.TagWeakened",
    tooltip: "ACTION.TagWeakenedTooltip",
    category: "modifiers",
    prepare() {
      this.usage.bonuses.damageBonus -= 6;
    }
  },

  /* -------------------------------------------- */
  /*  Defense Modifiers                           */
  /* -------------------------------------------- */

  // Target Fortitude
  fortitude: {
    tag: "fortitude",
    label: "DEFENSES.Fortitude",
    category: "defenses",
    prepare() {
      this.usage.defenseType = "fortitude";
    },
  },

  // Target Reflex
  reflex: {
    tag: "reflex",
    label: "DEFENSES.Reflex",
    category: "defenses",
    prepare() {
      this.usage.defenseType = "reflex";
    },
  },

  // Target Willpower
  willpower: {
    tag: "willpower",
    label: "DEFENSES.Willpower",
    category: "defenses",
    prepare() {
      this.usage.defenseType = "willpower";
    },
  },

  /* -------------------------------------------- */
  /*  Healing Actions                             */
  /* -------------------------------------------- */

  healing: {
    tag: "healing",
    label: "ACTION.TagHealing",
    tooltip: "ACTION.TagHealingTooltip",
    category: "damage",
    prepare() {
      this.usage.resource = "health";
      this.usage.defenseType = "wounds";
      this.usage.restoration = true;
    }
  },

  rallying: {
    tag: "rallying",
    label: "ACTION.TagRallying",
    tooltip: "ACTION.TagRallyingTooltip",
    category: "damage",
    prepare() {
      this.usage.resource = "morale";
      this.usage.defenseType = "madness";
      this.usage.restoration = true;
    }
  },

  /* -------------------------------------------- */
  /*             Resource Consumption             */
  /* -------------------------------------------- */

  maintained: {
    tag: "maintained",
    label: "ACTION.TagMaintained",
    tooltip: "ACTION.TagMaintainedTooltip",
    category: "resources",
    async postActivate(outcome) {
      if ( !outcome.self ) return;
      const maintainedEffectData = outcome.effects[0];
      const maintainedCost = this.actor.actions[this.id]?.cost.focus ?? this.gesture?.cost.focus ?? 1;
      maintainedEffectData.system.maintenance = {cost: maintainedCost};
    }
  }
}

/* -------------------------------------------- */
/*  Specialized Damage Type                     */
/* -------------------------------------------- */

for ( const {id, label} of Object.values(DAMAGE_TYPES) ) {
  TAGS[id] = {
    tag: id,
    label: label,
    category: "damage",
    initialize() {
      this.usage.damageType = id;
    }
  }
}

/* -------------------------------------------- */
/*  Specialized Scaling                         */
/* -------------------------------------------- */

for ( const {id, label} of Object.values(ABILITIES) ) {
  TAGS[id] = {
    tag: id,
    label,
    category: "scaling",
    initialize() {
      this.usage.bonuses.ability = this.actor.getAbilityBonus([id]);
    }
  }
}

/* -------------------------------------------- */
/*  Target Resources                            */
/* -------------------------------------------- */

for ( const resource of ["health", "morale"] ) {
  TAGS[resource] = {
    tag: resource,
    label: RESOURCES[resource].label,
    category: "resources",
    initialize() {
      this.usage.resource = resource
    }
  }
}

/* -------------------------------------------- */
/*  Skill Attacks                               */
/* -------------------------------------------- */

// All Skill Attacks
TAGS.skill = {
  tag: "skill",
  label: "ACTION.TagSkill",
  category: "skills"
};

// Specific Skills
for ( const {id, abilities, label} of Object.values(SKILLS) ) {
  TAGS[id] = {
    tag: id,
    label,
    category: "skills",
    propagate: ["skill"],
    initialize() {
      this.scaling.push(...abilities);
      this.training.push(id);
      this.usage.skillId = id;
      const skill = this.actor.skills[id];
      this.usage.hasDice = true;
      Object.assign(this.usage.bonuses, {
        ability: skill.abilityBonus,
        skill: skill.skillBonus,
        enchantment: skill.enchantmentBonus
      });
      Object.assign(this.usage.context, {type: "skill", label: "Skill Tags", icon: "fa-solid fa-cogs"});
      this.usage.context.tags.skill = SKILLS[id].label;
    },
    async roll(outcome) {
      const roll = await this.actor.skillAttack(this, outcome);
      outcome.rolls.push(roll);
    }
  }
}

/* -------------------------------------------- */

/**
 * The default actions that every character can perform regardless of their attributes or talents.
 * @type {object[]}
 */
export const DEFAULT_ACTIONS = Object.freeze([

  // Cast Spell
  {
    id: "cast",
    name: "ACTION.DEFAULT_ACTIONS.Cast.Name",
    img: "icons/magic/air/air-smoke-casting.webp",
    description: "ACTION.DEFAULT_ACTIONS.Cast.Description",
    tags: [],
    target: {
      type: "none",
    }
  },

  // Basic Movement
  {
    id: "move",
    name: "ACTION.DEFAULT_ACTIONS.Move.Name",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    description: "ACTION.DEFAULT_ACTIONS.Move.Description",
    target: {
      type: "none",
      number: 0,
      scope: 1
    },
    tags: ["movement"]
  },

  // Defend
  {
    id: "defend",
    name: "ACTION.DEFAULT_ACTIONS.Defend.Name",
    img: "icons/magic/defensive/shield-barrier-deflect-teal.webp",
    description: "ACTION.DEFAULT_ACTIONS.Defend.Description",
    target: {
      type: "self",
      number: 0,
      scope: 1
    },
    cost: {
      action: 2
    },
    effects: [
      {
        duration: { rounds: 1 },
        statuses: ["guarded"]
      }
    ]
  },

  // Delay
  {
    id: "delay",
    name: "ACTION.DEFAULT_ACTIONS.Delay.Name",
    img: "icons/magic/time/clock-analog-gray.webp",
    description: "ACTION.DEFAULT_ACTIONS.Delay.Description",
    target: {
      type: "self",
      scope: 1
    }
  },

  // Reactive Strike
  {
    id: "reactiveStrike",
    name: "ACTION.DEFAULT_ACTIONS.ReactiveStrike.Name",
    img: "icons/skills/melee/blade-tip-orange.webp",
    description: "ACTION.DEFAULT_ACTIONS.ReactiveStrike.Description",
    cost: {
      action: -1,
      focus: 1,
      weapon: true
    },
    range: {
      weapon: true
    },
    target: {
      type: "single",
      number: 1,
      scope: 3
    },
    tags: ["reaction"], // Added to in #prepareDefaultActions
  },

  // Throw Weapon
  {
    id: "throwWeapon",
    name: "ACTION.DEFAULT_ACTIONS.ThrowWeapon.Name",
    img: "icons/skills/ranged/dagger-thrown-jeweled-green.webp",
    description: "ACTION.DEFAULT_ACTIONS.ThrowWeapon.Description",
    cost: {
      weapon: true
    },
    target: {
      type: "single",
      number: 1,
      scope: 3
    },
    tags: ["thrown"]
  },

  // Recover
  {
    id: "recover",
    name: "ACTION.DEFAULT_ACTIONS.Recover.Name",
    img: "icons/magic/life/cross-area-circle-green-white.webp",
    description: "ACTION.DEFAULT_ACTIONS.Recover.Description",
    target: {
      type: "self",
      number: 0,
      scope: 1
    },
    cost: {
      action: 0
    },
    tags: ["noncombat"]
  },

  // Reload
  {
    id: "reload",
    name: "ACTION.DEFAULT_ACTIONS.Reload.Name",
    img: "icons/skills/ranged/arrow-flying-broadhead-metal.webp",
    description: "ACTION.DEFAULT_ACTIONS.Reload.Description",
    cost: {
      action: 2
    },
    tags: ["reload"],
    target: {
      type: "self",
    }
  },

  // Rest
  {
    id: "rest",
    name: "ACTION.DEFAULT_ACTIONS.Rest.Name",
    img: "icons/magic/time/arrows-circling-green.webp",
    description: "ACTION.DEFAULT_ACTIONS.Rest.Description",
    target: {
      type: "self",
      number: 0,
      scope: 1
    },
    cost: {
      action: 0
    },
    tags: ["noncombat"]
  },

  // Basic Strike
  {
    id: "strike",
    name: "ACTION.DEFAULT_ACTIONS.Strike.Name",
    img: "icons/skills/melee/blade-tip-orange.webp",
    description: "ACTION.DEFAULT_ACTIONS.Strike.Description",
    range: {
      weapon: true
    },
    target: {
      type: "single",
      number: 1,
      scope: 3
    },
    cost: {
      action: 0,
      weapon: true
    }
  }
]);
