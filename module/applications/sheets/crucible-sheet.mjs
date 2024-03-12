import ActionConfig from "../config/action.mjs";

/**
 * Add common functionalities to every Crucible Sheet application which alters their visual style.
 * @param {typeof Application} Base     The base Application class being extended
 * @returns {typeof Application}        The extended CrucibleSheet class
 */
export default function CrucibleSheetMixin(Base) {
  return class CrucibleSheet extends Base {

    /**
     * Declare the document type managed by this CrucibleSheet.
     * @type {string}
     */
    static documentType = "";

    /** @inheritDoc */
    static get defaultOptions() {
      return Object.assign(super.defaultOptions, {
        classes: ["crucible", "sheet", this.documentType],
        template: `systems/${SYSTEM.id}/templates/sheets/${this.documentType}.hbs`,
        height: "auto",
        resizable: false,
        closeOnSubmit: true,
        submitOnChange: false,
        submitOnClose: false,
        width: 520
      });
    }

    /** @override */
    get title() {
      const {documentName, type, name} = this.object;
      const typeLabel = game.i18n.localize(CONFIG[documentName].typeLabels[type]);
      return `[${typeLabel}] ${name}`;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _getHeaderButtons() {
      const buttons = super._getHeaderButtons();
      for ( const button of buttons ) {
        button.tooltip = button.label;
        button.label = "";
      }
      return buttons;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _renderOuter() {
      const html = await super._renderOuter();
      const overlaySrc = "systems/crucible/ui/journal/overlay.png"; // TODO convert
      const overlay = `<img class="background-overlay" src="${overlaySrc}">`
      html.prepend(overlay);
      return html;
    }

    /* -------------------------------------------- */
    /*  Event Handling                              */
    /* -------------------------------------------- */

    /** @inheritDoc */
    activateListeners(html) {
      super.activateListeners(html);
      html.on("click", "[data-action]", this.#onClickAction.bind(this));
    }

    /* -------------------------------------------- */

    /**
     * Handle clicks on action button elements.
     * @param {PointerEvent} event        The initiating click event
     * @returns {Promise<void>}
     */
    async #onClickAction(event) {
      event.preventDefault();
      const button = event.currentTarget;
      const action = button.dataset.action;

      // Managed Actions
      switch (action) {
        case "actionAdd":
          await this.#onActionAdd(event, button);
          return;
        case "actionDelete":
          await this.#onActionDelete(event, button);
          return;
        case "actionEdit":
          await this.#onActionEdit(event, button);
          return;
      }

      // Subclass Actions
      return this._handleAction(action, event, button);
    }

    /* -------------------------------------------- */

    /**
     * Handle click events on buttons annotated with [data-action].
     * @param {string} action         The action being performed
     * @param {Event} event           The initiating event
     * @param {HTMLElement} button    The element that was engaged with
     * @returns {Promise<void>}
     * @protected
     */
    async _handleAction(action, event, button) {}

    /* -------------------------------------------- */
    /*  Action Management                           */
    /* -------------------------------------------- */

    /**
     * Prepare an array of actions for sheet rendering.
     * @param {CrucibleAction[]} actions    The actions being rendered
     * @returns {object[]}                  An object of data suitable for sheet rendering
     */
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
}
