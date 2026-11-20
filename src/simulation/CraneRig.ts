import * as THREE from 'three'
import { controlDefinition, initialValue, type CranePose } from '../state/controls'
import type { CraneModel } from './CraneModel'

const up = new THREE.Vector3(0, 1, 0)
const side = new THREE.Vector3(0, 0, 1)
const radians = THREE.MathUtils.degToRad
const initialLength = initialValue('boomLength')
const ropeExitOffset = new THREE.Vector3(0.159, -0.095, 0)
  .applyAxisAngle(side, radians(initialValue('boomPitch')))
const floorClearance = 0.015
const ropeTravel = controlDefinition('ropeLength')

export class CraneRig {
  readonly ropeAnchor = new THREE.Vector3()
  ropeLength = initialValue('ropeLength')
  maxRopeLength = ropeTravel.max
  floorLimited = false
  crateLimited = false
  crateTop: number | null = null
  private readonly pulleyOffset = new THREE.Vector3()
  private readonly hydraulicDirection = new THREE.Vector3()
  private readonly clawProfile: THREE.Vector3[] = []

  constructor(readonly model: CraneModel) {
    // The four claws share a profile. Yaw does not affect the lowest edge.
    const points = model.clawGeometry.getAttribute('position')
    const unique = new Set<string>()
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i)
      const y = points.getY(i)
      const z = Math.abs(points.getZ(i))
      const key = `${x},${y},${z}`
      if (unique.has(key)) continue
      unique.add(key)
      this.clawProfile.push(new THREE.Vector3(x, y, z))
    }
  }

  applyPose(
    pose: CranePose,
    minimumSuspensionHeight = 0,
    surfaceAt?: (anchor: THREE.Vector3, radius: number) => number | null,
  ) {
    const model = this.model
    const yaw = radians(pose.platformYaw)
    model.platform.rotation.y = yaw
    model.boom.rotation.z = radians(pose.boomPitch)
    const travel = pose.boomLength - initialLength
    for (const [index, { section, start }] of model.sections.entries()) {
      section.position.x = start + travel * index / (model.sections.length - 1)
    }
    model.pulley.position.x = pose.boomLength

    this.hydraulicDirection.copy(model.hydraulicJoint)
      .applyAxisAngle(side, model.boom.rotation.z).add(model.boom.position).sub(model.hydraulic.position)
    const rodLength = this.hydraulicDirection.length() - model.barrelLength
    model.hydraulic.quaternion.setFromUnitVectors(up, this.hydraulicDirection.normalize())
    model.piston.scale.y = rodLength
    model.piston.position.y = model.barrelLength + rodLength / 2

    // Keep the cable on the drum's outer edge even as the boom pitches.
    model.pulley.getWorldPosition(this.ropeAnchor)
    this.ropeAnchor.add(this.pulleyOffset.copy(ropeExitOffset).applyAxisAngle(up, yaw))
    const clawAngle = radians((pose.gripperOpen - initialValue('gripperOpen')) * 0.35)
    const sin = Math.sin(clawAngle)
    const cos = Math.cos(clawAngle)
    let lowest = -0.865
    let radius = 0.305
    const hinge = model.movingClaws[0].position
    for (const { x, y, z } of this.clawProfile) {
      lowest = Math.min(lowest, hinge.y + x * sin + y * cos)
      radius = Math.max(radius, Math.hypot(hinge.x + x * cos - y * sin, z))
    }
    this.crateTop = surfaceAt?.(this.ropeAnchor, radius) ?? null
    const supportHeight = Math.max((this.crateTop ?? 0) + floorClearance - lowest, minimumSuspensionHeight)
    const supportLimit = this.ropeAnchor.y - supportHeight
    this.maxRopeLength = Math.min(ropeTravel.max, supportLimit)
    this.ropeLength = Math.min(pose.ropeLength, this.maxRopeLength)
    const atSupport = supportLimit <= ropeTravel.max && this.ropeLength >= supportLimit - 1e-8
    this.floorLimited = atSupport && this.crateTop === null
    this.crateLimited = atSupport && this.crateTop !== null

    model.rope.position.copy(this.ropeAnchor)
    model.rope.position.y -= this.ropeLength / 2
    model.rope.scale.y = this.ropeLength
    model.gripper.position.copy(this.ropeAnchor)
    model.gripper.position.y -= this.ropeLength
    model.gripper.rotation.y = radians(pose.gripperYaw)
    for (const claw of model.movingClaws) claw.rotation.z = clawAngle
  }
}
