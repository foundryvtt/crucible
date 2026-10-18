import {defineEnum} from "./enum.mjs";
import {TAGS as ACTION_TAGS} from "./action.mjs";
import {MOVEMENT_RULES} from "./actor.mjs";
import {DAMAGE_TYPES, DEFENSES, RESOURCES} from "./attributes.mjs";
import {CATEGORIES as CONSUMABLE_CATEGORIES} from "./consumable.mjs";
import {GROUPS as PROFICIENCY_GROUPS, SKILLS, SPELLCRAFT, WEAPONS} from "./proficiencies.mjs";

/**
 * The types of talent nodes which are supported.
 * @type {Readonly<Record<string, {id: string, label: string, style: string, icon: string, passive?: boolean}>>}
 */
export const NODE_TYPES = defineEnum({
  origin: {label: "TALENT.NODES.Origin", style: "originHex", icon: "GlyphOrigin", passive: false},
  attack: {label: "TALENT.NODES.Attack", style: "rect", icon: "GlyphMelee", passive: false},
  melee: {label: "TALENT.NODES.Melee", style: "rect", icon: "GlyphMelee", passive: false},
  ranged: {label: "TALENT.NODES.Ranged", style: "rect", icon: "GlyphRanged", passive: false},
  magic: {label: "TALENT.NODES.Magic", style: "rect", icon: "GlyphMagic", passive: false},
  defense: {label: "TALENT.NODES.Defense", style: "rect", icon: "GlyphDefense"},
  heal: {label: "TALENT.NODES.Heal", style: "rect", icon: "GlyphHealing"},
  spell: {label: "TALENT.NODES.Spell", style: "rect", icon: "GlyphSpellcraft"},
  move: {label: "TALENT.NODES.Movement", style: "rect", icon: "GlyphMovement"},
  utility: {label: "TALENT.NODES.Utility", style: "rect", icon: "GlyphUtility"},
  skill: {label: "TALENT.NODES.Skill", style: "rect", icon: "GlyphSkill"},
  signature: {label: "TALENT.NODES.Signature", style: "largeHex", icon: "GlyphSignature", passive: false}
});

/**
 * Configuration for each tier of the tree.
 * @type {Readonly<Record<"root"|number, {level: number, ability: number}>>}
 */
export const NODE_TIERS = Object.freeze({
  root: {level: 0, ability: 0},
  0: {level: 0, ability: 2},
  1: {level: 0, ability: 3},
  2: {level: 2, ability: 4},
  3: {level: 3, ability: 5},
  4: {level: 4, ability: 5},
  5: {level: 5, ability: 6},
  6: {level: 6, ability: 6},
  7: {level: 7, ability: 7},
  8: {level: 8, ability: 7},
  9: {level: 9, ability: 8},
  10: {level: 10, ability: 8},
  11: {level: 11, ability: 9},
  12: {level: 12, ability: 9},
  13: {level: 13, ability: 10},
  14: {level: 14, ability: 10},
  15: {level: 15, ability: 11},
  16: {level: 16, ability: 11},
  17: {level: 17, ability: 12},
  18: {level: 18, ability: 12}
});

/**
 * The maximum number of Signature Talents a hero may acquire (reached at character level 18).
 * @type {number}
 */
export const SIGNATURE_MAX = 6;

/**
 * The character level interval at which a hero gains capacity for an additional Signature Talent (first at level 3).
 * @type {number}
 */
export const SIGNATURE_LEVEL_INTERVAL = 3;

/**
 * Groups of Talent keywords, ordered for display by ascending sort priority.
 * @type {Readonly<Record<string, {id: string, label: string, sort: number}>>}
 */
