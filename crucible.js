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
import BackgroundSheet from "./module/sheets/background.js";

import StandardCheck from "./module/dice/standard-check.js";


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
  Items.registerSheet(SYSTEM.id, BackgroundSheet, {types: ["background"], makeDefault: true});

  // Register Dice mechanics
  CONFIG.Dice.rolls["StandardCheck"] = StandardCheck;
});


/* -------------------------------------------- */
/*  Ready Hooks                                 */
/* -------------------------------------------- */

Hooks.once("ready", function() {

  // Apply localizations
  const toLocalize = [SYSTEM.ABILITIES, SYSTEM.ATTRIBUTE_CATEGORIES, SYSTEM.DAMAGE_CATEGORIES, SYSTEM.DAMAGE_TYPES,
    SYSTEM.RESOURCES, SYSTEM.SAVE_DEFENSES, SYSTEM.SKILL_CATEGORIES, SYSTEM.SKILL_RANKS];
  for ( let c of toLocalize ) {
    for ( let v of Object.values(c) ) {
      if ( v.label ) v.label = game.i18n.localize(v.label);
      if ( v.abbreviation) v.abbreviation = game.i18n.localize(v.abbreviation);
    }
  }

  // TODO: Prevent the creation of Items with certain types
  game.system.entityTypes.Item.splice(game.system.entityTypes.Item.findIndex(i => i === "skill"), 1);
});


/* -------------------------------------------- */
/*  Rendering Hooks                             */
/* -------------------------------------------- */


Hooks.on("renderChatMessage", (message, html, data) => {
  if ( message.isRoll ) {
    const rollType = message.getFlag(SYSTEM.id, "rollType");
    html.find(".message-content");
  }
});