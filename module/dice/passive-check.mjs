import StandardCheck from "./standard-check.mjs";

export default class PassiveCheck extends StandardCheck {

  /** @override */
  static parse(_, data) {
    const base = SYSTEM.PASSIVE_BASE + (data.totalBoons || 0) - (data.totalBanes || 0);
    const terms = [base, data.ability, data.skill];
    if ( data.enchantment > 0 ) terms.push(data.enchantment);
    const formula = terms.join(" + ");
    return foundry.dice.Roll.parse(formula, data);
  }
}