export const KEYWORD_GROUPS = defineEnum({
  playstyle: {label: "TALENT.KEYWORD_GROUPS.Playstyle", sort: 1},
  weapons: {label: "TALENT.KEYWORD_GROUPS.Weapons", sort: 2},
  armor: {label: "TALENT.KEYWORD_GROUPS.Armor", sort: 3},
  defense: {label: "TALENT.KEYWORD_GROUPS.Defense", sort: 4},
  fightingStyle: {label: "TALENT.KEYWORD_GROUPS.FightingStyle", sort: 5},
  toolbelt: {label: "TALENT.KEYWORD_GROUPS.Toolbelt", sort: 6},
  spellComponents: {label: "TALENT.KEYWORD_GROUPS.SpellComponents", sort: 7},
  damage: {label: "TALENT.KEYWORD_GROUPS.Damage", sort: 8},
  targetDefense: {label: "TALENT.KEYWORD_GROUPS.TargetDefense", sort: 9},
  targetResource: {label: "TALENT.KEYWORD_GROUPS.TargetResource", sort: 10},
  restoration: {label: "TALENT.KEYWORD_GROUPS.Restoration", sort: 11},
  resources: {label: "TALENT.KEYWORD_GROUPS.Resources", sort: 12},
  tactics: {label: "TALENT.KEYWORD_GROUPS.Tactics", sort: 13},
  time: {label: "TALENT.KEYWORD_GROUPS.Time", sort: 14},
  exp: {label: PROFICIENCY_GROUPS.exp.label, sort: 15},
  kno: {label: PROFICIENCY_GROUPS.kno.label, sort: 16},
  soc: {label: PROFICIENCY_GROUPS.soc.label, sort: 17},
  trade: {label: PROFICIENCY_GROUPS.trade.label, sort: 18}
});

/**
 * Keywords describing the playstyles a Talent has particular affinity with, keyed by namespaced id.
 * It is intended to assign a keyword to a Talent when it is clearly more valuable to a character building for that
 * premise than to other characters.
 * @type {Readonly<Record<string, {id: string, label: string, group: string, sort: number}>>}
 */
