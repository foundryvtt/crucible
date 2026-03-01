import CruciblePhysicalItem from "./item-physical.mjs";
import * as CONSUMABLE from "../const/consumable.mjs";
import CrucibleSpellAction from "./spell-action.mjs";
const {DialogV2} = foundry.applications.api;

/**
 * Data schema, attributes, and methods specific to "consumable" type Items.
 */
export default class CrucibleConsumableItem extends CruciblePhysicalItem {

  /** @override */
  static ITEM_CATEGORIES = CONSUMABLE.CATEGORIES;

  /** @override */
  static DEFAULT_CATEGORY = "flask";

  /** @override */
  static ITEM_PROPERTIES = CONSUMABLE.PROPERTIES;

  /** @override */
  static STATEFUL_TAGS = [...super.STATEFUL_TAGS, "uses"];

  /** @override */
  static LOCALIZATION_PREFIXES = ["ITEM", "CONSUMABLE"];

  /* -------------------------------------------- */
  /*  Data Schema                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    const schema = super.defineSchema();
    delete schema.actorHooks; // Consumables don't provide actor hooks
    delete schema.affixes;    // Consumables cannot have affixes
    const fields = foundry.data.fields;
    return foundry.utils.mergeObject(schema, {
      uses: new fields.SchemaField({
        value: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 1}),
        max: new fields.NumberField({required: true, nullable: false, integer: true, min: 1, initial: 1})
      }),
      scroll: new fields.SchemaField({
        runes: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.RUNES})),
        gestures: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.GESTURES})),
        inflections: new fields.SetField(new fields.StringField({choices: SYSTEM.SPELL.INFLECTIONS}))
      })
    });
  }

  /* -------------------------------------------- */

