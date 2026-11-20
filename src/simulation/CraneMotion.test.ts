import { expect, test } from 'vitest'
import { CraneMotion } from './CraneMotion'

function advanceFor(motion: CraneMotion, seconds: number, fps: number) {
  for (let i = 0; i < seconds * fps; i++) motion.advance(1 / fps)
}

test('different frame rates produce the same multi-axis pose after the same duration', () => {
  const run = (fps: number) => {
    const motion = new CraneMotion()
    motion.setTarget('platformYaw', -120)
    motion.setTarget('boomPitch', 72)
    motion.setTarget('boomLength', 5)
    motion.setTarget('ropeLength', 8)
    motion.setTarget('gripperYaw', 120)
    motion.setTarget('gripperOpen', 0)
    advanceFor(motion, 1, fps)
    return Object.values(motion.actual)
  }
  const baseline = run(60)
  for (const fps of [30, 120]) run(fps).forEach((value, i) => expect(value).toBeCloseTo(baseline[i], 8))
})

test('speed changes travel time, while commands and large elapsed times are bounded', () => {
  const fast = new CraneMotion()
  const slow = new CraneMotion()
  fast.setTarget('movementSpeed', 100)
  slow.setTarget('movementSpeed', 20)
  for (const motion of [fast, slow]) {
    motion.setTarget('boomPitch', 99)
    motion.setTarget('boomLength', NaN)
    expect(motion.target.boomPitch).toBe(75)
    expect(motion.target.boomLength).toBe(6.4)
    motion.advance(30)
  }
  expect(fast.actual.boomPitch - 42).toBeCloseTo(4.2)
  expect(slow.actual.boomPitch - 42).toBeCloseTo(0.84)
  advanceFor(fast, 1, 60)
  advanceFor(slow, 1, 60)
  expect(fast.actual.boomPitch).toBe(75)
  expect(slow.actual.boomPitch).toBeLessThan(55)
  expect(fast.moving).toBe(false)
  expect(slow.moving).toBe(true)
})

test('a shorter working limit clamps both paid-out rope and its target without paying out later', () => {
  const motion = new CraneMotion()
  motion.setTarget('ropeLength', 8)
  advanceFor(motion, 3, 60)
  motion.limitRope(4.187)
  expect(motion.actual.ropeLength).toBe(4.187)
  expect(motion.target.ropeLength).toBe(4.187)
  motion.limitRope(6.24)
  advanceFor(motion, 1, 60)
  expect(motion.actual.ropeLength).toBe(4.187)
  expect(motion.target.ropeLength).toBe(4.187)
})
