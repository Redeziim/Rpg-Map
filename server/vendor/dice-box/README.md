# Dice Box physics adapter

Source: https://github.com/3d-dice/dice-box, version 1.1.4, commit eea7f1b042338b1083d4d696585b847b84f84a55.
`ammo.js` and `ammo.wasm.wasm` come from upstream src/ammo and public/assets/dice-box/ammo. The JS wrapper has three Node ESM compatibility imports. Ammo/Bullet carries its upstream zlib license header.
`physics.js` adapts the world, convex hull and rigid-body setup in upstream `src/components/physics.worker.js` (MIT, see LICENSE).

This integration uses Dice Box's physical runtime on the server, not the browser-only DiceBox facade or its Babylon renderer. The existing Three renderer displays the uploaded OBJ base and authoritative recorded frames. This preserves manual gestures, identical multiplayer trajectories, signed dice expressions, percentile dice, and server-generated results.

Differences from upstream: gesture-derived velocity, six measured wall colliders, fixed 120 Hz simulation, 30 Hz trajectory recording, 12-second upper bound, invalid/cocked-roll detection, and explicit allocation disposal. There is no automatic forced result at timeout.
