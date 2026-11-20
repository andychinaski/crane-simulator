import type { CranePose } from '../state/controls'
import type { CargoHint, CargoState } from './CargoController'

export type DemoPhase = 'idle' | 'reset' | 'approach' | 'close' | 'lift' | 'transfer' | 'lower' |
  'release' | 'retreat' | 'complete' | 'stopped' | 'failed'

interface DemoFeedback {
  moving: boolean
  cargo: CargoState
  hint: CargoHint
  ropeMaximum: number
}

export class DemoSequence {
  phase: DemoPhase = 'idle'
  private settledSince: number | null = null

  constructor(private readonly command: (targets: Partial<CranePose>) => void) {}

  get running() {
    return !['idle', 'complete', 'stopped', 'failed'].includes(this.phase)
  }

  get pausing() {
    return this.running && this.settledSince !== null
  }

  start() {
    this.phase = 'reset'
    this.settledSince = null
  }

  stop() {
    if (this.running) this.phase = 'stopped'
  }

  update({ moving, cargo, hint, ropeMaximum }: DemoFeedback, time: number) {
    if (!this.running) return
    if (moving) {
      this.settledSince = null
      return
    }
    switch (this.phase) {
      case 'reset':
        if (cargo === 'GROUND') return this.waitThenGo(time, 'approach', { ropeLength: 5.1 })
        break
      case 'approach':
        if (cargo === 'GROUND' && hint === 'ready') return this.waitThenGo(time, 'close', { gripperOpen: 0 })
        break
      case 'close':
        if (cargo === 'ATTACHED') return this.waitThenGo(time, 'lift', { ropeLength: 3.6 })
        break
      case 'lift':
        if (cargo === 'ATTACHED' && hint === null) {
          return this.waitThenGo(time, 'transfer', { platformYaw: 54, boomPitch: 28, boomLength: 7.1, gripperYaw: 0 })
        }
        break
      case 'transfer':
        if (cargo === 'ATTACHED' && hint === null) return this.waitThenGo(time, 'lower', { ropeLength: ropeMaximum })
        break
      case 'lower':
        if (cargo === 'ATTACHED' && hint === 'landed') return this.waitThenGo(time, 'release', { gripperOpen: 80 })
        break
      case 'release':
        if (cargo === 'PLACED') return this.waitThenGo(time, 'retreat', { ropeLength: 3 })
        break
      case 'retreat':
        if (cargo === 'PLACED') {
          this.phase = 'complete'
          return
        }
    }
    this.phase = 'failed'
  }

  private waitThenGo(time: number, phase: DemoPhase, targets: Partial<CranePose>) {
    this.settledSince ??= time
    if (time - this.settledSince < 500) return
    this.phase = phase
    this.settledSince = null
    this.command(targets)
  }
}
