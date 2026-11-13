import CrucibleWall from "../../documents/wall.mjs";

export default class CrucibleWallConfig extends foundry.applications.sheets.WallConfig {

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    if ( event.target.name === "door" ) {
      const isDoor = Number(event.target.value) > CONST.WALL_DOOR_TYPES.NONE;
      const crucibleDoorFieldset = this.element.querySelector(".crucible-door-config");
      crucibleDoorFieldset.disabled = !isDoor;
      crucibleDoorFieldset.hidden = !isDoor;
    }
    super._onChangeForm(formConfig, event);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const doorFieldset = this.element.querySelector("fieldset:has(>.door-sound)");
    if ( !doorFieldset ) return;
    const fieldset = document.createElement("fieldset");
    fieldset.className = "crucible-door-config";
    const legend = document.createElement("legend");
    legend.textContent = _loc("WALL.BashPickLegend");
    fieldset.append(legend);
    const schema = CrucibleWall.doorSchema;
    for ( const [name, field] of Object.entries(schema.fields) ) {
      const value = this.document._source.flags.crucible?.[name] ?? field.initial;
      fieldset.append(field.toFormGroup({}, {name: `flags.crucible.${name}`, value}));
    }
    fieldset.disabled = fieldset.hidden = !this.document.isDoor;
    doorFieldset.insertAdjacentElement("beforeend", fieldset);
  }
}