export const KEYWORDS = defineEnum({
  // Surviving harm or absorbing it for allies
  "playstyle.defensive": {group: "playstyle", label: "TALENT.KEYWORDS.Defensive"},
  // Melee attacks or benefits to them, including thrown melee weapons
  "playstyle.melee": {group: "playstyle", label: "TALENT.KEYWORDS.Melee"},
  // Ranged weapon attacks or benefits to them
  "playstyle.ranged": {group: "playstyle", label: "TALENT.KEYWORDS.Ranged"},
  // Casting spells or improving spellcraft
  "playstyle.spellcraft": {group: "playstyle", label: "TALENT.KEYWORDS.Spellcraft"},
  // A non-damage role which is not defensive: stealth, mobility, control, restoration, skill support
  "playstyle.utility": {group: "playstyle", label: "TALENT.KEYWORDS.Utility"},

  // Weapons: a weapon category the Talent requires or favors; an unrestricted ranged Strike earns every ranged one
  ...Object.values(WEAPONS).reduce((obj, {id, label}) => {
    obj[`weapon.${id}`] = {group: "weapons", label};
    return obj;
  }, {}),

  // Armor: an armor weight the Talent requires or rewards
  "armor.heavy": {group: "armor", label: "TALENT.KEYWORDS.HeavyArmor"},
  "armor.light": {group: "armor", label: "TALENT.KEYWORDS.LightArmor"},
  "armor.medium": {group: "armor", label: "TALENT.KEYWORDS.MediumArmor"},
  "armor.unarmored": {group: "armor", label: "TALENT.KEYWORDS.Unarmored"},

  // Defense: improves or triggers from one of your own defenses or your Resistances
  "defense.block": {group: "defense", label: DEFENSES.block.label},
  "defense.dodge": {group: "defense", label: DEFENSES.dodge.label},
  "defense.fortitude": {group: "defense", label: DEFENSES.fortitude.label},
  "defense.madness": {group: "defense", label: DEFENSES.madness.label},
  "defense.parry": {group: "defense", label: DEFENSES.parry.label},
  "defense.reflex": {group: "defense", label: DEFENSES.reflex.label},
  "defense.resistance": {group: "defense", label: "ATTRIBUTES.Resistances"},
  "defense.willpower": {group: "defense", label: DEFENSES.willpower.label},
  "defense.wounds": {group: "defense", label: DEFENSES.wounds.label},

  // Fighting Style: requires or favors a way of wielding your set of weapons
  "weapons.dualwield": {group: "fightingStyle", label: ACTION_TAGS.dualwield.label},
  "weapons.onehand": {group: "fightingStyle", label: ACTION_TAGS.onehand.label},
  "weapons.thrown": {group: "fightingStyle", label: ACTION_TAGS.thrown.label},
  "weapons.twohand": {group: "fightingStyle", label: ACTION_TAGS.twohand.label},

  // Toolbelt: improves a consumable category, or toolbelt items generally
  "consumable.bomb": {group: "toolbelt", label: CONSUMABLE_CATEGORIES.bomb.label},
  "consumable.flask": {group: "toolbelt", label: CONSUMABLE_CATEGORIES.flask.label},
  "consumable.trap": {group: "toolbelt", label: CONSUMABLE_CATEGORIES.trap.label},
  "equipment.toolbelt": {group: "toolbelt", label: "TALENT.KEYWORDS.Toolbelt"},

  // Spell component types: only a Talent which grants that component, never one which merely modifies it
  "spell.gesture": {group: "spellComponents", label: "SPELL.COMPONENTS.GesturePl"},
  "spell.inflection": {group: "spellComponents", label: "SPELL.COMPONENTS.InflectionPl"},
  "spell.rune": {group: "spellComponents", label: "SPELL.COMPONENTS.RunePl"},

  // Spellcraft families: grants, modifies, or specializes a Rune belonging to that family
  ...Object.values(SPELLCRAFT).reduce((obj, {id, label}) => {
    obj[`spell.${id}`] = {group: "spellComponents", label};
    return obj;
  }, {}),

  // Damage: the Talent fixes or favors a damage type; never for Strikes whose type depends on the weapon used
  ...Object.values(DAMAGE_TYPES).reduce((obj, {id, label}) => {
    obj[`damageType.${id}`] = {group: "damage", label};
    return obj;
  }, {}),

  // Target Defense: attacks the target's Fortitude, Reflex, or Willpower rather than their Physical defense
  "target.fortitude": {group: "targetDefense", label: DEFENSES.fortitude.label},
  "target.reflex": {group: "targetDefense", label: DEFENSES.reflex.label},
  "target.willpower": {group: "targetDefense", label: DEFENSES.willpower.label},

  // Target Resource: deals damage to a resource; Health only when damaging it is unusually central to the Talent
  "target.health": {group: "targetResource", label: RESOURCES.health.label},
  "target.morale": {group: "targetResource", label: RESOURCES.morale.label},

  // Restoration: restores Health or Morale, to yourself or allies
  "target.healing": {group: "restoration", label: ACTION_TAGS.healing.label},
  "target.rallying": {group: "restoration", label: ACTION_TAGS.rallying.label},

  // Resources: changes Action or Focus economy in the player's favor; reduced-cost follow-up attacks do not count
  "resource.action": {group: "resources", label: RESOURCES.action.label},
  "resource.focus": {group: "resources", label: RESOURCES.focus.label},
  // Spends Heroism, or changes how Heroism works in the player's favor
  "resource.heroism": {group: "resources", label: RESOURCES.heroism.label},

  // Tactics: maintains an ongoing effect, moves you or traverses an environment, summons an ally, or manipulates
  // engagement
  "action.maintained": {group: "tactics", label: ACTION_TAGS.maintained.label},
  "action.movement": {group: "tactics", label: ACTION_TAGS.movement.label},
  "action.summon": {group: "tactics", label: ACTION_TAGS.summon.label},
  "movement.engagement": {group: "tactics", label: MOVEMENT_RULES.engagement.label},
  // Grants or extends a way of perceiving, or innately defeats the perception and detection of others
  senses: {group: "tactics", label: "TALENT.KEYWORDS.Senses"},

  // Time: when the Talent is used; outside combat, as a reaction, during Rest, or around Initiative
  "action.noncombat": {group: "time", label: ACTION_TAGS.noncombat.label},
  "action.reaction": {group: "time", label: ACTION_TAGS.reaction.label},
  "action.rest": {group: "time", label: "TALENT.KEYWORDS.Rest"},
  initiative: {group: "time", label: "TALENT.KEYWORDS.Initiative"},

  // Skills: makes a character better at using that skill, not merely advancing its training
  ...Object.values(SKILLS).reduce((obj, {id, group, label}) => {
    obj[`skill.${id}`] = {group, label};
    return obj;
  }, {})
});

