import { Component } from "./component.mjs"

/**
 * @import {ComponentConfig, BaseComponentConfig}  from './component.mjs'
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {Object} ContainerConfig
 * @property {'container'} type
 * @property {ComponentConfig<Resolved>[]} [children]
 */

/**
 * @template {boolean} [Resolved = false]
 *
 * @typedef {ContainerConfig<Resolved> & BaseComponentConfig<Resolved>} ComponentContainerConfig
 */

/**
 * Simple Container Component, allowing for nested components.
 *
 * @extends {Component<ComponentContainerConfig<true>>}
 */
export class ComponentContainer extends Component {
  /**
   * @override
   */
  prepare() {
    this.target = new PIXI.Container()
    if (this.config.children) {
      this.system.initializeComponents(this.config.children, this)
    }
  }
  /**
   * @override
   */
  createComponent() {
    // intentionally left blank, component is already created in prepare
  }
}
