const TALENT_HOOKS = {};

/* -------------------------------------------- */

TALENT_HOOKS.bloodmagic000000 = {
  prepareAction(actor, action) {
    if ( !action.tags.has("spell") ) return;
    action.cost.health = action.cost.focus * 10;
    action.cost.focus = 0;
  },
  confirmActionOutcome(actor, action, outcome, _options) {
    if ( action.target !== this ) return;
    outcome.resources.health = Math.min(outcome.resources.health, -action.cost.health);
  }
}

/* -------------------------------------------- */

TALENT_HOOKS.powerfulThrow000 = {
  prepareAction(actor, action) {
    if ( action.tags.has("throw") ) {
      action.range.maximum *= 2;
    }
  }
}

/* -------------------------------------------- */

export default TALENT_HOOKS;
