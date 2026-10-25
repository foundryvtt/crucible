/**
 * The system data of a group rest ChatMessage, which stages a pending rest until a Gamemaster confirms it.
 */
export default class CrucibleRestMessage extends foundry.abstract.TypeDataModel {

  /**
   * The lifecycle states of a group rest.
   * @type {Readonly<Record<string, {label: string, icon: string}>>}
   */
  static STATUSES = Object.freeze({
    pending: {label: "ACTOR.GROUP.REST.STATUSES.Pending", icon: "fa-solid fa-hexagon-exclamation"},
    complete: {label: "ACTOR.GROUP.REST.STATUSES.Complete", icon: "fa-solid fa-hexagon-check"},
    interrupted: {label: "ACTOR.GROUP.REST.STATUSES.Interrupted", icon: "fa-solid fa-hexagon-xmark"},
    cancelled: {label: "ACTOR.GROUP.REST.STATUSES.Cancelled", icon: "fa-solid fa-hexagon-minus"}
  });

  /**
   * The Handlebars template which renders the rest card content.
   * @type {string}
   */
  static TEMPLATE = "systems/crucible/templates/chat/rest-card.hbs";

  /* -------------------------------------------- */

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      group: new fields.DocumentUUIDField({type: "Actor", nullable: false}),
      participants: new fields.ArrayField(new fields.SchemaField({
        actor: new fields.DocumentUUIDField({type: "Actor", nullable: false}),
        actions: new fields.ArrayField(new fields.ObjectField())
      })),
      duration: new fields.NumberField({required: true, nullable: false, positive: true}),
      allowInterruption: new fields.BooleanField({initial: true}),
      allowRestActions: new fields.BooleanField({initial: true}),
      status: new fields.StringField({required: true, choices: this.STATUSES, initial: "pending"})
    };
  }

  /* -------------------------------------------- */
  /*  Rest Workflow                               */
  /* -------------------------------------------- */

  /**
   * Confirm a pending rest, resolving interruption before the participants rest and time advances.
   * @fires {preGroupRest}
   * @fires {groupRest}
   * @returns {Promise<void>}
   */
  async confirm() {
    if ( !game.user.isGM || (this.status !== "pending") ) return;
    const group = fromUuidSync(this.group);
    if ( !group ) return;
    const participants = this.participants.map(p => fromUuidSync(p.actor)).filter(a => a);
    const prior = group.getFlag("crucible", "rest") ?? null;
    const restConfig = {
      duration: this.duration,
      allowInterruption: this.allowInterruption,
      promises: [],
      prior,
      interrupted: null
    };

    // Allow modules to modify, interrupt, or prevent the rest
    const cancelled = Hooks.call("crucible.preGroupRest", group.system, restConfig) === false;
    if ( cancelled && restConfig.allowInterruption ) return this.#setStatus("cancelled");
    try {
      await Promise.all(restConfig.promises);
    } catch(err) {
      if ( !restConfig.allowInterruption ) {
        console.warn(`Group rest hook throw an Error, but this Rest cannot be interrupted: ${err.message}`);
      }
      else if ( restConfig.interrupted ) {
        await this.#recordInterruption(group, prior, restConfig.interrupted);
        return this.#setStatus("interrupted");
      }
      else {
        console.warn(`Group rest cancelled: ${err.message}`);
        return this.#setStatus("cancelled");
      }
    }

    // Successful completion - clear continuation state, then participants rest while time advances
    if ( prior ) await group.unsetFlag("crucible", "rest");
    const [results] = await Promise.all([
      Promise.allSettled(participants.map(actor => this.#restParticipant(actor))),
      game.time.advance(restConfig.duration)
    ]);
    for ( const {status, reason} of results ) {
      if ( status === "rejected" ) console.error(reason);
    }
    const participantData = participants.map((actor, i) => ({actor: actor.uuid, actions: results[i].value ?? []}));
    await this.parent.update({system: {status: "complete", participants: participantData}});

    // Announce completion only once time has advanced, so listeners which timestamp the rest record its end
    Hooks.callAll("crucible.groupRest", group.system, restConfig, participants);
  }

  /* -------------------------------------------- */

  /**
   * Reconstitute the last action a participant performed during this completed rest.
   * @param {CrucibleActor} actor
   * @returns {CrucibleAction|null}
   */
  getAction(actor) {
    const data = this.participants.find(p => p.actor === actor.uuid)?.actions.at(-1);
    return data ? crucible.api.models.CrucibleAction.fromData(data, this.parent) : null;
  }

  /* -------------------------------------------- */

  /**
   * Persist continuation state after a rest is interrupted, folding listener-supplied extras into the flag.
   * @param {CrucibleActor} group                                         The resting group.
   * @param {{hoursCompleted: number, hoursRequired: number}|null} prior   Prior continuation state.
   * @param {{hoursElapsed: number}} interrupted                           Listener-supplied interruption descriptor.
   * @returns {Promise<void>}
   */
  async #recordInterruption(group, prior, interrupted) {
    const baseHours = SYSTEM.TIME.restSeconds / 3600;
    const {hoursElapsed, ...extras} = interrupted;
    const flag = {
      hoursCompleted: (prior?.hoursCompleted ?? 0) + hoursElapsed,
      hoursRequired: prior?.hoursRequired ?? baseHours,
      ...extras
    };
    await group.setFlag("crucible", "rest", _replace(flag));
    await game.time.advance(hoursElapsed * 3600);
    ui.notifications.warn(_loc("ACTOR.GROUP.REST.Interrupted", {hours: hoursElapsed}));
  }

  /* -------------------------------------------- */

  /**
   * Perform and confirm a participant's Rest action, recorded within this message.
   * @param {CrucibleActor} actor
   * @returns {Promise<object[]>}   Serialized usage data of the performed actions
   */
  async #restParticipant(actor) {
    const action = await actor.useAction("rest", {dialog: false, message: this.parent});
    if ( !action ) return [];
    const {data} = action.serializeUsage();
    await action.confirm();
    return [data];
  }

  /* -------------------------------------------- */

  /**
   * Record the outcome of the rest on its message.
   * @param {string} status
   * @returns {Promise<void>}
   */
  async #setStatus(status) {
    await this.parent.update({"system.status": status});
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Attach Gamemaster controls to the rendered rest card.
   * @param {HTMLElement} html
   */
  activateListeners(html) {
    if ( !game.user.isGM || (this.status !== "pending") ) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "confirm frame-brown";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-campground";
    button.append(icon, _loc("ACTOR.GROUP.REST.ConfirmRest"));
    button.addEventListener("click", () => {
      button.disabled = true;
      icon.className = "fa-solid fa-spinner fa-spin";
      this.confirm();
    });
    html.append(button);
  }

  /* -------------------------------------------- */

  /**
   * Render the HTML content of the rest card.
   * @returns {Promise<string>}
   */
  async renderCard() {
    const status = this.constructor.STATUSES[this.status];
    const participants = [];
    for ( const {actor: uuid, actions} of this.participants ) {
      const actor = fromUuidSync(uuid);
      if ( actor ) participants.push({name: actor.name, img: actor.img, ...this.#prepareSummary(uuid, actions)});
    }
    return foundry.applications.handlebars.renderTemplate(this.constructor.TEMPLATE, {
      complete: this.status === "complete",
      noChanges: _loc("ACTOR.GROUP.REST.NoChanges"),
      status: this.status,
      statusLabel: _loc(status.label),
      statusIcon: status.icon,
      title: _loc("ACTOR.GROUP.REST.CardTitle", {name: fromUuidSync(this.group)?.name, hours: this.duration / 3600}),
      participants
    });
  }

  /* -------------------------------------------- */

  /**
   * Summarize the net reserve resource changes a participant received from their recorded actions.
   * @param {string} uuid           The participant actor UUID
   * @param {object[]} actions      Serialized usage data of the participant's actions
   * @returns {{resources: object[], pipColors: Set<string>}}
   */
  #prepareSummary(uuid, actions) {
    const deltas = {};
    for ( const event of actions.flatMap(a => a.events) ) {
      if ( (event.target !== uuid) || event.negated ) continue;
      for ( const {resource, delta} of event.resources ) deltas[resource] = (deltas[resource] ?? 0) + delta;
    }
    const resources = [];
    const pipColors = new Set();
    for ( const [resource, delta] of Object.entries(deltas) ) {
      const cfg = SYSTEM.RESOURCES[resource];
      if ( (cfg?.type !== "reserve") || !delta ) continue; // Pools which always refill to maximum are not reported
      let color = cfg.color;
      if ( foundry.utils.isPlainObject(color) ) {
        pipColors.add(color.high.css);
        color = ((delta > 0) === (cfg.type === "active")) ? color.heal : color.high;
      }
      else pipColors.add(color.css);
      resources.push({label: cfg.label, amount: delta.signedString(), colorStyle: color.toRGBA(0.25)});
    }
    return {resources, pipColors};
  }

  /* -------------------------------------------- */
  /*  Factories                                   */
  /* -------------------------------------------- */

  /**
   * Create a pending rest ChatMessage for a group.
   * @param {CrucibleActor} group                      The resting group.
   * @param {object} config
   * @param {Iterable<CrucibleActor>} config.participants   The members who rest.
   * @param {number} config.duration                        Rest duration in seconds.
   * @param {boolean} config.allowInterruption              Whether the rest may be interrupted.
   * @param {boolean} config.allowRestActions               Whether participants may designate rest actions.
   * @returns {Promise<CrucibleChatMessage>}
   */
  static async createMessage(group, {participants, duration, allowInterruption, allowRestActions}) {
    const cls = ChatMessage.implementation;
    return cls.create({
      type: "rest",
      speaker: cls.getSpeaker({actor: group}),
      system: {
        group: group.uuid,
        participants: Array.from(participants, a => ({actor: a.uuid})),
        duration,
        allowInterruption,
        allowRestActions
      }
    });
  }
}
