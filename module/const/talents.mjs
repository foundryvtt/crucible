import {defineEnum} from "./enum.mjs";

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

  /*
   * Weapon Trainings, renamed to the action each carries. Training ceased to be the point of these talents,
   * so each is now named for what it actually does and contributes its training point as a side effect.
   * Two of the ids they reclaim, lunge and shieldBash, were previously migrated away from and now point at
   * themselves once more, so those entries are gone rather than inverted.
   */
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

  // Tradecraft ladders
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
    const id = grant.item?.split(".").pop();
    if ( id in TALENT_ID_MIGRATIONS ) {
      const target = TALENT_ID_MIGRATIONS[id];
      if ( !target ) return arr; // Retired without replacement
      grant.item = target;
    }
    if ( grant.item ) arr.push(grant);
    return arr;
  }, []);
}
