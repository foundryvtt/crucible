import CrucibleTalentNode from "../../config/talent-tree.mjs";
import CrucibleSheetMixin from "./crucible-sheet.mjs";
import ActionConfig from "../config/action.mjs";

/**
 * A sheet application for displaying and configuring Items with the Talent type.
 * @extends ItemSheet
 * @mixes CrucibleSheet
 */
export default class TalentSheet extends CrucibleSheetMixin(ItemSheet) {

  /** @override */
  static documentType = "talent";

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "details"}],
      width: 520
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options = {}) {
    const isEditable = this.isEditable;
    const nodeIds = Array.from(CrucibleTalentNode.nodes.keys());
    nodeIds.sort((a, b) => a.localeCompare(b));
    const source = this.object.toObject();
    return {
      cssClass: isEditable ? "editable" : "locked",
      editable: isEditable,
      item: this.object,
      source: source,
      actions: TalentSheet.prepareActions(this.object.system.actions),
      tags: this.item.getTags(this.object.system.talents),
      actorHookChoices: Object.keys(SYSTEM.ACTOR_HOOKS).reduce((obj, k) => {
        obj[k] = k;
        return obj;
      }, {}),
      showHooks: game.user.isGM,
      actorHooks: this.#prepareActorHooks(),
      nodes: Object.fromEntries(nodeIds.map(id => [id, id])),
      runes: SYSTEM.SPELL.RUNES,
      gestures: SYSTEM.SPELL.GESTURES,
      inflections: SYSTEM.SPELL.INFLECTIONS
    }
  }

  /* -------------------------------------------- */

  static prepareActions(actions) {
    return actions.map(action => ({
      id: action.id,
      name: action.name,
      img: action.img,
      condition: action.condition,
      description: action.description,
      tags: action.getTags(),
      effects: action.effects.map(effect => ({
        name: action.name,
        tags: {
          scope: `Affects ${SYSTEM.ACTION.TARGET_SCOPES.label(effect.scope || action.target.scope)}`,
          duration: effect.duration?.rounds ? `${effect.duration.rounds}R` : "Until Ended"
        }
      }))
    }));
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for defined actor hooks attached to the Talent.
   * @returns {{label: string, hook: string, fn: string}[]}
   */
  #prepareActorHooks() {
    return this.object.system.actorHooks.map(h => {
      const cfg = SYSTEM.ACTOR_HOOKS[h.hook];
      const label = `${h.hook}(actor, ${cfg.argNames.join(", ")})`;
      return {label, ...h};
    });
  }

  /* -------------------------------------------- */

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action]").click(this.#onClickAction.bind(this));
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    if ( "actorHooks" in formData.system ) {
      formData.system.actorHooks = Object.values(formData.system.actorHooks || {});
    }
    return formData;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if ( !this.object.id ) return;
    return this.object.update(formData, {recursive: false, diff: false, noHook: true});
  }

  /* -------------------------------------------- */

  #onClickAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
      case "addHook":
        return this.#onAddHook(event, button);
      case "deleteHook":
        return this.#onDeleteHook(event, button);
      case "actionAdd":
        return this.#onActionAdd(event, button);
      case "actionDelete":
        return this.#onActionDelete(event, button);
      case "actionEdit":
        return this.#onActionEdit(event, button);
    }
  }

  /* -------------------------------------------- */

  /**
   * Add a new hook function to the Talent.
   * @returns {Promise<CrucibleItem|null>}
   */
  #onAddHook(event, button) {
    const hook = button.previousElementSibling.value;
    const fd = this._getSubmitData({});
    fd.system.actorHooks ||= [];
    if ( fd.system.actorHooks.find(h => h.hook === hook ) ) {
      ui.notifications.warn(`${this.object.name} already declares a function for the "${hook}" hook.`);
      return null;
    }
    fd.system.actorHooks.push({hook, fn: "// Hook code here"});
    return this._updateObject(event, fd);
  }

  /* -------------------------------------------- */

  /**
   * Delete a hook function from the Talent.
   * @returns {Promise<CrucibleItem>}
   */
  #onDeleteHook(event, button) {
    const hook = button.closest(".form-group").querySelector(`input[type="hidden"]`).value;
    const fd = this._getSubmitData({});
    fd.system.actorHooks.findSplice(h => h.hook === hook);
    return this._updateObject(event, fd);
  }

  /* -------------------------------------------- */

  /**
   * Add a new Action to the Talent.
   * @param {PointerEvent} event          The initiating click event
   * @param {HTMLAnchorElement} button    The clicked button element
   * @returns {Promise<void>}
   */
  async #onActionAdd(event, button) {
    const fd = this._getSubmitData({});
    const actions = this.object.toObject().system.actions;

    // Create a new Action
    const suffix = actions.length ? actions.length + 1 : "";
    const actionData = {id: game.system.api.methods.generateId(this.object.name)};
    if ( actions.length ) {
      actionData.id += suffix;
      actionData.name = `${this.object.name} ${suffix}`
    }
    const action = new game.system.api.models.CrucibleAction(actionData, {parent: this.object.system});

    // Update the Talent
    actions.push(action.toObject());
    fd.system.actions = actions;
    await this._updateObject(event, fd);

    // Render the action configuration sheet
    await (new ActionConfig(action)).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Delete an Action from the Talent.
   * @param {PointerEvent} event          The initiating click event
   * @param {HTMLAnchorElement} button    The clicked button element
   * @returns {Promise<void>}
   */
  async #onActionDelete(event, button) {
    const actionId = button.closest(".action").dataset.actionId;
    const actions = this.object.toObject().system.actions;
    const action = actions.findSplice(a => a.id === actionId);
    const confirm = await Dialog.confirm({
      title: `
    }Delete Action: ${action.name}`,
      content: `<p>Are you sure you wish to delete the <strong>${action.name}</strong> action from the <strong>${this.object.name}</strong> Talent?</p>`
    });
    if ( confirm ) {
      const fd = this._getSubmitData({});
      fd.system.actions = actions;
      await this._updateObject(event, fd);
    }
  }

  /* -------------------------------------------- */

  /**
   * Edit an Action from the Talent.
   * @param {PointerEvent} event          The initiating click event
   * @param {HTMLAnchorElement} button    The clicked button element
   * @returns {Promise<void>}
   */
  async #onActionEdit(event, button) {
    const actionId = button.closest(".action").dataset.actionId;
    const action = this.object.system.actions.find(a => a.id === actionId);
    await (new ActionConfig(action)).render(true);
  }
}
