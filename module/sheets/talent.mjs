import { SYSTEM } from "../config/system.js";

/**
 * A sheet application for displaying Ancestry items
 * @extends {TalentSheet}
 */
export default class TalentSheet extends ItemSheet {

  /** @inheritdoc */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      width: 480,
      height: "auto",
      classes: [SYSTEM.id, "sheet", "item", "talent"],
      template: `systems/${SYSTEM.id}/templates/sheets/talent.html`,
      resizable: false,
      submitOnChange: false,
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[Talent] ${this.item.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData(options={}) {
    const context = super.getData(options);
    context.tags = this.item.getTags();
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {
    event.preventDefault();
    return this.object.update(formData);
  }
}

// Talent Creation
// await Item.create({
//   "name": "Flurry",
//   "img": "icons/skills/melee/blade-tips-triple steel.webp",
//   "type": "talent",
//   "folder": game.folders.getName("Talents").id,
//   "data.tier": 1,
//   "data.cost": 3,
//   "data.description": "A martial technique which involves using two weapons to overwhelm a single target with a relentless sequence of attacks",
//   "data.actions": [CONFIG.SYSTEM.TALENT.DEFAULT_ACTIONS[3]],
//   "data.requirements": {"attributes.dexterity.value": 5}
// });