  /** @override */
  static validateJoint(data) {
    super.validateJoint(data);
    if ( data.category !== "scroll" ) return;
    const budget = SYSTEM.ITEM.ENCHANTMENT_TIERS[data.enchantment]?.bonus ?? 0;
    let components = 0;
    for ( const c in this.schema.fields.scroll.fields ) {
      components += (data.scroll?.[c]?.length || 0);
    }
    if ( components > budget ) {
      throw new Error(game.i18n.format("CONSUMABLE.SCROLL.ComponentBudgetError", {total: components, budget}));
    }
  }

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Is this consumable or consumable stack depleted?
   * @type {boolean}
   */
  get isDepleted() {
    return !this.uses.value || !this.quantity;
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Present a dialog allowing the user to configure a spell scroll's name and spellcraft components.
   * @param {object} [options]          Options that customize how the scroll is configured.
   * @param {boolean} [options.save=false]  Perform an update to the parent Item document? Otherwise, changes are
   *                                        applied in-place via Item#updateSource.
   * @returns {Promise<object|null>}    The document update applied if the dialog was successfully submitted, otherwise
   *                                    null if the configuration was cancelled or invalid.
   */
  async configureScrollDialog({save=false}={}) {
    if ( this.category !== "scroll" ) throw new Error("The CrucibleConsumableItem#configureScrollDialog method may"
      + " only be used for consumables of the `scroll` category.");
    const result = await CrucibleScrollConfigDialog.input({item: this.parent});
    if ( !result ) return null;
    result.name ||= this.parent.name;
    const update = foundry.utils.expandObject(result);
    try {
      if ( save ) await this.parent.update(update);
      else this.parent.updateSource(update);
    } catch(err) {
      ui.notifications.error(err);
      throw err;
    }
    return update;
  }

  /* -------------------------------------------- */

  /**
   * Consume a certain number of uses of the consumable.
   * @param {number} [uses=1]           A number of uses to consume. A negative number will restore uses of the item
   * @returns {Promise<CrucibleItem>}   The updated item
   */
  async consume(uses=1) {
    const {value, max} = this.uses;
    const quantity = this.quantity;
    const currentUses = (max * (quantity - 1)) + value;
    const newUses = Math.max(currentUses - uses, 0);
    const targetQuantity = this.properties.has("stackable") ? Math.ceil(newUses / max) : 1;
    const targetUses = Math.clamp(newUses - (max * (targetQuantity - 1)), 0, max);
    await this.parent.update({system: {quantity: targetQuantity, uses: {value: targetUses}}});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getTags(scope="full") {
    const {category, ...parentTags} = super.getTags(scope);
    const tags = {
      category,
      quality: this.config.quality.label,
      ...parentTags
    };
    if ( this.isDepleted ) tags.uses = game.i18n.localize("ITEM.PROPERTIES.Depleted");
    else {
      const {value, max} = this.uses;
      const plurals = new Intl.PluralRules(game.i18n.lang);
      const usesLabel = `CONSUMABLE.USES.Tag${value === max ? "Max" : "Partial"}.${plurals.select(max)}`;
      tags.uses = game.i18n.format(usesLabel, {value, max});
    }
    return tags;
  }

  /* -------------------------------------------- */

  /**
   * Compute a spell name from the currently selected scroll components.
   * Delegates to CrucibleSpellAction.getComposedName when exactly one rune and one gesture
   * are selected; otherwise falls back to joining the component display names.
   * @param {object} scroll
   * @param {string[]} [scroll.runes=[]]
   * @param {string[]} [scroll.gestures=[]]
   * @param {string[]} [scroll.inflections=[]]
   * @returns {string}
   */
  static getScrollName({runes=[], gestures=[], inflections=[]}={}) {
    runes = runes.map(id => SYSTEM.SPELL.RUNES[id]).filter(Boolean);
    gestures = gestures.map(id => SYSTEM.SPELL.GESTURES[id]).filter(Boolean);
    inflections = inflections.map(id => SYSTEM.SPELL.INFLECTIONS[id]).filter(Boolean);
    const rune = runes[0];
    const gesture = gestures[0];
    const inflection = inflections[0];
    if ( !(rune || gesture || inflection) ) return "";

    // Get scroll name from composed spell name
    let name = "";
    if ( rune && gesture ) name = CrucibleSpellAction.getComposedName({rune, gesture, inflection});

    // Otherwise get scroll name from a formatted list
    else {
      const fmt = new Intl.ListFormat(game.i18n.lang);
      const parts = [...runes.map(r => r.name), ...gestures.map(g => g.name), ...inflections.map(i => i.name)];
      name = fmt.format(parts);
    }

    // Return final scroll name
    return game.i18n.format("CONSUMABLE.SCROLL.ScrollName", {scroll: name});
  }
}

/* -------------------------------------------- */

/**
 * A dialog for configuring a blank spell scroll's name and spellcraft components.
 * Extends DialogV2 so that _renderHTML can be overridden to attach a live form-change
 * listener that updates the name field as the user selects rune/gesture/inflection.
 */
class CrucibleScrollConfigDialog extends DialogV2 {

  /** @inheritDoc */
  _initializeApplicationOptions({item, ...options}={}) {
    options.window ||= {};
    options.window.title = game.i18n.format("CONSUMABLE.SCROLL.ConfigureTitle", {name: item.name});
    options.content = CrucibleScrollConfigDialog.#buildContent(item);
    return super._initializeApplicationOptions(options);
  }

  /* -------------------------------------------- */

  /**
   * Build the inner HTML content string for the dialog.
   * @param {CrucibleItem} item   The scroll item to configure
   * @returns {string}            innerHTML of the content container
   */
  static #buildContent(item) {
    const div = document.createElement("div");

    // Budget hint
    const hint = document.createElement("p");
    hint.className = "hint";
    const budget = item.system.config.enchantment.bonus;
    hint.textContent = game.i18n.format("CONSUMABLE.SCROLL.ComponentBudget", {budget});
    div.append(hint);

    // Name field
    const nameField = item.schema.getField("name");
    div.append(nameField.toFormGroup({}, {placeholder: item.name}));

    // Scroll component set-fields
    const scrollSource = item.system.toObject().scroll;
    for ( const component of ["runes", "gestures", "inflections"] ) {
      const field = item.system.schema.fields.scroll.fields[component];
      div.append(field.toFormGroup({}, {value: scrollSource[component]}));
    }
    return div.innerHTML;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const form = this.element.querySelector("form");
    form.addEventListener("change", this.#onScrollComponentChange.bind(this));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onSubmit(target, event) {
    const form = this.element.querySelector("form");
    const nameInput = form.elements.name
    nameInput.value ||= nameInput.placeholder;
    return super._onSubmit(target, event);
  }

  /* -------------------------------------------- */

  /**
   * React to a change event within the scroll configuration form.
   * When a spell component checkbox changes, recompute and update the name field.
   * @param {Event} event   The originating change event
   */
  #onScrollComponentChange(event) {
    const form = event.target.form;
    const nameInput = form.elements.name;
    if ( event.target === nameInput ) return;
    const formData = foundry.utils.expandObject(new FormDataExtended(form).object);
    nameInput.placeholder = CrucibleConsumableItem.getScrollName(formData.system.scroll);
  }
}
