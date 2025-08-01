/**
 * Configure the data for a VFXEffect
 * @param action
 * @returns {{components: {}, name, timeline: *[]}|null}
 */
export function configureStrikeVFXEffect(action) {
  if ( !action.tags.has("strike") ) throw new Error(`The Action ${action.id} does not use the strike tag.`);
  const components = {};
  const timeline = {sequence: []};
  const references = {
    token: action.token.uuid,
    actor: action.actor.uuid
  };

  // Prepare each weapon strike
  let j=1; // Target
  for ( const outcome of action.outcomes.values() ) {
    if ( outcome.target === action.actor ) continue;
    const token = outcome.token;
    const targetTokenReference = `outcome_${j}_token`;
    references[targetTokenReference] = token.uuid;
    let i=1; // Roll
    for ( const roll of outcome.rolls ) {
      const weapon = action.usage.strikes[outcome.rolls[0].data.strike];
      if ( !["projectile1", "projectile2"].includes(weapon?.category) ) continue;

      // Identify impact location
      const impactPosition = getImpactPositionReference(outcome, roll, targetTokenReference);

      // Add the arrow projectile
      const projectileName = `arrowProjectile_${j}_${i}`;
      components[projectileName] = {
        type: "arrow",
        texture: "modules/foundryvtt-vfx/assets/arrow/arrow-wood.png",
        path: {
          origin: {reference: "token", property: "object.center"},
          destination: impactPosition
        },
        elevation: {reference: "token", property: "elevation", delta: 1},
        scale: 0.25
      };
      timeline.sequence.push({play: projectileName, position: 0});

      // Add an attack sound
      const soundName = `arrowSound_${j}_${i}`;
      components[soundName] = {
        type: "sound",
        src: "modules/foundryvtt-vfx/assets/sounds/BowAttack1.ogg",
        channel: "environment"
      }
      timeline.sequence.push({play: soundName, position: `${projectileName}.drawStart`});

      // Add an impact effect
      const impactName = `arrowImpact_${j}_${i}`;
      components[impactName] = {
        type: "impact",
        position: impactPosition,
        sound: {src: getImpactSoundEffect(roll)},
        sprite: {src: getImpactTexture(roll)}
      }
      timeline.sequence.push({play: impactName, position: `${projectileName}.preImpact`});
      i++;
    }
    j++;
  }
  if ( !timeline.sequence.length ) return null;

  // Validate that the effect data parses correctly
  const vfxConfig = {name: action.id, components, timeline};
  try {
    new foundry.vfx.VFXEffect(vfxConfig);
  } catch(cause) {
    console.warn(new Error(`Strike VFX configuration failed for Action "${this.id}"`, {cause}));
  }
  vfxConfig.references = references;
  return vfxConfig;
}

/* -------------------------------------------- */

/**
 * Get a referenced impact position for a target Token and a given AttackRoll.
 * @param {CrucibleActionOutcome} outcome
 * @param {AttackRoll} roll
 * @param {string} targetTokenReference
 * @returns {{reference: string, property: string, deltaX: number, deltaY: number}}
 * @internal
 */
function getImpactPositionReference(outcome, roll, targetTokenReference) {
  const impactPosition = {reference: targetTokenReference, property: "object.center", deltaX: 0, deltaY: 0};
  const w = outcome.token.width * canvas.dimensions.size;
  const h = outcome.token.height * canvas.dimensions.size;
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  switch ( roll.data.result ) {

    // HIT, BLOCK, or ARMOR between [0, 0.25] of hit-box center
    case T.HIT:
    case T.ARMOR:
    case T.BLOCK:
      impactPosition.deltaX = (Math.random() * w / 8) * (Math.random() > 0.5 ? 1 : -1);
      impactPosition.deltaY = (Math.random() * h / 8) * (Math.random() > 0.5 ? 1 : -1);
      break;

    // PARRY or GLANCE between [0.25, 0.5] of hit-box center
    case T.PARRY:
    case T.GLANCE:
      impactPosition.deltaX = ((w / 4) + (Math.random() * w / 8)) * (Math.random() > 0.5 ? 1 : -1);
      impactPosition.deltaY = ((h / 4) + (Math.random() * h / 8)) * (Math.random() > 0.5 ? 1 : -1);
      break;

    // MISS or DODGE between (1.0, 1.5] of hit-box center
    case T.DODGE:
    case T.MISS:
      impactPosition.deltaX = ((w / 2) + (Math.random() * w / 2)) * (Math.random() > 0.5 ? 1 : -1);
      impactPosition.deltaY = ((h / 2) + (Math.random() * h / 2)) * (Math.random() > 0.5 ? 1 : -1);
      break;
  }
  return impactPosition;
}

/* -------------------------------------------- */

/**
 * Randomize the sound effect used for a projectile impact.
 * @param {AttackRoll} roll
 * @returns {string|null}
 * @internal
 */
function getImpactSoundEffect(roll) {
  const T = crucible.api.dice.AttackRoll.RESULT_TYPES;
  let soundFile;
  switch ( roll.data.result ) {
    case T.BLOCK:
      const blockSounds = ATTACK_SOUNDS.projectile.block;
      soundFile = blockSounds[Math.floor(Math.random() * blockSounds.length)];
      break;
    case T.GLANCE:
    case T.HIT:
      const hitSounds = ATTACK_SOUNDS.projectile.block;
      soundFile = hitSounds[Math.floor(Math.random() * hitSounds.length)];
      break;
    default:
      const missSounds = ATTACK_SOUNDS.projectile.miss;
      soundFile = missSounds[Math.floor(Math.random() * missSounds.length)];
      break;
  }
  return soundFile ? `modules/foundryvtt-vfx/assets/sounds/${soundFile}` : null;
}

/* -------------------------------------------- */

/**
 * Randomize and configure the texture used for a projectile impact.
 * @param {AttackRoll} roll
 * @returns {string|null}
 * @internal
 */
function getImpactTexture(roll) {
  return roll.data.damage?.total ? "modules/foundryvtt-vfx/assets/impact/BloodSplatter1.png" : null;
}

/* -------------------------------------------- */

const ATTACK_SOUNDS = {
  projectile: {
    attack: ["BowAttack1.ogg", "BowAttack2.ogg", "BowAttack3.ogg"],
    block: ["ArrowBlock1.wav", "ArrowBlock2.wav", "ArrowBlock3.wav"],
    hit: ["ArrowHit1.wav", "ArrowHit2.wav", "ArrowHit3.wav", "ArrowHit4.wav"],
    miss: ["ArrowMiss1.wav", "ArrowMiss2.wav", "ArrowMiss3.wav"]
  }
}
