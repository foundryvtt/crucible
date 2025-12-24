import CrucibleBaseItemSheet from "./item-base-sheet.mjs";

/**
 * A CrucibleBaseItemSheet subclass used to configure Items of the "schematic" type.
 */
export default class CrucibleSchematicItemSheet extends CrucibleBaseItemSheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    item: {
      type: "schematic",
      includesActions: false,
      includesHooks: false,
      hasAdvancedDescription: true
    },
    position: {
      width: 640
    },
    actions: {
      inputAdd: CrucibleSchematicItemSheet.#onAddInput,
      inputRemove: CrucibleSchematicItemSheet.#onRemoveInput,
      outputAdd: CrucibleSchematicItemSheet.#onAddOutput,
      outputRemove: CrucibleSchematicItemSheet.#onRemoveOutput,
      itemRemove: CrucibleSchematicItemSheet.#onRemoveItem
    }
  };

  static INPUT_PARTIAL = "systems/crucible/templates/sheets/item/schematic-input.hbs";
  static OUTPUT_PARTIAL = "systems/crucible/templates/sheets/item/schematic-output.hbs";

  // Initialize subclass options
  static {
    this._initializeItemSheetClass();
    this.PARTS.components = {
      id: "components",
      template: "systems/crucible/templates/sheets/item/schematic-components.hbs",
      templates: [this.INPUT_PARTIAL, this.OUTPUT_PARTIAL]
    }
    this.TABS.sheet.push({
      id: "components",
      group: "sheet",
      icon: "fa-solid fa-list-ol",
      label: "SCHEMATIC.SHEET.Components"
    });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.inputPartial = this.constructor.INPUT_PARTIAL;
    context.outputPartial = this.constructor.OUTPUT_PARTIAL;
    const {inputs, outputs} = await this.#prepareItems();
    context.inputs = inputs;
    context.outputs = outputs;
    context.inputFields = context.fields.inputs.element.fields;
    context.ingredientFields = context.inputFields.ingredients.element.fields;
    context.outputFields = context.fields.outputs.element.element.fields;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the ingredients and outputs rendered in the schematic sheet.
   * @returns {Promise<{inputs: object[], outputs: object[]}>}
   */
  async #prepareItems() {

    // Preload necessary Item documents
    let {inputs, outputs} = this.document.system;
    const uuids = [
      ...inputs.flatMap(i => i.ingredients.map(g => g.item)),
      ...outputs.flatMap(output => output.map(o => o.item))
    ];
    await this.#preloadItems(uuids);

    // Prepare Inputs
    inputs = foundry.utils.deepClone(inputs);
    const templates = [];
    for ( const [i, input] of inputs.entries() ) {
      input.fieldPath = `system.inputs.${i}`;
      input.ingredients = input.ingredients.map((ingredient, j) => this.#prepareIngredient(ingredient, i, j));
      if ( input.mode === "TEMPLATE" ) {
        for ( const i of input.ingredients ) {
          templates.push({...i, name: `${i.name} + ${this.document.name}`, fieldPath: ""})
        }
      }
    }

    // Prepare Outputs
    outputs = foundry.utils.deepClone(outputs).map((outputGroup, i) => {
      return {
        products: outputGroup.map((output, j) => this.#prepareOutput(output, i, j)),
        template: false,
        editable: this.isEditable
      }
    });

    // Include Templates
    if ( templates.length ) outputs.unshift({
      products: templates,
      template: true,
      editable: false
    })
    return {inputs, outputs};
  }

  /* -------------------------------------------- */

  /**
   * Preload Item documents necessary for rendering.
   * @param {string[]} uuids
   * @returns {Promise<void>}
   */
  async #preloadItems(uuids) {
    const toLoad = {};
    for ( const uuid of uuids ) {
      const parsed = foundry.utils.parseUuid(uuid);
      if ( !(parsed.collection instanceof foundry.documents.collections.CompendiumCollection) ) continue;
      const packId = parsed.collection.collection;
      const pack = game.packs.get(packId)
      if ( pack.has(parsed.id) ) continue;
      toLoad[packId] ||= [];
      toLoad[packId].push(parsed.id);
    }
    await Promise.all(Object.entries(toLoad).map(async ([packId, documentIds]) => {
      const pack = game.packs.get(packId);
      return pack.getDocuments({_id__in: documentIds});
    }));
  }

  /* -------------------------------------------- */

  /**
   * Prepare an input ingredient to be rendered in the schematic input partial.
   */
  #prepareIngredient(ingredient, i, j) {
    const item = fromUuidSync(ingredient.item);
    const tags = item.getTags("short");
    delete tags.uses;
    return {
      fieldPath: `system.inputs.${i}.ingredients.${j}`,
      uuid: ingredient.item,
      name: item.name,
      img: item.img,
      tags,
      quantity: ingredient.quantity,
      quality: ingredient.quality,
      consumed: ingredient.consumed
    };
  }

  /* -------------------------------------------- */

  /**
   * Prepare an output product to be rendered in the schematic output partial.
   */
  #prepareOutput(output, i, j) {
    const item = fromUuidSync(output.item);
    const tags = item.getTags();
    tags.quality = SYSTEM.ITEM.QUALITY_TIERS[this.document.system.quality].label;
    return {
      fieldPath: `system.outputs.${i}.${j}`,
      uuid: output.item,
      name: item.name,
      img: item.img,
      tags,
      quantity: output.quantity
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if ( !this.isEditable ) return;
    const components = this.element.querySelector("section.tab[data-tab=components]");
    components.addEventListener("drop", this.#onDropComponents.bind(this));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _processFormData(event, form, updateData) {
    const submitData = super._processFormData(event, form, updateData);
    submitData.system.inputs = Object.values(submitData.system.inputs || {}).map(input => {
      input.ingredients = Object.values(input.ingredients || {});
      return input;
    });
    submitData.system.outputs = Object.values(submitData.system.outputs || {}).map(o => Object.values(o));
    return submitData;
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle dropping input or output items on the components tab in particular drop zones.
   * @param event
   */
  async #onDropComponents(event) {
    const data = CONFIG.ux.TextEditor.getDragEventData(event);
    const dropZone = event.target.closest(".droppable");
    if ( !dropZone || (data?.type !== "Item") ) return;
    let {field, index} = dropZone.closest("fieldset").dataset;
    index = Number(index);
    const updateData = {system: {}};
    switch ( field ) {
      case "inputs":
        updateData.system.inputs = this.document.system.toObject().inputs;
        updateData.system.inputs[index].ingredients.push({item: data.uuid, quantity: 1});
        break;
      case "outputs":
        updateData.system.outputs = this.document.system.toObject().outputs;
        updateData.system.outputs[index].push({item: data.uuid, quantity: 1});
        break;
    }
    await this.submit({updateData});
  }

  /* -------------------------------------------- */

  /**
   * Handle click actions to add a new input group.
   * @this {CrucibleSchematicItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onAddInput(event, _target) {
    if ( !this.isEditable ) return;
    const inputs = this.document.system.toObject().inputs;
    const inputSchema = this.document.system.schema.fields.inputs.element;
    inputs.push(inputSchema.clean({}));
    await this.submit({updateData: {system: {inputs}}});
  }

  /* -------------------------------------------- */

  /**
   * Handle click actions to remove an input group.
   * @this {CrucibleSchematicItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRemoveInput(event, target) {
    if ( !this.isEditable ) return;
    const idx = Number(target.closest("fieldset").dataset.index);
    const inputs = this.document.system.toObject().inputs;
    inputs.splice(idx, 1);
    await this.submit({updateData: {system: {inputs}}});
  }

  /* -------------------------------------------- */

  /**
   * Handle click actions to add an output group.
   * @this {CrucibleSchematicItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onAddOutput(event, _target) {
    if ( !this.isEditable ) return;
    const outputs = this.document.system.toObject().outputs;
    outputs.push([]);
    await this.submit({updateData: {system: {outputs}}});
  }

  /* -------------------------------------------- */

  /**
   * Handle click actions to remove an output group.
   * @this {CrucibleSchematicItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRemoveOutput(event, target) {
    if ( !this.isEditable ) return;
    const idx = Number(target.closest("fieldset").dataset.index);
    const outputs = this.document.system.toObject().outputs;
    outputs.splice(idx, 1);
    await this.submit({updateData: {system: {outputs}}});
  }

  /* -------------------------------------------- */

  /**
   * Handle click actions to remove a specific ingredient.
   * @this {CrucibleSchematicItemSheet}
   * @type {ApplicationClickAction}
   */
  static async #onRemoveItem(event, target) {
    if ( !this.isEditable ) return;
    const {index, field} = target.closest("fieldset").dataset;
    const i = Number(index);
    const j = Number(target.closest('.line-item').dataset.index);
    const updateData = {system: {}};
    switch ( field ) {
      case "inputs":
        updateData.system.inputs = this.document.system.toObject().inputs;
        updateData.system.inputs[i].ingredients.splice(j, 1);
        break;
      case "outputs":
        updateData.system.outputs = this.document.system.toObject().outputs;
        updateData.system.outputs[i].splice(j, 1);
        break;
    }
    await this.submit({updateData});
  }
}
