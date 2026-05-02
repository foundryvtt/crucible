
/* -------------------------------------------- */
/*  Ember 0.5.1 - Remove after Ember 0.5.2+     */
/* -------------------------------------------- */

const EMBER_051 = {
  talent: {
    emberAshkaLineag: {
      prepareToken(_item, token) {
        token.detectionModes.thermalVision ??= {enabled: true, range: 60};
      }
    }
  }
};

/* -------------------------------------------- */
/*  Patch Application                           */
/* -------------------------------------------- */

/**
 * Compatibility patches for Ember module hooks. When the Crucible system updates ahead of the Ember module, this
 * infrastructure allows Crucible to overwrite specific Ember hook implementations with compatible versions.
 * Patches are version-gated so they only apply when running a known incompatible combination.
 * @type {Record<string, object>}
 */
const EMBER_PATCHES = {
  "0.5.1": EMBER_051
};

/**
 * Apply compatibility patches to Ember-registered hooks.
 * Called during the "setup" Foundry hook, after Ember has registered its hooks in "init".
 */
export function applyEmberPatches() {
  const ember = globalThis.ember;
  if ( !ember?.active ) return;
  for ( const [emberVersion, patches] of Object.entries(EMBER_PATCHES) ) {
    if ( foundry.utils.isNewerVersion(ember.version, emberVersion) ) continue;
    for ( const [hookType, hooks] of Object.entries(patches) ) {
      foundry.utils.mergeObject(crucible.api.hooks[hookType], hooks, {inplace: true, applyOperators: true});
    }
  }

  // TODO: Once ember stops clobbering Thermal Vision, remove this
  CONFIG.Canvas.detectionModes.thermalVision = new crucible.api.canvas.detectionModes.DetectionModeThermalVision({
    id: "thermalVision",
    label: "DETECTION_MODES.ThermalVision",
    type: foundry.canvas.perception.DetectionMode.DETECTION_TYPES.SIGHT
  });
}
