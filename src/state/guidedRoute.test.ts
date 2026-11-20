import { describe, expect, it } from 'vitest'
import type { ScenarioSnapshot } from '../simulation/Simulator'
import { craneControls, initialValues } from './controls'
import { evaluateStep, guideSteps } from './guidedRoute'

const initial: ScenarioSnapshot = {
  actual: initialValues(craneControls),
  moving: false,
  ropeMaximum: 5.5,
  contact: null,
  cargoState: 'GROUND',
  cargoHint: 'ready',
  cargoLifted: false,
  cargoInsideLandingArea: false,
}
const carrying: ScenarioSnapshot = {
  ...initial,
  actual: { ...initial.actual, ropeLength: 3.6, gripperOpen: 0, platformYaw: 54 },
  cargoState: 'ATTACHED',
  cargoHint: null,
  cargoLifted: true,
}
const landed: ScenarioSnapshot = {
  ...carrying,
  actual: { ...carrying.actual, boomPitch: 28, boomLength: 7.1, gripperYaw: 0, ropeLength: 4.173 },
  ropeMaximum: 4.173,
  cargoHint: 'landed',
  cargoLifted: false,
  cargoInsideLandingArea: true,
}

describe('manual guide', () => {
  it('uses the settled actual pose, a half-step tolerance, and real capture alignment', () => {
    const approach = { ...initial, actual: { ...initial.actual, ropeLength: 5.05 } }
    expect(evaluateStep(0, approach).complete).toBe(true)
    expect(evaluateStep(0, { ...approach, moving: true }).complete).toBe(false)
    expect(evaluateStep(0, { ...approach, cargoHint: 'angle' }).complete).toBe(false)
    expect(evaluateStep(0, { ...approach, actual: { ...approach.actual, ropeLength: 5.049 } }).complete).toBe(false)
    expect(evaluateStep(1, { ...approach, actual: { ...approach.actual, gripperOpen: 0 } }).complete).toBe(false)
  })

  it('revokes current completion and keeps the most recent settings on previous axes', () => {
    const turnedBack = { ...carrying, actual: { ...carrying.actual, platformYaw: 50 } }
    expect(evaluateStep(3, carrying).complete).toBe(true)
    expect(evaluateStep(3, turnedBack).complete).toBe(false)
    expect(evaluateStep(4, turnedBack).issue).toContain('54°')
    expect(evaluateStep(4, { ...carrying, actual: { ...carrying.actual, boomPitch: 28 } }).complete).toBe(true)
    expect(evaluateStep(3, { ...carrying, cargoLifted: false }).complete).toBe(false)
  })

  it('checks loaded contact at the dynamic limit and releases that constraint for delivery', () => {
    expect(evaluateStep(7, landed).complete).toBe(true)
    expect(evaluateStep(7, { ...landed, ropeMaximum: 4.174 }).complete).toBe(false)
    expect(evaluateStep(7, { ...landed, cargoInsideLandingArea: false }).complete).toBe(false)
    const released: ScenarioSnapshot = {
      ...landed,
      actual: { ...landed.actual, gripperOpen: 80 },
      cargoState: 'PLACED',
      cargoHint: null,
      ropeMaximum: 5.2,
    }
    expect(evaluateStep(8, released).complete).toBe(true)
    expect(evaluateStep(8, { ...released, cargoInsideLandingArea: false }).complete).toBe(false)
    expect(evaluateStep(guideSteps.length - 1, { ...released, actual: { ...released.actual, ropeLength: 3 } })
      .complete).toBe(true)
  })
})
