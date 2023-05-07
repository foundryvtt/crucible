import {SKILLS, SKILL_RANKS} from "../config/skills.js";

/**
 * A JournalEntryPage data model for the Skill page type.
 */
export default class CrucibleSkill extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      skillId: new fields.StringField({required: true, nullable: true, initial: null, choices: SKILLS}),
      overview: new fields.HTMLField(),
      ranks: new fields.SchemaField(Object.values(SKILL_RANKS).reduce((ranks, rank) => {
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
}
