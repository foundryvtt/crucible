/**
 * Crucible (WIP) Game System
 * Author: Atropos
 * Software License: GNU GPLv3
 * Repository: https://gitlab.com/foundrynet/crucible
 */

// Import Modules
import { SYSTEM } from "./module/config/system.js";
import { CrucibleActor } from "./module/entities/actor.js";
import { CrucibleItem } from "./module/entities/item.js";
import { HeroSheet } from "./module/sheets/hero.js";
import { SkillSheet } from "./module/sheets/skill.js";


/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Crucible Game System`);

  // Record Configuration Values
  CONFIG.SYSTEM = SYSTEM;
  CONFIG.Actor.entityClass = CrucibleActor;
  CONFIG.Item.entityClass = CrucibleItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet(SYSTEM.id, HeroSheet, {types: ["hero"], makeDefault: true});
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(SYSTEM.id, SkillSheet, {types: ["skill"], makeDefault: true});
});


/* -------------------------------------------- */
/*  Ready Hooks                                 */
/* -------------------------------------------- */

Hooks.once("ready", function() {

  // Prevent the creation of Items with certain types
  game.system.entityTypes.Item.splice(game.system.entityTypes.Item.findIndex(i => i === "skill"), 1);
});