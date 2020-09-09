/**
 * Crucible (WIP) Game System
 * Author: Atropos
 * Software License: GNU GPLv3
 * Repository: https://gitlab.com/foundrynet/crucible
 */

// Import Modules
import {SYSTEM} from "./module/config/system.js";
import CrucibleActor from "./module/entities/actor.js";
import CrucibleItem from "./module/entities/item.js";
import HeroSheet from "./module/sheets/hero.js";

import AncestrySheet from "./module/sheets/ancestry.js";
import ArmorSheet from "./module/sheets/armor.js";
import BackgroundSheet from "./module/sheets/background.js";
import WeaponSheet from "./module/sheets/weapon.js";

import StandardCheck from "./module/dice/standard-check.js";

import {handleSocketEvent} from "./module/socket.js";
import {addChatMessageContextOptions} from "./module/chat.js";
import {localizeSkillConfig} from "./module/config/skills.js";


/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Crucible Game System`);

  // Record Configuration Values
  CONFIG.SYSTEM = SYSTEM;
  CONFIG.Actor.entityClass = CrucibleActor;
  CONFIG.Item.entityClass = CrucibleItem;

  // Populate the system object
  game.system.dice = {
    StandardCheck
  };

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet(SYSTEM.id, HeroSheet, {types: ["hero"], makeDefault: true});
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(SYSTEM.id, AncestrySheet, {types: ["ancestry"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, ArmorSheet, {types: ["armor"], makeDefault: true});
  Items.registerSheet(SYSTEM.id, BackgroundSheet, {types: ["background"], makeDefault: true});
  Items.registerSheet("core", WeaponSheet, {types: ["weapon"], makeDefault: true});

  // Register Dice mechanics
  CONFIG.Dice.rolls.push(StandardCheck);

  // Activate socket handler
  game.socket.on(`system.${SYSTEM.id}`, handleSocketEvent);
});


/* -------------------------------------------- */
/*  Ready Hooks                                 */
/* -------------------------------------------- */

Hooks.once("ready", function() {

  // Apply localizations
  const toLocalize = [
    "ABILITIES", "ARMOR.CATEGORIES", "ARMOR.PROPERTIES", "ATTRIBUTE_CATEGORIES", "DAMAGE_CATEGORIES",
    "DAMAGE_TYPES", "RESOURCES", "SAVE_DEFENSES", "SKILL_CATEGORIES", "SKILL_RANKS", "WEAPON.CATEGORIES"
  ];
  for ( let c of toLocalize ) {
    const conf = getProperty(SYSTEM, c);
    for ( let [k, v] of Object.entries(conf) ) {
      if ( v.label ) v.label = game.i18n.localize(v.label);
      if ( v.abbreviation) v.abbreviation = game.i18n.localize(v.abbreviation);
      if ( typeof v === "string" ) conf[k] = game.i18n.localize(v);
    }
    Object.freeze(c);
  }
  localizeSkillConfig(SYSTEM.SKILLS, SYSTEM.id);
});


/* -------------------------------------------- */
/*  Rendering Hooks                             */
/* -------------------------------------------- */

// Add chat log context hooks
Hooks.on("getChatLogEntryContext", addChatMessageContextOptions);

