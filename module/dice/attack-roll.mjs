import StandardCheck from "./standard-check.js";
import {SYSTEM} from "../config/system.js";


export default class AttackRoll extends StandardCheck {

  /** @override */
  _configureData(data) {
    data.banes = Math.clamped(data.banes, 0, SYSTEM.dice.MAX_BOONS);
    data.boons = Math.clamped(data.boons, 0, SYSTEM.dice.MAX_BOONS);
    data.dc = Math.max(data.dc, 0);
    data.ability = Math.clamped(data.ability, 0, 12);
    data.skill = Math.clamped(data.skill, -4, 12);
    data.enchantment = Math.clamped(data.enchantment, 0, 6);
    data.circumstance = data.boons - data.banes;
  }
}