// Resolve each keyword's group id to the group label and sort priority used for optgroups and ordering
for ( const keyword of Object.values(KEYWORDS) ) {
  const {label, sort} = KEYWORD_GROUPS[keyword.group];
  Object.assign(keyword, {group: label, sort});
}

/**
 * A mapping of talent IDs which changed, used by CrucibleActor#syncTalents during migrations.
 * Mapping to a UUID string results in talent replacement.
 * Mapping to null results in talent deletion.
 * @type {Readonly<string, string|null>}
 */
export const TALENT_ID_MIGRATIONS = {

  // Spellcraft Rune Renames
  runecourage00000: "Compendium.crucible.talent.Item.runeSoul00000000",
  runedeath0000000: "Compendium.crucible.talent.Item.runeDeath0000000",
  runeearth0000000: "Compendium.crucible.talent.Item.runeEarth0000000",
  runeflame0000000: "Compendium.crucible.talent.Item.runeFlame0000000",
  runefrost0000000: "Compendium.crucible.talent.Item.runeFrost0000000",
  runekinesis00000: "Compendium.crucible.talent.Item.runeKinesis00000",
  runelife00000000: "Compendium.crucible.talent.Item.runeLife00000000",
  runelightning000: "Compendium.crucible.talent.Item.runeStorm0000000",
  runemind00000000: "Compendium.crucible.talent.Item.runeControl00000",
  runeradiance0000: "Compendium.crucible.talent.Item.runeIllumination",
  runetime00000000: "Compendium.crucible.talent.Item.runeIllusion0000",
  runevoid00000000: "Compendium.crucible.talent.Item.runeOblivion0000",

  // Weapon Trainings
  heavystrike00000: "Compendium.crucible.talent.Item.heavyStrike00000",
  heavyWeaponTrain: "Compendium.crucible.talent.Item.heavyStrike00000",
  lightWeaponTrain: "Compendium.crucible.talent.Item.lunge00000000000",
  mechanicalTraini: "Compendium.crucible.talent.Item.rapidReload00000",
  mechanicalWeapon: "Compendium.crucible.talent.Item.rapidReload00000",
  rapidreload00000: "Compendium.crucible.talent.Item.rapidReload00000",
  naturalWeaponTra: "Compendium.crucible.talent.Item.wildStrike000000",
  projectileTraini: "Compendium.crucible.talent.Item.quickDraw0000000",
  projectileWeapon: "Compendium.crucible.talent.Item.quickDraw0000000",
  shieldCombatTrai: "Compendium.crucible.talent.Item.shieldBash000000",
  talismanWeaponTr: "Compendium.crucible.talent.Item.refocus000000000",
  unarmedCombatTra: "Compendium.crucible.talent.Item.grapple000000000",

  // Lightning to Storm Rune Rename
  runeLightning000: "Compendium.crucible.talent.Item.runeStorm0000000",

  // Assess Strength reworked to read Health against Morale
  assessstrength00: "Compendium.crucible.talent.Item.assessResolve000",

  // Adversary Talent Renames
  rakingTalons0000: "Compendium.crucible.adversary-talents.Item.rake000000000000",

  /*
   * Training-only talents, retired when training became a point total advanced by ordinary talents rather
   * than a rank purchased on the Tree. Nothing replaces them; the points they conferred now come from the
   * Proficiency track. Entries which formerly renamed their way here are mapped straight to null.
   */

  // Skill ladders
  arcanaNovice0000: null,
  arcanaJourneyman: null,
  arcanaAdept00000: null,
  arcanaMaster0000: null,
  athleticsNovice0: null,
  athleticsJourney: null,
  athleticsAdept00: null,
  athleticsMaster0: null,
  awarenessNovice0: null,
  awarenessJourney: null,
  awarenessAdept00: null,
  awarenessMaster0: null,
  deceptionNovice0: null,
  deceptionJourney: null,
  deceptionAdept00: null,
  deceptionMaster0: null,
  diplomacyNovice0: null,
  diplomacyJourney: null,
  diplomacyAdept00: null,
  diplomacyMaster0: null,
  intimidationNovi: null,
  intimidationJour: null,
  intimidationAdep: null,
  intimidationMast: null,
  medicineNovice00: null,
  medicineJourneym: null,
  medicineAdept000: null,
  medicineMaster00: null,
  performanceNovic: null,
  performanceJourn: null,
  performanceAdept: null,
  performanceMaste: null,
  scienceNovice000: null,
  scienceJourneyma: null,
  scienceAdept0000: null,
  scienceMaster000: null,
  societyNovice000: null,
  societyJourneyma: null,
  societyAdept0000: null,
  societyMaster000: null,
  stealthNovice000: null,
  stealthJourneyma: null,
  stealthAdept0000: null,
  stealthMaster000: null,
  wildernessNovice: null,
  wildernessJourne: null,
  wildernessAdept0: null,
  wildernessMaster: null,

  // Trade Skill ladders
  alchemyNovice000: null,
  alchemyJourneyma: null,
  cookingNovice000: null,
  cookingJourneyma: null,
  enchantingNovice: null,
  enchantingJourne: null,
  fletchingNovice0: null,
  fletchingJourney: null,
  glyphweavingNovi: null,
  glyphweavingJour: null,
  runeweavingNovic: null,
  runeweavingJourn: null,
  jewelcraftNovice: null,
  jewelcraftJourne: null,
  smithingNovice00: null,
  smithingJourneym: null,
  tailoringNovice0: null,
  tailoringJourney: null,

  // Rune Proficiency
  controlProficien: null,
  ControlProficien: null,
  deathProficiency: null,
  DeathProficiency: null,
  earthProficiency: null,
  EarthProficiency: null,
  flameProficiency: null,
  frostProficiency: null,
  FrostProficiency: null,
  illuminationProf: null,
  IlluminationProf: null,
  illusionProficie: null,
  IllusionProficie: null,
  kinesisProficien: null,
  KinesisProficien: null,
  lifeProficiency0: null,
  LifeProficiency0: null,
  oblivionProficie: null,
  OblivionProficie: null,
  soulProficiency0: null,
  SoulProficiency0: null,
  stormProficiency: null,
  lightningProfici: null,
  LightningProfici: null,

  // Weapon Proficiency
  heavyWeaponProfi: null,
  lightWeaponProfi: null,
  mechanicalProfic: null,
  naturalWeaponPro: null,
  projectileProfic: null,
  shieldCombatProf: null,
  talismanWeaponPr: null,
  unarmedCombatPro: null
};

