# VFX Engine, technical prototype

## Overview

vfx related modules are provided under the `vfx` variable directly in window object or as
part of the crucible system config.
As time of writing, one sample is provided in form of `vfx.samples.arrowBlueConfig`.

### Usage

A wrapper API to create the animation, insert it in the respective canvas
groups etc is not ready right now.
To try out animations, the animation system has to be created, inserted
and started manually.

Note: The sample config requires ktx2 support. Either using a new foundry prototype or using a patched basis/ktx2 loader

Example:

```js
// Create the animation. Requires two parameters. First is the animation config
// object itself, second parameter is the variables object.
// source object is required, whereas target and other variables are optional.
// Depending on the animatino config object however, some variables might
// implicitly be required.
const animation = new vfx.AnimationSystem(vfx.samples.arrowBlueConfig, {
  source: { x: 660, y: 580 },
  target: { x: 1580, y: 580 },
})
animation.sortLayer = 700 // use tokens sort layer
animation.sort = 500 // order on top of most tokens
// Initialize animation system preloads assets, creates components etc.
await animation.initialize()
// Add animation to the scene
game.canvas.primary.addChild(animation)
// start the animation!
animation.start()

// stops the animation, removes it from the scene automatically
// animation.stop()
```

### TODOs

- [ ] Validate concept
- [ ] Integrated end conditions
- [ ] "soft end" with customized fadeout
- [ ] More ways to reference state (impact angle for explosions with followPath projectile)
- [ ] Particle system
- [ ] Custom shader support
- [ ] Motion blur (Too complicated / expensive?)
- [ ] Object trails
- [ ] Mesh deformation
- [ ] hue/saturation shift (color matrix) or color LUTs
- [ ] sound
