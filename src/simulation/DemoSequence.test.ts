import { expect, test, vi } from 'vitest'
import { DemoSequence } from './DemoSequence'
import { CraneMotion } from './CraneMotion'

test('the demo waits for actual movement, grasp and landing, and completes after placement', () => {
  const commands = vi.fn()
  const demo = new DemoSequence(commands)
  const feedback = { moving: false, cargo: 'ATTACHED', hint: null, ropeMaximum: 4.15 } as const
  let time = 0
  function settle(overrides: Partial<Parameters<typeof demo.update>[0]> = {}) {
    const current = { ...feedback, ...overrides }
    demo.update(current, time)
    time += 500
    demo.update(current, time)
  }
  demo.start()
  settle({ cargo: 'GROUND' })
  expect(commands).toHaveBeenLastCalledWith({ ropeLength: 5.1 })
  demo.update({ ...feedback, moving: true, cargo: 'GROUND', hint: 'ready' }, time)
  expect(demo.phase).toBe('approach')
  const ready = { ...feedback, cargo: 'GROUND', hint: 'ready' } as const
  demo.update(ready, time)
  demo.update(ready, time + 499)
  expect(demo.pausing).toBe(true)
  expect(demo.phase).toBe('approach')
  expect(commands).toHaveBeenCalledTimes(1)
  time += 500
  demo.update(ready, time)
  expect(commands).toHaveBeenLastCalledWith({ gripperOpen: 0 })
  settle({ hint: 'pickup' })
  expect(commands).toHaveBeenLastCalledWith({ ropeLength: 3.6 })
  settle()
  expect(demo.phase).toBe('transfer')
  settle()
  expect(commands).toHaveBeenLastCalledWith({ ropeLength: 4.15 })
  settle({ hint: 'landed' })
  expect(commands).toHaveBeenLastCalledWith({ gripperOpen: 80 })
  settle({ cargo: 'PLACED' })
  expect(commands).toHaveBeenLastCalledWith({ ropeLength: 3 })
  demo.update({ ...feedback, cargo: 'PLACED' }, time)
  expect(demo.phase).toBe('complete')
  expect(demo.running).toBe(false)
})

test('the demo reports failure when it settles away from the pickup point', () => {
  const demo = new DemoSequence(vi.fn())
  demo.start()
  const feedback = { moving: false, cargo: 'GROUND', hint: 'height', ropeMaximum: 6 } as const
  for (const time of [0, 500, 1500, 2000]) demo.update(feedback, time)
  expect(demo.phase).toBe('failed')
  expect(demo.running).toBe(false)
})

test('stop cancels commands and freezes all axes; restart retains the selected speed', () => {
  const motion = new CraneMotion()
  motion.setTarget('movementSpeed', 35)
  const commands = vi.fn()
  const demo = new DemoSequence(commands)
  demo.start()
  const feedback = { moving: false, cargo: 'GROUND', hint: null, ropeMaximum: 6 } as const
  demo.update(feedback, 0)
  demo.update(feedback, 500)
  motion.setTarget('platformYaw', 80)
  motion.setTarget('ropeLength', 5.1)
  motion.advance(0.1)
  const pose = { ...motion.actual }
  demo.stop()
  motion.stop()
  motion.advance(0.1)
  demo.update({ moving: false, cargo: 'ATTACHED', hint: null, ropeMaximum: 4 }, 2000)
  expect(demo.phase).toBe('stopped')
  expect(commands).toHaveBeenCalledTimes(1)
  expect(motion.actual).toEqual(pose)
  expect(motion.target).toEqual(pose)
  motion.resetPose()
  expect(motion.target.platformYaw).toBe(25)
  expect(motion.target.ropeLength).toBe(3.2)
  expect(motion.target.movementSpeed).toBe(35)
})

test('stop during a pause prevents the next command', () => {
  const commands = vi.fn()
  const demo = new DemoSequence(commands)
  demo.start()
  const feedback = { moving: false, cargo: 'GROUND', hint: null, ropeMaximum: 6 } as const
  demo.update(feedback, 0)
  demo.stop()
  demo.update(feedback, 1000)
  expect(demo.phase).toBe('stopped')
  expect(demo.pausing).toBe(false)
  expect(commands).not.toHaveBeenCalled()
})
