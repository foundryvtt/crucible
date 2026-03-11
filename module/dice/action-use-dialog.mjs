import StandardCheckDialog from "./standard-check-dialog.mjs";

/**
 * Prompt the user to activate an action which may involve the rolling of a standard dice pool.
 * @extends {StandardCheckDialog}
 */
export default class ActionUseDialog extends StandardCheckDialog {
  constructor({action, actor, targets, ...options}) {
    super(options);
    this.action = action;
    this.actor = actor;
    this.targets = targets;
    this.#weaponChoice = action.usage.weapon?.id || "";
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["action-roll"],
    position: {
      width: 400
    },
    window: {
      minimizable: true
    },
    actions: {
      placeRegion: ActionUseDialog.#onPlaceRegion,
      planMovement: ActionUseDialog.#onPlanMovement
    }
  };

  /** @override */
  static TEMPLATE = "systems/crucible/templates/dice/action-use-dialog.hbs";

  /**
   * A registry of ActionUseDialog instances that are currently in a movement planning state.
   * @type {Map<string, ActionUseDialog>}
   */
  static #movementPlans = new Map();

  /* -------------------------------------------- */

  /**
   * Targets acquired from the most recently placed region for this Action.
   * @type {ActionUseTarget[]|null}
   */
  #regionTargets = null;

  /**
   * The Hooks ID for a pending planToken listener registered during movement planning.
   * Stored so it can be cleaned up if the dialog closes before planning completes.
   * @type {number|null}
   */
  #planMovementHookId = null;

  /**
   * Tracks whether the dialog was submitted successfully via _onRoll.
   * Used by #clearMovementPlan to avoid cancelling planned movement on a successful submission,
   * since _onClose fires for both cancellation and submission.
   * @type {boolean}
   */
  #submitted = false;

  /**
   * The Action being performed
   * @type {CrucibleAction}
   */
  action;

  /**
   * The Actor performing the action.
   * @type {CrucibleActor}
   */
  actor;

  /**
   * The Tokens which are targeted by the action.
   * @type {CrucibleToken[]}
   */
  targets;

