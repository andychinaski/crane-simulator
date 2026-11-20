import { MathUtils, Vector3, type Object3D } from 'three'
import { crateHalfFootprint, crateHandleHeight, crateSize, deliveryArea } from './cargoGeometry'

export const captureOpening = 18
export const releaseOpening = 40
const gripDepth = 1.40
const horizontalTolerance = 0.23
const verticalTolerance = 0.19
const yawTolerance = 23
const floorTolerance = 1e-6
const up = new Vector3(0, 1, 0)

export type CargoState = 'GROUND' | 'ATTACHED' | 'PLACED'
type Alignment = 'ready' | 'position' | 'height' | 'angle'
export type CargoHint = Alignment | 'pickup' | 'airborne' | 'landed' | 'outside' | null

export class CargoController {
  state: CargoState = 'GROUND'
  hint: CargoHint = null
  private armed = false
  private hasLifted = false
  private readonly holdOffset = new Vector3()
  private heldYaw = 0
  private readonly startPosition: Vector3
  private readonly startYaw: number

  constructor(readonly crate: Object3D) {
    this.startPosition = crate.position.clone()
    this.startYaw = crate.rotation.y
  }

  reset() {
    this.crate.position.copy(this.startPosition)
    this.crate.rotation.y = this.startYaw
    this.state = 'GROUND'
    this.hint = null
    this.armed = false
    this.hasLifted = false
  }

  get minimumSuspensionHeight() {
    return this.state === 'ATTACHED' ? -this.holdOffset.y : 0
  }

  get lifted() {
    return this.state === 'ATTACHED' && this.crate.position.y > floorTolerance
  }

  get atStart() {
    return this.state === 'GROUND' && this.crate.position.equals(this.startPosition) &&
      this.crate.rotation.y === this.startYaw
  }

  surfaceUnderGripper(anchor: Vector3, radius: number) {
    if (this.state === 'ATTACHED') return null
    const x = anchor.x - this.crate.position.x
    const z = anchor.z - this.crate.position.z
    const cos = Math.cos(this.crate.rotation.y)
    const sin = Math.sin(this.crate.rotation.y)
    const dx = Math.max(0, Math.abs(x * cos - z * sin) - crateHalfFootprint.x)
    const dz = Math.max(0, Math.abs(x * sin + z * cos) - crateHalfFootprint.z)
    return dx * dx + dz * dz < radius * radius ? this.crate.position.y + crateSize.height : null
  }

  clearReleaseWarning() {
    if (this.hint === 'airborne') this.hint = null
  }

  private alignment(gripper: Object3D): Alignment {
    const horizontal = Math.hypot(
      gripper.position.x - this.crate.position.x,
      gripper.position.z - this.crate.position.z,
    )
    if (horizontal > horizontalTolerance) return 'position'
    const height = gripper.position.y - gripDepth - (this.crate.position.y + crateHandleHeight)
    if (Math.abs(height) > verticalTolerance) return 'height'
    const yaw = MathUtils.radToDeg(gripper.rotation.y - this.crate.rotation.y)
    // Four equally spaced petals fit the handle at equivalent quarter turns.
    const yawError = Math.abs(MathUtils.euclideanModulo(yaw + 45, 90) - 45)
    return yawError <= yawTolerance ? 'ready' : 'angle'
  }

  isInDeliveryArea() {
    const { x, z } = this.crate.position
    const cos = Math.abs(Math.cos(this.crate.rotation.y))
    const sin = Math.abs(Math.sin(this.crate.rotation.y))
    const extentX = crateHalfFootprint.x * cos + crateHalfFootprint.z * sin
    const extentZ = crateHalfFootprint.x * sin + crateHalfFootprint.z * cos
    return Math.abs(x - deliveryArea.x) + extentX <= deliveryArea.width / 2 &&
      Math.abs(z - deliveryArea.z) + extentZ <= deliveryArea.depth / 2
  }

  update(gripper: Object3D, opening: number, requestedOpening: number) {
    if (this.state === 'ATTACHED') {
      this.crate.position.copy(this.holdOffset).applyAxisAngle(up, gripper.rotation.y).add(gripper.position)
      this.crate.rotation.y = gripper.rotation.y + this.heldYaw
      if (this.crate.position.y > floorTolerance) {
        this.hasLifted = true
        if (requestedOpening > captureOpening) {
          this.hint = 'airborne'
          return 'block-opening'
        }
        if (this.hint !== 'airborne') this.hint = null
        return
      }
      this.crate.position.y = 0
      this.hint = this.hasLifted ? 'landed' : 'pickup'
      if (opening >= releaseOpening) {
        this.state = this.isInDeliveryArea() ? 'PLACED' : 'GROUND'
        this.hint = this.state === 'PLACED' ? null : 'outside'
        this.armed = true
        return 'released'
      }
      return
    }

    if (opening >= releaseOpening) this.armed = true
    if (!this.armed) return
    const alignment = this.alignment(gripper)
    if (opening > captureOpening) {
      if (alignment !== 'ready') this.hint = null
      else if (this.hint !== 'outside') this.hint = 'ready'
      return
    }

    this.armed = false
    if (alignment !== 'ready') {
      this.hint = alignment
      return
    }
    // Save the crate's current transform in gripper space for a jump-free pickup.
    this.holdOffset.copy(this.crate.position).sub(gripper.position).applyAxisAngle(up, -gripper.rotation.y)
    this.heldYaw = this.crate.rotation.y - gripper.rotation.y
    this.state = 'ATTACHED'
    this.hasLifted = false
    this.hint = 'pickup'
  }
}
