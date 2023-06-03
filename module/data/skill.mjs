import * as SKILL from "../config/skills.mjs";

/**
 * A JournalEntryPage data model for the Skill page type.
 */
export default class CrucibleSkill extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      skillId: new fields.StringField({required: true, nullable: true, initial: null, choices: SKILL.SKILLS}),
      overview: new fields.HTMLField(),
      ranks: new fields.SchemaField(Object.values(SKILL.RANKS).reduce((ranks, rank) => {
        ranks[rank.id] = new fields.SchemaField({
          description: new fields.HTMLField()
        });
        return ranks;
      }, {})),
      paths: new fields.SchemaField(Array.fromRange(3, 1).reduce((paths, i) => {
        paths[`path${i}`] = new fields.SchemaField({
          id: new fields.StringField(),
          name: new fields.StringField(),
          overview: new fields.HTMLField(),
          ranks: new fields.SchemaField(["specialist", "master"].reduce((ranks, rank) => {
            ranks[rank] = new fields.SchemaField({
              description: new fields.HTMLField()
            });
            return ranks;
          }, {}))
        });
        return paths;
      }, {}))
    };
  }

  /**
   * Initialize skill configuration for the game system using defined skill data from the SKILL.JOURNAL_ID entry.
   * @returns {Promise<void>}
   */
  static async initialize() {
    const entry = await fromUuid(SKILL.JOURNAL_ID);
    game.i18n.translations.SKILLS ||= {};
    for ( const page of entry.pages ) {
      if ( page.type !== "skill" ) continue;
      const {skillId, overview, paths, ranks} = page.system;
      const skill = SKILL.SKILLS[skillId];
      if ( !skill ) {
        console.error(`JournalEntryPage skill configuration "${page.id}" does not configure a valid Skill ID.`);
        continue;
      }
      Object.assign(skill, {overview, paths, ranks, name: page.name, page: page.uuid});
      game.i18n.translations.SKILLS[skillId.titleCase()] = page.name; // TODO remove workaround
    }

    // Iterate over all skills making sure that none are undefined
    for ( const skill of Object.values(SKILL.SKILLS) ) {
      foundry.utils.mergeObject(skill, {
        icon: `systems/crucible/icons/skills/${skill.id}.jpg`,
        overview: "Missing skill overview.",
        ranks: Object.values(SKILL.RANKS).reduce((ranks, rank) => {
          ranks[rank.id] = {description: `Missing rank ${rank.rank} description.`}
          return ranks;
        }, {}),
        paths: Array.fromRange(3, 1).reduce((paths, i) => {
          paths[`path${i}`] = {
            id: `path${i}`,
            name: `Specialization ${i}`,
            overview: "Missing specialization overview.",
            ranks: ["specialist", "master"].reduce((ranks, rank) => {
              ranks[rank] = {description: "Missing rank description"};
              return ranks;
            }, {})
          };
          return paths;
        }, {})
      }, {inplace: true, overwrite: false});
    }
  }
}