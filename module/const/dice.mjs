export const checkDifficulties = {
  9: "DICE.DIFFICULTIES.Trivial",
  12: "DICE.DIFFICULTIES.Easy",
  15: "DICE.DIFFICULTIES.Moderate",
  19: "DICE.DIFFICULTIES.Challenging",
  24: "DICE.DIFFICULTIES.Difficult",
  30: "DICE.DIFFICULTIES.Formidable",
  36: "DICE.DIFFICULTIES.Impossible"
};


export const passiveCheck = 10;

export const MAX_BOONS = 6;
export const MAX_BANES = 6;
export const DIE_STEP = 2;
export const MIN_DIE = 4;
export const MAX_DIE = 12;

export const RULES = Object.freeze({
  boon: {
    label: "DICE.Boons.one",
    name: "DICE.Boons.many",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.Qme1mM71Jn950Zsf"
  },
  bane: {
    label: "DICE.Banes.one",
    name: "DICE.Banes.many",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.Qme1mM71Jn950Zsf"
  },
  check: {
    label: "ACTION.StandardCheck",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.WpBewuNfFJp1ZJRt"
  },
  criticalFailure: {
    label: "ACTION.EFFECT_RESULT_TYPES.CriticalFailure",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.WpBewuNfFJp1ZJRt"
  },
  criticalFailureThreshold: {
    label: "DICE.CriticalFailureThreshold",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.WpBewuNfFJp1ZJRt"
  },
  criticalSuccess: {
    label: "ACTION.EFFECT_RESULT_TYPES.CriticalSuccess",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.WpBewuNfFJp1ZJRt"
  },
  criticalSuccessThreshold: {
    label: "DICE.CriticalSuccessThreshold",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.WpBewuNfFJp1ZJRt"
  },
  failure: {
    label: "ACTION.EFFECT_RESULT_TYPES.Failure",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.WpBewuNfFJp1ZJRt"
  },
  success: {
    label: "ACTION.EFFECT_RESULT_TYPES.Success",
    page: "Compendium.crucible.rules.JournalEntry.KBDiQbnSfnRYG7mi.JournalEntryPage.WpBewuNfFJp1ZJRt"
  }
});
