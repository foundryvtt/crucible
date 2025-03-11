import { Component } from "./component.mjs"

/**
 * @import {AnimationSystem} from '../animation-system.mjs'
 */

/**
 * Component Root, used internally by the animation system as the root node
 *
 * @extends {Component<any>}
 */
export class ComponentRoot extends Component {
  /**
   *
   * @param {AnimationSystem} system
   */
  constructor(system) {
    super({ config: {}, system })
    this.target = this.system
  }

  /**
   * @override
   */
  createComponent() {
    // nothing to do
  }

  /**
   * @override
   */
  destroy() {
    this.behaviors?.destroy()
    this.behaviors = null
    this.system = null
  }
}
