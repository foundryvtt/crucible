import ActionUseDialog from "./action-use-dialog.mjs";
import {SYSTEM} from "../const/system.mjs";
const {NumberField, StringField} = foundry.data.fields;

/**
 * @import CrucibleActor from "../documents/actor.mjs";
 * @import CrucibleAction from "../models/action.mjs";
 */

/**
 * Configure and roll an environmental hazard against one or more targets.
 */
export default class HazardDialog extends ActionUseDialog {
  constructor({action, actor, targets, danger, defenseType, damageType, resource, tags, name, roll, ...options}={}) {
    actor ||= new Actor.implementation({name: "Environment", type: "adversary"});
    if ( !action ) {
      action = crucible.api.models.CrucibleAction.createHazard(
        {actor, danger, tags, defenseType, damageType, resource, name});
      action.prepare();
    }
    action.usage.forcedTargets = (targets ?? []).filter(Boolean);
    action.acquireTargets({strict: false});
    roll ||= crucible.api.dice.StandardCheck.fromAction(action);
    super({action, actor, roll, ...options});
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["hazard-dialog"],
    position: {width: "auto"},
    window: {icon: "fa-solid fa-skull-crossbones"},
    actions: {
      hazardConfigToggle: HazardDialog.#onHazardConfigToggle,
      targetsToggle: HazardDialog.#onTargetsToggle,
      targetsClear: HazardDialog.#onTargetsClear,
      targetsParty: HazardDialog.#onTargetsParty,
      targetRemove: HazardDialog.#onTargetRemove
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static TEMPLATE = "systems/crucible/templates/dice/hazard-dialog.hbs";

  /* -------------------------------------------- */

  /**
   * Whether the left configuration tray is open.
   * @type {boolean}
   */
  #configureHazard = true;

  /**
   * Whether the right targets tray is open.
   * @type {boolean}
   */
  #selectTargets = true;

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return _loc("HAZARD.WindowTitle", {name: this.action.name});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      hazardConfig: this.#prepareConfigContext(),
      hazardTargets: this.#prepareTargetsContext(),
      configureHazard: this.#configureHazard,
      selectTargets: this.#selectTargets,
      submitDisabled: !(this.action.usage.forcedTargets?.length),
      submitLabel: _loc("HAZARD.UseHazard"),
      hasDice: true,
      showDetails: true
    });
  }

  /* -------------------------------------------- */

  /**
   * Build the left tray context: configurable hazard fields and tag options sourced from the action.
   * @returns {object}
   */
  #prepareConfigContext() {
    const nameField = new StringField({label: _loc("HAZARD.CONFIG.Name")});
    nameField.name = "name";
    const dangerField = new NumberField({integer: true, min: 0, label: _loc("HAZARD.CONFIG.Danger")});
    dangerField.name = "danger";
    const defenseChoices = Object.fromEntries(Object.values(SYSTEM.DEFENSES).map(d => [d.id, d.label]));
    const defenseField = new StringField({choices: defenseChoices, label: _loc("HAZARD.CONFIG.Defense")});
    defenseField.name = "defenseType";
    const damageChoices = Object.fromEntries(Object.values(SYSTEM.DAMAGE_TYPES).map(d => [d.id, d.label]));
    damageChoices[""] = "";
    const damageField = new StringField({choices: damageChoices, label: _loc("HAZARD.CONFIG.Damage"),
      blank: true, required: false});
    damageField.name = "damageType";
    const tagsField = this.action.schema.fields.tags;
    return {
      nameField, dangerField, defenseField, damageField, tagsField,
      name: this.action.name,
      danger: this.action.usage.danger ?? 0,
      defenseType: this.action.usage.defenseType ?? "physical",
      damageType: this.action.usage.damageType ?? "",
      selectedTags: Array.from(this.action.tags).filter(t => t !== "hazard"),
      tagOptions: this.#prepareTagOptions()
    };
  }

  /* -------------------------------------------- */

  /**
   * Tag options for the SetField multi-select, grouped by category and excluding internal tags.
   * @returns {FormSelectOption[]}
   */
  #prepareTagOptions() {
    const selected = this.action.tags;
    const options = [];
    for ( const t of Object.values(SYSTEM.ACTION.TAGS) ) {
      if ( t.internal ) continue;
      const cat = SYSTEM.ACTION.TAG_CATEGORIES[t.category];
      options.push({value: t.tag, label: t.label, group: cat?.label, selected: selected.has(t.tag)});
    }
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Build the right tray context: list of selected target actors.
   * @returns {{actors: object[]}}
   */
  #prepareTargetsContext() {
    const actors = [];
    for ( const actor of this.action.usage.forcedTargets ?? [] ) {
      if ( !actor ) continue;
      actors.push({
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        tags: actor.getTags?.("short") ?? {}
      });
    }
    return {actors};
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const form = this.element.querySelector("form.window-content");
    form?.classList.toggle("configure-hazard", this.#configureHazard);
    form?.classList.toggle("select-targets", this.#selectTargets);
    const dropZone = this.element.querySelector(".hazard-targets");
    dropZone?.addEventListener("drop", this.#onDropTarget.bind(this));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    if ( !["name", "danger", "defenseType", "damageType", "tags"].includes(event.target.name) ) {
      super._onChangeForm(formConfig, event);
      return;
    }
    this.#rebuildAction(event.target.form);
    this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Replace this.action with a fresh instance reflecting the current form state.
   * Preserves forcedTargets across the rebuild and refreshes the dice pool.
   * @param {HTMLFormElement} form
   */
  #rebuildAction(form) {
    const fd = new foundry.applications.ux.FormDataExtended(form).object;
    const forcedTargets = this.action.usage.forcedTargets ?? [];
    this.action = crucible.api.models.CrucibleAction.createHazard({
      actor: this.actor,
      name: fd.name?.trim() || _loc("HAZARD.Hazard"),
      danger: Number(fd.danger) || 0,
      defenseType: fd.defenseType || undefined,
      damageType: fd.damageType || undefined,
      tags: Array.from(fd.tags ?? []),
      resource: this.action.usage.resource
    });
    this.action.prepare();
    this.action.usage.forcedTargets = forcedTargets;
    this.action.acquireTargets({strict: false});
    this.roll = crucible.api.dice.StandardCheck.fromAction(this.action);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRoll(event, button, dialog) {
    this.#rebuildAction(event.target.form ?? event.target);
    return super._onRoll(event, button, dialog);
  }

  /* -------------------------------------------- */

  /**
   * Accept dropped Actor (or Group) UUIDs onto the targets tray.
   * @param {DragEvent} event
   * @returns {Promise<void>}
   */
  async #onDropTarget(event) {
    const data = CONFIG.ux.TextEditor.getDragEventData(event);
    if ( data.type !== "Actor" ) return;
    const actor = await fromUuid(data.uuid);
    if ( !actor || actor.pack ) return;
    const toAdd = (actor.type === "group") ? actor.system.members.map(m => m.actor) : [actor];
    const current = new Set(this.action.usage.forcedTargets ?? []);
    for ( const a of toAdd ) {
      if ( !a || a.pack ) continue;
      current.add(a);
    }
    this.action.usage.forcedTargets = Array.from(current);
    this.action.acquireTargets({strict: false});
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Toggle the left hazard configuration tray.
   * @this {HazardDialog}
   * @param {Event} _event
   */
  static async #onHazardConfigToggle(_event) {
    this.#configureHazard = !this.#configureHazard;
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Toggle the right targets tray.
   * @this {HazardDialog}
   * @param {Event} _event
   */
  static async #onTargetsToggle(_event) {
    this.#selectTargets = !this.#selectTargets;
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Clear all selected targets.
   * @this {HazardDialog}
   * @param {Event} _event
   */
  static async #onTargetsClear(_event) {
    this.action.usage.forcedTargets = [];
    this.action.acquireTargets({strict: false});
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Add the configured party members to the targets list.
   * @this {HazardDialog}
   * @param {Event} _event
   */
  static async #onTargetsParty(_event) {
    const members = crucible.party?.system.actors;
    if ( !members?.size ) {
      ui.notifications.warn(_loc("WARNING.NoParty"));
      return;
    }
    const current = new Set(this.action.usage.forcedTargets ?? []);
    for ( const a of members ) current.add(a);
    this.action.usage.forcedTargets = Array.from(current);
    this.action.acquireTargets({strict: false});
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */

  /**
   * Remove a single target from the list.
   * @this {HazardDialog}
   * @param {Event} _event
   * @param {HTMLElement} target
   */
  static async #onTargetRemove(_event, target) {
    const actorId = target.closest(".line-item")?.dataset.actorId;
    if ( !actorId ) return;
    this.action.usage.forcedTargets = (this.action.usage.forcedTargets ?? []).filter(a => a.id !== actorId);
    this.action.acquireTargets({strict: false});
    await this.render({window: {title: this.title}});
  }

  /* -------------------------------------------- */
  /*  Factory Methods                             */
  /* -------------------------------------------- */

  /**
   * Open a HazardDialog and, on submission, execute the configured hazard action.
   * @param {object} [options]
   * @param {number} [options.danger]            The hazard's danger level.
   * @param {string} [options.defenseType]       The defense type the hazard targets.
   * @param {string} [options.damageType]        The damage type the hazard inflicts.
   * @param {string} [options.resource]          The resource the hazard damages.
   * @param {string[]} [options.tags]            Pre-selected tag identifiers.
   * @param {string} [options.name]              Custom display name.
   * @param {CrucibleActor[]} [options.targets]  Pre-selected target actors.
   * @returns {Promise<CrucibleAction|null>}
   */
  static async prompt({danger, defenseType, damageType, resource, tags, name, targets}={}) {
    if ( !game.user.isGM ) {
      ui.notifications.warn(_loc("HAZARD.WARNINGS.GMOnly"));
      return null;
    }
    targets ??= HazardDialog.#defaultTargets();
    const action = await super.prompt({danger, defenseType, damageType, resource, tags, name, targets});
    if ( !action ) return null;
    await action.use({dialog: false});
    return action;
  }

  /* -------------------------------------------- */

  /**
   * Default target priority: user targets, then controlled tokens, then party members.
   * @returns {CrucibleActor[]}
   */
  static #defaultTargets() {
    if ( game.user.targets?.size ) {
      return Array.from(game.user.targets).map(t => t.actor).filter(Boolean);
    }
    if ( canvas.ready && canvas.tokens.controlled.length ) {
      return canvas.tokens.controlled.map(t => t.actor).filter(Boolean);
    }
    return crucible.party?.system.members.map(m => m.actor).filter(Boolean) ?? [];
  }
}
