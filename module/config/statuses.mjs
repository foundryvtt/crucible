import {shocked} from "./effects.mjs";

const nonGroupTypes = {actorTypes: ["hero", "antagonist"]};


export const statusEffects = [
  {
    id: "weakened",
    name: "ACTIVE_EFFECT.STATUSES.Weakened",
    icon: "systems/crucible/icons/statuses/weakened.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.weakened00000000",
  },
  {
    id: "dead",
    name: "ACTIVE_EFFECT.STATUSES.Dead",
    icon: "icons/svg/skull.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.dead000000000000"
  },
  {
    id: "broken",
    name: "ACTIVE_EFFECT.STATUSES.Broken",
    icon: "systems/crucible/icons/statuses/broken.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.broken0000000000"
  },
  {
    id: "insane",
    name: "ACTIVE_EFFECT.STATUSES.Insane",
    icon: "systems/crucible/icons/statuses/insane.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.insane0000000000"
  },
  {
    id: "staggered",
    name: "ACTIVE_EFFECT.STATUSES.Staggered",
    icon: "systems/crucible/icons/statuses/staggered.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.staggered0000000"
  },
  {
    id: "stunned",
    name: "ACTIVE_EFFECT.STATUSES.Stunned",
    icon: "icons/svg/daze.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.stunned000000000"
  },
  {
    id: "prone",
    name: "ACTIVE_EFFECT.STATUSES.Prone",
    icon: "icons/svg/falling.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.prone00000000000"
  },
  {
    id: "restrained",
    name: "ACTIVE_EFFECT.STATUSES.Restrained",
    icon: "icons/svg/net.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.restrained000000"
  },
  {
    id: "slowed",
    name: "ACTIVE_EFFECT.STATUSES.Slowed",
    icon: "systems/crucible/icons/statuses/slowed.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.slowed0000000000"
  },
  {
    id: "hastened",
    name: "ACTIVE_EFFECT.STATUSES.Hastened",
    icon: "systems/crucible/icons/statuses/hastened.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.hastened00000000"
  },
  {
    id: "disoriented",
    name: "ACTIVE_EFFECT.STATUSES.Disoriented",
    icon: "systems/crucible/icons/statuses/disoriented.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.disoriented00000"
  },
  {
    id: "exhausted",
    name: "ACTIVE_EFFECT.STATUSES.Exhausted",
    icon: "systems/crucible/icons/statuses/exhausted.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.exhausted0000000"
  },

  {
    id: "blinded",
    name: "ACTIVE_EFFECT.STATUSES.Blind",
    icon: "icons/svg/blind.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.blinded000000000"
  },
  {
    id: "deafened",
    name: "ACTIVE_EFFECT.STATUSES.Deaf",
    icon: "icons/svg/deaf.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.deafened00000000"
  },
  {
    id: "silenced",
    name: "ACTIVE_EFFECT.STATUSES.Mute",
    icon: "icons/svg/silenced.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.silenced00000000"
  },
  {
    id: "enraged",
    name: "ACTIVE_EFFECT.STATUSES.Enraged",
    icon: "systems/crucible/icons/statuses/enraged.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.enraged000000000"
  },
  {
    id: "frightened",
    name: "ACTIVE_EFFECT.STATUSES.Fear",
    icon: "icons/svg/terror.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.frightened000000"
  },
  {
    id: "invisible",
    name: "ACTIVE_EFFECT.STATUSES.Invisible",
    icon: "icons/svg/invisible.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.invisible0000000"
  },
  {
    id: "resolute",
    name: "ACTIVE_EFFECT.STATUSES.Resolute",
    icon: "systems/crucible/icons/statuses/resolute.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.resolute00000000"
  },
  {
    id: "guarded",
    name: "ACTIVE_EFFECT.STATUSES.Guarded",
    icon: "systems/crucible/icons/statuses/guarded.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.guarded000000000"
  },
  {
    id: "exposed",
    name: "ACTIVE_EFFECT.STATUSES.Exposed",
    icon: "systems/crucible/icons/statuses/exposed.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.exposed000000000"
  },
  {
    id: "flanked",
    name: "ACTIVE_EFFECT.STATUSES.Flanked",
    icon: "systems/crucible/icons/statuses/flanked.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.flanked000000000"
  },
  {
    id: "diseased",
    name: "ACTIVE_EFFECT.STATUSES.Diseased",
    icon: "icons/svg/acid.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.diseased00000000"
  },
  {
    id: "paralyzed",
    name: "ACTIVE_EFFECT.STATUSES.Paralyzed",
    icon: "icons/svg/paralysis.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.paralyzed0000000"
  },
  {
    id: "asleep",
    name: "ACTIVE_EFFECT.STATUSES.Asleep",
    icon: "icons/svg/sleep.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.asleep0000000000"
  },
  {
    id: "incapacitated",
    name: "ACTIVE_EFFECT.STATUSES.Incapacitated",
    icon: "icons/svg/unconscious.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.incapacitated000"
  },
  {
    id: "unaware",
    name: "ACTIVE_EFFECT.STATUSES.Unaware",
    icon: "systems/crucible/icons/statuses/unaware.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.unaware000000000"
  },

  // Damage Over Time
  {
    id: "bleeding",
    name: "Bleeding",
    icon: "icons/skills/wounds/blood-spurt-spray-red.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.bleeding00000000"
  },
  {
    id: "burning",
    name: "Burning",
    icon: "icons/magic/fire/projectile-smoke-swirl-red.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.burning000000000"
  },
  {
    id: "freezing",
    name: "Freezing",
    icon: "icons/magic/water/orb-ice-web.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.freezing00000000"
  },
  {
    id: "confused",
    name: "Confused",
    icon: "icons/magic/air/air-burst-spiral-pink.webp",
    hud: false
    // page: TODO
  },
  {
    id: "corroding",
    name: "Corroding",
    icon: "icons/magic/earth/orb-stone-smoke-teal.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.corroding0000000"
  },
  {
    id: "decaying",
    name: "Corroding",
    icon: "icons/magic/unholy/strike-beam-blood-red-purple.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.decaying00000000"
  },
  {
    id: "entropy",
    name: "Entropy",
    icon: "icons/magic/unholy/orb-swirling-teal.webp",
    hud: false
    // page: TODO
  },
  {
    id: "irradiated",
    name: "Irradiated",
    icon: "icons/magic/light/beams-rays-orange-purple-large.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.irradiated000000"
  },
  {
    id: "mending",
    name: "Mending",
    icon: "icons/magic/life/cross-beam-green.webp",
    hud: false
    // page: TODO
  },
  {
    id: "inspired",
    name: "Inspired",
    icon: "icons/magic/light/explosion-star-glow-silhouette.webp",
    hud: false
    // page: TODO
  },
  {
    id: "poisoned",
    name: "Poisoned",
    icon: "icons/magic/unholy/orb-smoking-green.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.poisoned00000000"
  },
  {
    id: "shocked",
    name: "Shocked",
    icon: "icons/magic/lightning/bolt-strike-forked-blue.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.shocked000000000"
  },
];