/* -------------------------------------------- */

/**
 * Normalize the talents granted by an Ancestry, Background, Archetype, or Taxonomy in candidate source data.
 * Converts the legacy bare-string shape and applies {@link TALENT_ID_MIGRATIONS} to each granted UUID,
 * dropping grants of talents which were retired without replacement.
 * Grants are resolved by a plain `fromUuid`, which silently skips a talent that has since been renamed, so a
 * grant list that is never migrated decays without reporting anything.
 * @param {object} source   Candidate source data for a detail item, modified in place
 */
export function migrateTalentGrants(source) {
  if ( !source.talents?.length ) return;
  source.talents = source.talents.reduce((arr, t) => {
    const grant = typeof t === "string" ? {item: t, level: null} : t;
    grant.item = migrateTalentUuid(grant.item);
    if ( grant.item ) arr.push(grant);
    return arr;
  }, []);
}

/* -------------------------------------------- */

/**
 * Apply {@link TALENT_ID_MIGRATIONS} to a talent UUID.
 * @param {string} uuid         The talent UUID
 * @returns {string|null}       The migrated UUID, or null if the talent was retired without replacement
 */
export function migrateTalentUuid(uuid) {
  const id = uuid?.split(".").pop();
  if ( id in TALENT_ID_MIGRATIONS ) return TALENT_ID_MIGRATIONS[id];
  return uuid || null;
}
