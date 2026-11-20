import { expect, test } from 'vitest'
import { cameraControls, craneControls, formatValue, initialValue } from './controls'

test('all 11 controls have unique identifiers, valid ranges and aligned defaults', () => {
  const controls = [...craneControls, ...cameraControls]
  expect(craneControls).toHaveLength(7)
  expect(cameraControls).toHaveLength(4)
  expect(new Set(controls.map(control => control.id)).size).toBe(11)
  for (const control of controls) {
    expect(control.label.trim()).not.toBe('')
    expect(['m', 'deg', 'percent']).toContain(control.unit)
    expect(control.max).toBeGreaterThan(control.min)
    expect(control.step).toBeGreaterThan(0)
    expect(control.initial).toBeGreaterThanOrEqual(control.min)
    expect(control.initial).toBeLessThanOrEqual(control.max)
    const steps = (control.initial - control.min) / control.step
    expect(steps).toBeCloseTo(Math.round(steps))
    expect(initialValue(control.id)).toBe(control.initial)
  }
})

test('UI uses the Russian decimal separator and configured units', () => {
  expect(craneControls.map(control => formatValue(control, control.initial)))
    .toEqual(['25°', '42°', '6,4 м', '3,2 м', '15°', '80%', '60%'])
  expect(cameraControls.map(control => formatValue(control, control.initial)))
    .toEqual(['0 м', '0 м', '100%', '0°'])
})