  /**
   * The current weapon choice made by the user
   * @type {string}
   */
  #weaponChoice;

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[${this.actor.name}] ${this.action.name}`;
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const tags = this._getTags();
    const targets = this.#prepareTargets();
    const requiresRegion = this.action.requiresRegion;
    const requiresMovement = this.action.requiresMovement;
    let submitTooltip = [
      requiresRegion ? _loc("ACTION.RequiresRegion") : "",
      requiresMovement ? _loc("ACTION.RequiresMovement") : ""
    ].filterJoin("</p><p>");
    if ( submitTooltip ) submitTooltip = `<p>${submitTooltip}</p>`;
    const involvesRegion = requiresRegion || this.action.region;
    const involvesMovement = requiresMovement || this.action.movement;
    return foundry.utils.mergeObject(context, {
      action: this.action,
      actor: this.actor,
      tags,
      hasActionTags: !tags.action.empty,
      hasContextTags: !tags.context.empty,
      hasTargetTags: !["self", "none"].includes(this.action.target.type) || involvesRegion || involvesMovement,
      hasDice: this.action.usage.hasDice ?? false,
      involvesRegion,
      involvesMovement,
      requiresRegion,
      requiresMovement,
      tagRegion: this.action.region && !targets.length,
      tagMovement: this.action.movement,
      targets,
      submitDisabled: requiresRegion || requiresMovement,
      submitLabel: _loc("ACTION.UseAction"),
      submitTooltip,
      weaponChoice: this.#prepareWeaponChoice()
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare the field and value for choosing which weapon to use if the action supports weapon choice.
   * @returns {{field: StringField, value: string}|null}
   */
  #prepareWeaponChoice() {
    if ( !this.action.allowWeaponChoice ) return null;
    const baseActionCost = this.action.cost.action - (this.action.usage.weapon?.system.actionCost ?? 0);
    const maxCost = this.actor.resources.action.value - baseActionCost;
    const choices = this.action.getValidWeaponChoices({strict: true, maxCost});
    if ( choices.length <= 1 ) return null;
    const weapon = new foundry.data.fields.StringField({blank: true, required: true, choices,
      label: "Weapon", hint: "You may choose which weapon to use for this Action."});
    weapon.name = "weapon";
    return {field: weapon, value: this.#weaponChoice};
  }

  /* -------------------------------------------- */

  /**
   * Prepare the list of targets for rendering in the action use dialog.
   * @returns {ActionUseTarget[]}
   */
  #prepareTargets() {
    if ( this.action.usage.summons?.length ) {
      return this.action.usage.summons.map(({actorUuid}) => ({
        uuid: actorUuid,
        name: fromUuidSync(actorUuid)?.name ?? "Unknown" // Shouldn't be possible, but just in case
      }));
    }
    const targets = this.#regionTargets ?? this.action.acquireTargets({strict: false});
    for ( const t of targets ) {
      t.cssClass = t.error ? "unmet" : "";
      t.tooltip = t.error ?? null;
      t.hidden = t.token?.isVisible === false;
    }
    return targets;
  }

  /* -------------------------------------------- */

  /**
   * Get the tags that apply to this dialog.
   * @returns {ActionTags}
   * @protected
   */
  _getTags() {
    return this.action.getTags();
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    if ( event.target.name === "weapon" ) {
      const weapons = this.action.actor.equipment.weapons;
      const c = this.#weaponChoice = event.target.value;
      let weapon;
      if ( c === "mainhandUnarmed" ) weapon = weapons.mainhand;
      else if ( c === "offhandUnarmed" ) weapon = weapons.offhand;
      else weapon = this.action.actor.items.get(c);
      this.action.usage.weapon = weapon;
      this.action.reset();
      this.roll = crucible.api.dice.StandardCheck.fromAction(this.action);
      this.render();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onSubmit(target, event) {
    if ( this.action.requiresRegion || this.action.requiresMovement ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    await super._onSubmit(target, event);
  }

  /* -------------------------------------------- */

  /**
   * Resolve dialog submission to enact a Roll.
   * @param {Event} _event
   * @param {HTMLButtonElement} _button
   * @param {Dialog} _dialog
   * @returns {StandardCheck}
   * @protected
   */
  _onRoll(_event, _button, _dialog) {
    this.#submitted = true;
    this.action.usage.messageMode = this.messageMode;
    if ( "special" in this.roll.data.boons ) this.action.usage.boons.special = this.roll.data.boons.special;
    if ( "special" in this.roll.data.banes ) this.action.usage.banes.special = this.roll.data.banes.special;
    return this.action;
  }

  /* -------------------------------------------- */
  /*  Target Management                           */
  /* -------------------------------------------- */

  /**
   * Respond when the set of User Targets changes by re-rendering currently visible action use apps.
   */
  static debounceChangeTarget = foundry.utils.debounce(() => {
    for ( const app of foundry.applications.instances.values() ) {
      if ( app instanceof ActionUseDialog ) app.render();
    }
  }, 20);

  /* -------------------------------------------- */
  /*  Region Management                           */
  /* -------------------------------------------- */

  /**
   * Handle left-click events to begin the region targeting workflow.
   * @this {ActionUseDialog}
   * @param {Event} event
   * @returns {Promise<void>}
   */
  static async #onPlaceRegion(event) {
    const {range, token, target} = this.action;
    const targetConfig = SYSTEM.ACTION.TARGET_TYPES[target.type];
    if ( !targetConfig.region ) return;
    const regionConfig = targetConfig?.region;

    // Resolve the size of the first summon if applicable
    if ( (target.type === "summon") && this.action.usage.summons.length ) {
      const summon1 = await fromUuid(this.action.usage.summons[0].actorUuid);
      if ( summon1 ) target.size = summon1.size;
    }

    // Build initial region document data
    const origin = token?.getCenterPoint(token._source) ?? canvas.dimensions.rect.center;
    const regionData = this.#getRegionData(origin, token, range, target, targetConfig);

    // Minimize open windows
    const minimizedWindows = [];
    for ( const app of foundry.applications.instances.values() ) {
      if ( !app.minimized ) minimizedWindows.push(app);
    }
    await Promise.allSettled(minimizedWindows.map(app => app.minimize()));

    // Build the onMove callback
    const onMove = ({shape, position, snap}) => {
      switch (regionConfig.anchor) {
        case "self": // Lock position and rotate based on mouse position
          if ( regionConfig.directionDelta ) {
            const rawAngle = Math.toDegrees(Math.atan2(position.y - origin.y, position.x - origin.x));
            const snappedAngle = rawAngle.toNearest(regionConfig.directionDelta);
            shape.updateSource({rotation: snappedAngle});
          }
          break;
        case "vertex": // Constrain placement within maximum range
          const maxDistance = range.maximum ?? 0;
          if ( maxDistance === 0 ) Object.assign(position, origin);
          else {
            const d = canvas.grid.measurePath([origin, position]).distance;
            if ( d > maxDistance ) {
              const rawAngle = Math.toDegrees(Math.atan2(position.y - origin.y, position.x - origin.x));
              position = canvas.grid.getTranslatedPoint(origin, rawAngle, maxDistance);
            }
            shape.move(position, {snap: true});
          }
          break;
      }
      return false;
    };

    // Place the region and record its created data
    const canvasLayer = canvas.activeLayer;
    const region = await canvas.regions.placeRegion(regionData, {create: false, onMove});
    canvasLayer.activate();
    await Promise.allSettled(minimizedWindows.map(app => app.maximize()));
    if ( !region ) return; // User cancelled with right-click

    // Enable wall restriction before acquiring targets so wall geometry is respected
    region.updateSource({restriction: {enabled: true, type: "move"}});
    region.updateSource({_shapeConstraints: region._computeShapeConstraints()});
    Object.defineProperty(this.action, "region", {value: region, configurable: true});

    // Store shape data on the action and acquire targets
    const targets = this.#regionTargets = this.action.acquireTargets({strict: false});
    if ( targets.length ) canvas.tokens.setTargets(targets.map(t => t.token.id));
    else game.user.targets.clear();
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Build the initial RegionDocument data for a placement workflow.
   * @param {Point} origin                     The origin point in canvas pixels
   * @param {CrucibleToken} token              The token performing the action
   * @param {ActionRange} range                The action's range configuration
   * @param {ActionTarget} target              The action's target configuration
   * @param {ActionTargetType} targetConfig    The region config for this target type
   * @returns {Partial<RegionData>}            RegionDocument data with a single shape
   */
  #getRegionData(origin, token, range, target, targetConfig) {
    const regionConfig = targetConfig.region;
    const d = canvas.dimensions.distancePixels;

    // Determine relevant ranges
    const maxRange = range.maximum ?? 0;
    const baseRange = target.size ? target.size : maxRange;
    const addRange = regionConfig.addSize ? (this.actor.size / 2) : 0;

    // Get token data
    const levels = token?.level ? [token.level] : [];
    const tokenElevation = token?._source.elevation ?? 0;
    const tokenDepth = token?._source.depth ?? 0;
    const elevation = {bottom: tokenElevation, top: tokenElevation + tokenDepth};

    // Common configurations based on the shape
    let shape;
    switch ( regionConfig.shape ) {
      case "circle":
        shape = {
          type: "circle",
          x: origin.x,
          y: origin.y,
          radius: (baseRange + addRange) * d
        };
        elevation.bottom -= baseRange;
        elevation.top += baseRange;
        break;
      case "cone":
        shape = {
          type: "cone",
          x: origin.x,
          y: origin.y,
          radius: (baseRange + addRange) * d,
          angle: regionConfig.angle ?? 60,
          rotation: 0,
          curvature: (regionConfig.angle ?? 60) <= 90 ? "flat" : "round"
        };
        break;
      case "line":
        shape = {
          type: "line",
          x: origin.x,
          y: origin.y,
          length: (maxRange + addRange) * d,
          width: (regionConfig.width ?? 1) * d,
          rotation: 0
        };
        break;
      case "rectangle":
        const size = regionConfig.width ?? 1;
        shape = {
          type: "rectangle",
          x: origin.x,
          y: origin.y,
          width: size * d,
          height: maxRange * d,
          anchorX: 0.5,
          anchorY: 0.5,
          rotation: 0
        };
        elevation.top = elevation.bottom + size;
        break;
      default:
        throw new Error(`Unsupported region shape "${regionConfig.shape}" for action ${this.action.id}`);
    }

    // Custom configurations based on the target type
    switch ( target.type ) {
      case "summon":
        const size = (target.size ?? regionConfig.size ?? 1);
        shape.height = shape.width = size * d;
        shape.anchorX = shape.anchorY = 0;
        elevation.top = elevation.bottom + size;
        break;
      case "wall":
        elevation.top = elevation.bottom = null; // Span the full level
        break;
    }

    // Return the RegionData
    return {
      name: this.action.name,
      color: game.user.color,
      displayMeasurements: true,
      restriction: {enabled: false, type: "move"},
      elevation,
      levels,
      shapes: [shape]
    };
  }

  /* -------------------------------------------- */

  /**
   * Expose an internal method that subclasses can use to clear a target region.
   * @internal
   */
  _clearTargetRegion() {
    this.#regionTargets = null;
    Object.defineProperty(this.action, "region", {value: null, configurable: true});
    game.user.targets.clear();
  }

  /* -------------------------------------------- */
  /*  Movement Planning                           */
  /* -------------------------------------------- */

  /**
   * Is any movement planning workflow currently active?
   * @type {boolean}
   */
  static get activeMovementPlan() {
    return ActionUseDialog.#movementPlans.size > 0;
  }

  /* -------------------------------------------- */

  /**
   * Get the active movement planning dialog for the given token, if any.
   * @param {CrucibleToken|string} token    The token document or its ID
   * @returns {ActionUseDialog|null}
   */
  static getActiveMovementPlan(token) {
    const id = typeof token === "string" ? token : token.id;
    return ActionUseDialog.#movementPlans.get(id) ?? null;
  }

  /* -------------------------------------------- */

  /**
   * Handle left-click events to begin the movement planning workflow.
   * @this {ActionUseDialog}
   * @param {PointerEvent} _event
   * @returns {Promise<void>}
   */
  static async #onPlanMovement(_event) {
    const {token} = this.action;

    // Register this dialog as actively planning movement for this token
    ActionUseDialog.#movementPlans.set(token.id, this);

    // Minimize open windows
    const minimizedWindows = [];
    for ( const app of foundry.applications.instances.values() ) {
      if ( !app.minimized ) minimizedWindows.push(app);
    }
    await Promise.allSettled(minimizedWindows.map(app => app.minimize()));

    // Await the planToken hook for this specific token
    await new Promise(resolve => {
      this.#planMovementHookId = Hooks.on("planToken", document => {
        if ( document !== token ) return;
        Hooks.off("planToken", this.#planMovementHookId);
        this.#planMovementHookId = null;
        resolve();
      });
    });

    // Deregister from the planning map
    ActionUseDialog.#movementPlans.delete(token.id);

    // Store the planned movement on the action
    const movement = token.movement;
    if ( movement?.state === "planned" ) {
      Object.defineProperty(this.action, "movement", {value: movement, configurable: true});
      this.action.prepare(); // Re-prepare to update action cost based on the planned distance
      this.roll = crucible.api.dice.StandardCheck.fromAction(this.action);
    }

    // Acquire targets from the planned movement path and highlight on canvas
    const targets = this.action.acquireTargets({strict: false});
    if ( targets.length ) canvas.tokens.setTargets(targets.map(t => t.token?.id).filter(Boolean));
    else game.user.targets.clear();

    // Restore minimized windows and re-render
    await Promise.allSettled(minimizedWindows.map(app => app.maximize()));
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Clear any in-progress movement plan, cancelling a planned token movement if one exists.
   */
  #clearMovementPlan() {
    if ( this.#planMovementHookId !== null ) {
      Hooks.off("planToken", this.#planMovementHookId);
      this.#planMovementHookId = null;
    }
    ActionUseDialog.#movementPlans.delete(this.action.token?.id);
    if ( !this.#submitted && (this.action.movement?.state === "planned") ) {
      this.action.token.stopMovement();
      Object.defineProperty(this.action, "movement", {value: null, configurable: true});
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options) {
    this.#clearMovementPlan();
    super._onClose(options);
  }
}
