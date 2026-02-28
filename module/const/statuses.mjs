const nonGroupTypes = {actorTypes: ["hero", "adversary"]};


export const statusEffects = {
  weakened: {
    id: "weakened",
    name: "ACTIVE_EFFECT.STATUSES.Weakened",
    img: "systems/crucible/icons/statuses/weakened.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.weakened00000000"
  },
  dead: {
    id: "dead",
    name: "ACTIVE_EFFECT.STATUSES.Dead",
    img: "icons/svg/skull.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.dead000000000000"
  },
  broken: {
    id: "broken",
    name: "ACTIVE_EFFECT.STATUSES.Broken",
    img: "systems/crucible/icons/statuses/broken.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.broken0000000000"
  },
  insane: {
    id: "insane",
    name: "ACTIVE_EFFECT.STATUSES.Insane",
    img: "systems/crucible/icons/statuses/insane.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.insane0000000000"
  },
  staggered: {
    id: "staggered",
    name: "ACTIVE_EFFECT.STATUSES.Staggered",
    img: "systems/crucible/icons/statuses/staggered.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.staggered0000000"
  },
  stunned: {
    id: "stunned",
    name: "ACTIVE_EFFECT.STATUSES.Stunned",
    img: "icons/svg/daze.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.stunned000000000"
  },
  prone: {
    id: "prone",
    name: "ACTIVE_EFFECT.STATUSES.Prone",
    img: "icons/svg/falling.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.prone00000000000"
  },
  restrained: {
    id: "restrained",
    name: "ACTIVE_EFFECT.STATUSES.Restrained",
    img: "icons/svg/net.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.restrained000000"
  },
  slowed: {
    id: "slowed",
    name: "ACTIVE_EFFECT.STATUSES.Slowed",
    img: "systems/crucible/icons/statuses/slowed.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.slowed0000000000"
  },
  hastened: {
    id: "hastened",
    name: "ACTIVE_EFFECT.STATUSES.Hastened",
    img: "systems/crucible/icons/statuses/hastened.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.hastened00000000"
  },
  disoriented: {
    id: "disoriented",
    name: "ACTIVE_EFFECT.STATUSES.Disoriented",
    img: "systems/crucible/icons/statuses/disoriented.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.disoriented00000"
  },
  exhausted: {
    id: "exhausted",
    name: "ACTIVE_EFFECT.STATUSES.Exhausted",
    img: "systems/crucible/icons/statuses/exhausted.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.exhausted0000000"
  },
  blinded: {
    id: "blinded",
    name: "ACTIVE_EFFECT.STATUSES.Blind",
    img: "icons/svg/blind.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.blinded000000000"
  },
  burrowing: {
    id: "burrowing",
    name: "ACTIVE_EFFECT.STATUSES.Burrowing",
    img: "icons/svg/burrow.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.burrowing0000000"
  },
  deafened: {
    id: "deafened",
    name: "ACTIVE_EFFECT.STATUSES.Deaf",
    img: "icons/svg/deaf.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.deafened00000000"
  },
  silenced: {
    id: "silenced",
    name: "ACTIVE_EFFECT.STATUSES.Mute",
    img: "icons/svg/silenced.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.silenced00000000"
  },
  enraged: {
    id: "enraged",
    name: "ACTIVE_EFFECT.STATUSES.Enraged",
    img: "systems/crucible/icons/statuses/enraged.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.enraged000000000"
  },
  frightened: {
    id: "frightened",
    name: "ACTIVE_EFFECT.STATUSES.Fear",
    img: "icons/svg/terror.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.frightened000000"
  },
  invisible: {
    id: "invisible",
    name: "ACTIVE_EFFECT.STATUSES.Invisible",
    img: "icons/svg/invisible.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.invisible0000000"
  },
  invulnerable: {
    id: "invulnerable",
    name: "ACTIVE_EFFECT.STATUSES.Invulnerable",
    img: "systems/crucible/icons/statuses/invulnerable.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.invulnerable0000"
  },
  resolute: {
    id: "resolute",
    name: "ACTIVE_EFFECT.STATUSES.Resolute",
    img: "systems/crucible/icons/statuses/resolute.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.resolute00000000"
  },
  guarded: {
    id: "guarded",
    name: "ACTIVE_EFFECT.STATUSES.Guarded",
    img: "systems/crucible/icons/statuses/guarded.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.guarded000000000"
  },
  exposed: {
    id: "exposed",
    name: "ACTIVE_EFFECT.STATUSES.Exposed",
    img: "systems/crucible/icons/statuses/exposed.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.exposed000000000"
  },
  flanked: {
    id: "flanked",
    name: "ACTIVE_EFFECT.STATUSES.Flanked",
    img: "systems/crucible/icons/statuses/flanked.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.flanked000000000"
  },
  diseased: {
    id: "diseased",
    name: "ACTIVE_EFFECT.STATUSES.Diseased",
    img: "icons/svg/acid.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.diseased00000000"
  },
  paralyzed: {
    id: "paralyzed",
    name: "ACTIVE_EFFECT.STATUSES.Paralyzed",
    img: "icons/svg/paralysis.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.paralyzed0000000"
  },
  asleep: {
    id: "asleep",
    name: "ACTIVE_EFFECT.STATUSES.Asleep",
    img: "icons/svg/sleep.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.asleep0000000000"
  },
  incapacitated: {
    id: "incapacitated",
    name: "ACTIVE_EFFECT.STATUSES.Incapacitated",
    img: "icons/svg/unconscious.svg",
    hud: nonGroupTypes,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.incapacitated000"
  },
  unaware: {
    id: "unaware",
    name: "ACTIVE_EFFECT.STATUSES.Unaware",
    img: "systems/crucible/icons/statuses/unaware.svg",
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.unaware000000000"
  },

  // Damage Over Time
  bleeding: {
    id: "bleeding",
    name: "ACTIVE_EFFECT.STATUSES.Bleeding",
    img: "icons/skills/wounds/blood-spurt-spray-red.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.bleeding00000000"
  },
  burning: {
    id: "burning",
    name: "ACTIVE_EFFECT.STATUSES.Burning",
    img: "icons/magic/fire/projectile-smoke-swirl-red.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.burning000000000"
  },
  freezing: {
    id: "freezing",
    name: "ACTIVE_EFFECT.STATUSES.Freezing",
    img: "icons/magic/water/orb-ice-web.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.freezing00000000"
  },
  confused: {
    id: "confused",
    name: "ACTIVE_EFFECT.STATUSES.Confused",
    img: "icons/magic/air/air-burst-spiral-pink.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.confused00000000"
  },
  corroding: {
    id: "corroding",
    name: "ACTIVE_EFFECT.STATUSES.Corroding",
    img: "icons/magic/earth/orb-stone-smoke-teal.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.corroding0000000"
  },
  decaying: {
    id: "decaying",
    name: "ACTIVE_EFFECT.STATUSES.Decaying",
    img: "icons/magic/unholy/strike-beam-blood-red-purple.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.decaying00000000"
  },
  dominated: {
    id: "dominated",
    name: "ACTIVE_EFFECT.STATUSES.Dominated",
    img: "icons/magic/control/hypnosis-mesmerism-watch.webp",
    hud: false,
    page: "" // TODO
  },
  entropy: {
    id: "entropy",
    name: "ACTIVE_EFFECT.STATUSES.Entropy",
    img: "icons/magic/unholy/orb-swirling-teal.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.entropy000000000"
  },
  irradiated: {
    id: "irradiated",
    name: "ACTIVE_EFFECT.STATUSES.Irradiated",
    img: "icons/magic/light/beams-rays-orange-purple-large.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.irradiated000000"
  },
  mending: {
    id: "mending",
    name: "ACTIVE_EFFECT.STATUSES.Mending",
    img: "icons/magic/life/cross-beam-green.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.mending000000000"
  },
  inspired: {
    id: "inspired",
    name: "ACTIVE_EFFECT.STATUSES.Inspired",
    img: "icons/magic/light/explosion-star-glow-silhouette.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.inspired00000000"
  },
  poisoned: {
    id: "poisoned",
    name: "ACTIVE_EFFECT.STATUSES.Poisoned",
    img: "icons/magic/unholy/orb-smoking-green.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.poisoned00000000"
  },
  shocked: {
    id: "shocked",
    name: "ACTIVE_EFFECT.STATUSES.Shocked",
    img: "icons/magic/lightning/bolt-strike-forked-blue.webp",
    hud: false,
    page: "Compendium.crucible.rules.JournalEntry.crucibleConditio.JournalEntryPage.shocked000000000"
  }
};
