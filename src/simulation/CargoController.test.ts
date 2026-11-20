import * as THREE from 'three'
import { expect, test } from 'vitest'
import { buildCrane } from './CraneModel'
import { CraneMotion } from './CraneMotion'
import { CraneRig } from './CraneRig'
import { CargoController } from './CargoController'
import { crateSize, crateSpawnOffset, crateStartYaw, deliveryArea } from './cargoGeometry'

function fixture() {
  const crate = new THREE.Object3D()
  crate.position.set(2, 0, -1)
  const gripper = new THREE.Object3D()
  gripper.position.set(2, 2.91, -1)
  const cargo = new CargoController(crate)
  return { crate, gripper, cargo }
}

test('the gripper stops over the crate lid or the floor depending on its footprint', () => {
  const scene = new THREE.Scene()
  const rig = new CraneRig(buildCrane(scene, new THREE.MeshStandardMaterial()))
  const pose = new CraneMotion().actual
  rig.applyPose(pose)
  const crate = new THREE.Object3D()
  crate.position.copy(rig.ropeAnchor).setY(0)
  crate.rotation.y = Math.PI / 4
  const cargo = new CargoController(crate)
  const surfaceAt = cargo.surfaceUnderGripper.bind(cargo)
  pose.ropeLength = 8
  for (const gripperOpen of [0, 80, 100]) {
    rig.applyPose({ ...pose, gripperOpen }, 0, surfaceAt)
    expect(rig.crateLimited).toBe(true)
    expect(new THREE.Box3().setFromObject(rig.model.gripper, true).min.y).toBeCloseTo(crateSize.height + 0.015)
  }
  rig.applyPose({ ...pose, platformYaw: -20 }, 0, surfaceAt)
  expect(rig.floorLimited).toBe(true)
  expect(new THREE.Box3().setFromObject(rig.model.gripper, true).min.y).toBeCloseTo(0.015)
})

test('capture requires an open approach followed by a close and correct alignment', () => {
  const { cargo, crate, gripper } = fixture()
  cargo.update(gripper, 0, 0)
  expect(cargo.state).toBe('GROUND')
  gripper.position.x += 0.3
  cargo.update(gripper, 80, 80)
  cargo.update(gripper, 0, 0)
  expect(cargo.hint).toBe('position')
  gripper.position.x = crate.position.x
  cargo.update(gripper, 0, 0)
  expect(cargo.state).toBe('GROUND')

  gripper.position.y += 0.25
  cargo.update(gripper, 80, 80)
  cargo.update(gripper, 0, 0)
  expect(cargo.hint).toBe('height')
  gripper.position.y = 2.91
  gripper.rotation.y = Math.PI / 4
  cargo.update(gripper, 80, 80)
  cargo.update(gripper, 0, 0)
  expect(cargo.hint).toBe('angle')

  gripper.rotation.y = Math.PI / 2
  cargo.update(gripper, 80, 80)
  expect(cargo.hint).toBe('ready')
  const startPosition = crate.position.clone()
  cargo.update(gripper, 18, 0)
  expect(cargo.state).toBe('ATTACHED')
  expect(cargo.hint).toBe('pickup')
  expect(crate.position.equals(startPosition)).toBe(true)
  expect(crate.rotation.y).toBe(0)
})

test('the retained transform follows a compound movement and high release is rejected', () => {
  const { cargo, crate, gripper } = fixture()
  gripper.position.x -= 0.1
  cargo.update(gripper, 80, 80)
  cargo.update(gripper, 0, 0)
  gripper.position.set(3, 4.61, -2)
  gripper.rotation.y = Math.PI / 2
  cargo.update(gripper, 0, 0)
  expect(crate.position.toArray()).toEqual([3, expect.closeTo(1.7), expect.closeTo(-2.1)])
  expect(crate.rotation.y).toBeCloseTo(Math.PI / 2)
  expect(crate.rotation.x).toBe(0)
  expect(crate.rotation.z).toBe(0)
  expect(cargo.update(gripper, 50, 80)).toBe('block-opening')
  expect(cargo.state).toBe('ATTACHED')
  expect(cargo.hint).toBe('airborne')
})

test.each([
  { x: deliveryArea.x, yaw: 0, delivered: true },
  { x: deliveryArea.x + 0.30, yaw: 0, delivered: false },
  { x: deliveryArea.x, yaw: Math.PI / 4, delivered: false },
])('only the entire footprint qualifies for delivery ($delivered)', ({ x, yaw, delivered }) => {
  const { cargo, crate, gripper } = fixture()
  cargo.update(gripper, 80, 80)
  cargo.update(gripper, 0, 0)
  gripper.position.set(x, cargo.minimumSuspensionHeight, deliveryArea.z)
  gripper.rotation.y = yaw
  cargo.update(gripper, 0, 0)
  const landed = crate.position.clone()
  expect(cargo.update(gripper, 40, 80)).toBe('released')
  expect(cargo.state).toBe(delivered ? 'PLACED' : 'GROUND')
  expect(cargo.hint).toBe(delivered ? null : 'outside')
  cargo.update(gripper, 80, 80)
  if (!delivered) expect(cargo.hint).toBe('outside')
  gripper.position.set(0, 8, 0)
  cargo.update(gripper, 80, 80)
  expect(cargo.hint).toBeNull()
  expect(crate.position.equals(landed)).toBe(true)
  expect(crate.position.y).toBe(0)
  expect(crate.rotation.y).toBe(yaw)
})

test('the start and delivery poses are reachable using the real rig and slider steps', () => {
  const scene = new THREE.Scene()
  const rig = new CraneRig(buildCrane(scene, new THREE.MeshStandardMaterial()))
  const pose = new CraneMotion().actual
  rig.applyPose(pose)
  const crate = new THREE.Object3D()
  crate.position.set(rig.ropeAnchor.x + crateSpawnOffset.x, 0, rig.ropeAnchor.z + crateSpawnOffset.z)
  crate.rotation.y = THREE.MathUtils.degToRad(crateStartYaw)
  const cargo = new CargoController(crate)
  const step = () => {
    rig.applyPose(pose, cargo.minimumSuspensionHeight)
    cargo.update(rig.model.gripper, pose.gripperOpen, pose.gripperOpen)
  }
  pose.ropeLength = 5.1
  step()
  expect(cargo.hint).toBe('ready')
  pose.gripperOpen = 0
  step()
  expect(cargo.state).toBe('ATTACHED')
  pose.ropeLength = 3.6
  step()
  expect(crate.position.y).toBeCloseTo(1.5)
  Object.assign(pose, { platformYaw: 54, boomPitch: 28, boomLength: 7.1, gripperYaw: 0 })
  step()
  expect(crate.position.y).toBeGreaterThan(0.5)
  pose.ropeLength = 4.6
  step()
  expect(rig.floorLimited).toBe(true)
  expect(rig.ropeLength).toBe(rig.maxRopeLength)
  expect(crate.position.y).toBe(0)
  const landingLength = rig.ropeLength
  pose.gripperOpen = 80
  step()
  expect(cargo.state).toBe('PLACED')
  pose.ropeLength = landingLength
  step()
  expect(rig.maxRopeLength).toBeGreaterThan(landingLength + 1)
  expect(rig.ropeLength).toBe(landingLength)
})
