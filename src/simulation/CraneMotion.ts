import { clampControl, craneControls, initialValues, type CraneAxis, type CraneControl } from '../state/controls'

const rates: Record<CraneAxis, number> = {
  platformYaw: 84,
  boomPitch: 42,
  boomLength: 2.1,
  ropeLength: 2.8,
  gripperYaw: 105,
  gripperOpen: 115,
}
const axes = Object.keys(rates) as CraneAxis[]

export class CraneMotion {
  readonly target = initialValues(craneControls)
  readonly actual = initialValues(craneControls)

  setTarget(id: CraneControl, value: number) {
    if (Number.isFinite(value)) this.target[id] = clampControl(id, value)
  }

  limitRope(maximum: number) {
    this.actual.ropeLength = Math.min(this.actual.ropeLength, maximum)
    this.target.ropeLength = Math.min(this.target.ropeLength, maximum)
  }

  resetPose() {
    this.actual.movementSpeed = this.target.movementSpeed
    for (const control of craneControls) {
      if (control.id === 'movementSpeed') continue
      this.target[control.id] = this.actual[control.id] = control.initial
    }
  }

  stop() {
    for (const id of axes) this.target[id] = this.actual[id]
  }

  get moving() {
    return axes.some(id => this.actual[id] !== this.target[id])
  }

  advance(elapsed: number) {
    const dt = Math.max(0, Math.min(elapsed, 0.1))
    const speed = this.target.movementSpeed / 100
    this.actual.movementSpeed = this.target.movementSpeed
    for (const id of axes) {
      const remaining = this.target[id] - this.actual[id]
      const step = rates[id] * speed * dt
      this.actual[id] = Math.abs(remaining) <= step
        ? this.target[id]
        : this.actual[id] + Math.sign(remaining) * step
    }
  }
}
