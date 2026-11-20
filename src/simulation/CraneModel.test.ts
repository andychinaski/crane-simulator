import * as THREE from 'three'
import { expect, test } from 'vitest'
import { initialValue } from '../state/controls'
import { buildCrane } from './CraneModel'
import { CraneMotion } from './CraneMotion'
import { CraneRig } from './CraneRig'

function fixture() {
  const scene = new THREE.Scene()
  const model = buildCrane(scene, new THREE.MeshStandardMaterial())
  const rig = new CraneRig(model)
  const pose = new CraneMotion().actual
  rig.applyPose(pose)
  return { model, rig, pose }
}

function expectCable(rig: CraneRig) {
  const { rope, gripper } = rig.model
  const top = rope.localToWorld(new THREE.Vector3(0, 0.5, 0))
  const bottom = rope.localToWorld(new THREE.Vector3(0, -0.5, 0))
  const anchor = rig.ropeAnchor
  expect(top.distanceTo(anchor)).toBeLessThan(1e-6)
  expect(bottom.distanceTo(gripper.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-6)
  expect(top.x).toBeCloseTo(bottom.x)
  expect(top.z).toBeCloseTo(bottom.z)
  expect(top.y - bottom.y).toBeCloseTo(rig.ropeLength)
  expect(gripper.getWorldQuaternion(new THREE.Quaternion())
    .angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), gripper.rotation.y)))
    .toBeLessThan(1e-6)
}

test('the initial cable is attached and has the configured length', () => {
  const { rig } = fixture()
  expectCable(rig)
  expect(rig.ropeLength).toBeCloseTo(initialValue('ropeLength'))
})

test('yaw moves only the upper crane, pitch lifts the tip and reach changes at fixed scale', () => {
  const { model, rig, pose } = fixture()
  model.base.updateWorldMatrix(true, false)
  const base = model.base.matrixWorld.clone()
  const oldTip = rig.ropeAnchor.clone()
  rig.applyPose({ ...pose, platformYaw: 90 })
  expect(model.base.matrixWorld.equals(base)).toBe(true)
  expect(rig.ropeAnchor.y).toBeCloseTo(oldTip.y)
  expect(rig.ropeAnchor.x).toBeCloseTo(0)
  expect(rig.ropeAnchor.z).toBeLessThan(-5)
  rig.applyPose({ ...pose, boomPitch: 60 })
  expect(rig.ropeAnchor.y).toBeGreaterThan(oldTip.y)
  rig.applyPose({ ...pose, boomLength: 8 })
  expect(rig.ropeAnchor.length()).toBeGreaterThan(oldTip.length())
  expect(model.sections[0].section.position.x).toBe(model.sections[0].start)
  for (const { section } of model.sections) {
    expect(section.getWorldScale(new THREE.Vector3()).distanceTo(new THREE.Vector3(1, 1, 1))).toBeLessThan(1e-6)
  }
})

test.each([10, 42, 75])('telescopes and hydraulic joints stay connected at pitch %i°', pitch => {
  const { model, rig, pose } = fixture()
  for (const boomLength of [4, 8]) {
    rig.applyPose({ ...pose, boomLength, boomPitch: pitch })
    const rodTip = model.piston.localToWorld(new THREE.Vector3(0, 0.5, 0))
    expect(model.piston.scale.y).toBeGreaterThan(0)
    expect(rodTip.distanceTo(model.boom.localToWorld(model.hydraulicJoint.clone()))).toBeLessThan(1e-6)

    const stages = model.sections.map(({ section }) => {
      const shell = section.children[0] as THREE.Mesh
      shell.geometry.computeBoundingBox()
      const bounds = shell.geometry.boundingBox!
      const offset = shell.position.x + section.position.x
      return { start: offset + bounds.min.x, end: offset + bounds.max.x }
    })
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].start).toBeLessThan(stages[i - 1].end)
      expect(stages[i].end).toBeGreaterThan(stages[i - 1].end)
    }
    expect(stages.at(-1)!.end).toBeGreaterThan(model.pulley.position.x)
    expectCable(rig)
  }
})

test('rope commands lower the upright gripper and changing the jaw opening respects the floor', () => {
  const { model, rig, pose } = fixture()
  const initialHeight = model.gripper.position.y
  rig.applyPose({ ...pose, ropeLength: pose.ropeLength + 0.5 })
  expect(model.gripper.position.y).toBeCloseTo(initialHeight - 0.5)

  for (const gripperOpen of [0, 25, 55, 80, 100]) {
    rig.applyPose({ ...pose, ropeLength: 8, boomPitch: 10, gripperYaw: -150, gripperOpen })
    expect(rig.floorLimited).toBe(true)
    expect(rig.ropeLength).toBeLessThan(8)
    expect(rig.ropeLength).toBeGreaterThan(0.5)
    expectCable(rig)
    const bottom = new THREE.Box3().setFromObject(model.gripper, true).min.y
    expect(bottom).toBeCloseTo(0.015, 5)
    expect(new Set(model.movingClaws.map(claw => claw.rotation.z)).size).toBe(1)
  }
  const jawGap = () => {
    const tip = new THREE.Vector3(0.30, -0.82, 0)
    return model.movingClaws[0].localToWorld(tip.clone())
      .distanceTo(model.movingClaws[2].localToWorld(tip.clone()))
  }
  rig.applyPose({ ...pose, gripperOpen: 0 })
  const closed = jawGap()
  rig.applyPose({ ...pose, gripperOpen: 100 })
  expect(closed).toBeLessThan(0.2)
  expect(jawGap()).toBeGreaterThan(closed + 0.85)
})
