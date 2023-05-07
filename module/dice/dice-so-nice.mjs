/**
 * Augment rolled dice with visual effects animation using the Dice So Nice module API.
 *
 * TODO: Issues with this approach
 * This hook signature has several key limitations, namely it combines all rolls into a proxy Roll which no longer
 * conforms to the original custom subclasses like AttackRoll or SkillCheck.
 *
 * I have provided feedback to JDW about potential improvements to this hook signature so hopefully I can improve this
 * implementation in the future.
 * @param {string} messageId
 * @param {object} context
 */
export function diceSoNiceRollStart(messageId, context) {
  for ( const die of context.roll.dice ) {
    if ( die.faces > 8 ) die.options.sfx = {specialEffect: "PlayAnimationBright"};
    if ( die.faces < 8 ) die.options.sfx = {specialEffect: "PlayAnimationDark"};
  }
}
