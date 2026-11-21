import config from '../../config/g6-route.json' with { type: 'json' }
import type { ScenarioSnapshot } from '../simulation/Simulator'
import { controlDefinition, formatValue, type CraneAxis } from './controls'

type StepId = 'lower-to-handle' | 'close-gripper' | 'lift-cargo' | 'rotate-platform' |
  'pitch-boom' | 'extend-boom' | 'align-gripper' | 'lower-to-platform' |
  'release-cargo' | 'retract-empty-rope'

interface RouteStep {
  id: StepId
  controlId: CraneAxis
  target?: number | null
  comparison?: 'atLeast'
}

export const guideSteps = config.steps as readonly RouteStep[]
export const guidedByDefault = config.entry.guidedDefault
const instructions: Record<StepId, string> = {
  'lower-to-handle': 'Опусти захват до ручки ящика',
  'close-gripper': 'Закрой захват и дождись закрепления ящика',
  'lift-cargo': 'Подними ящик',
  'rotate-platform': 'Поверни платформу',
  'pitch-boom': 'Уменьши наклон стрелы',
  'extend-boom': 'Выдвини стрелу',
  'align-gripper': 'Разверни захват',
  'lower-to-platform': 'Опусти груз до касания площадки.',
  'release-cargo': 'Раскрой захват и оставь ящик на площадке',
  'retract-empty-rope': 'Подними пустой захват',
}

const epsilon = 1e-8

export function guideValue(step: RouteStep, ropeMaximum: number) {
  if (step.target === undefined) return ''
  const value = formatValue(controlDefinition(step.controlId), step.target ?? Number(ropeMaximum.toFixed(2)))
  if (step.comparison === 'atLeast') return `не меньше ${value}`
  return value
}

export function guideInstruction(step: RouteStep) {
  return instructions[step.id]
}

function matchesGuideValue(step: RouteStep, snapshot: ScenarioSnapshot) {
  if (step.target === undefined) return true
  const target = step.target ?? snapshot.ropeMaximum
  const actual = snapshot.actual[step.controlId]
  if (step.comparison === 'atLeast') return actual >= target - epsilon
  const tolerance = step.target === null ? epsilon : controlDefinition(step.controlId).step / 2 + epsilon
  return Math.abs(actual - target) <= tolerance
}

function restoreValue(step: RouteStep, snapshot: ScenarioSnapshot) {
  const label = controlDefinition(step.controlId).label
  const value = guideValue(step, snapshot.ropeMaximum)
  if (step.comparison) return `Верни «${label}» в допустимый диапазон (${value}).`
  return `Верни значение «${label}» к ${value}.`
}

export function evaluateStep(index: number, snapshot: ScenarioSnapshot) {
  const step = guideSteps[index]
  const { cargoState, cargoHint, cargoLifted, cargoInsideLandingArea } = snapshot
  const delivered = cargoState === 'PLACED' && cargoInsideLandingArea
  if (cargoHint === 'outside') {
    return { complete: false, invariantBroken: index > 1 && index !== 8,
      issue: 'Ящик вне площадки. Подними его снова или сбрось сценарий.' }
  }
  // Keep the latest completed setting on each axis until that axis is needed again.
  const preserved = new Set<CraneAxis>([step.controlId])
  for (let earlier = index - 1; earlier >= 0; earlier--) {
    const previous = guideSteps[earlier]
    if (preserved.has(previous.controlId)) continue
    preserved.add(previous.controlId)
    // Physical lift and contact are checked by the current step's cargo conditions.
    if (typeof previous.target === 'number' && !matchesGuideValue(previous, snapshot)) {
      return { complete: false, invariantBroken: true, issue: restoreValue(previous, snapshot) }
    }
  }

  let cargoReady: boolean
  switch (step.id) {
    case 'lower-to-handle':
      cargoReady = cargoState === 'GROUND' && cargoHint === 'ready'
      break
    case 'close-gripper':
      cargoReady = cargoState === 'ATTACHED'
      break
    case 'lift-cargo':
      cargoReady = cargoState === 'ATTACHED' && cargoLifted
      break
    case 'rotate-platform':
    case 'pitch-boom':
    case 'extend-boom':
    case 'align-gripper':
      cargoReady = cargoState === 'ATTACHED' && cargoLifted
      break
    case 'lower-to-platform':
      cargoReady = cargoState === 'ATTACHED' && cargoHint === 'landed' && cargoInsideLandingArea
      break
    case 'release-cargo':
      cargoReady = delivered
      break
    case 'retract-empty-rope':
      cargoReady = delivered && snapshot.emptyGripperLifted
      break
  }

  if (step.id === 'lower-to-handle' && cargoState !== 'GROUND') {
    return { complete: false, issue: 'Сначала освободи ящик на полу или сбрось сценарий.' }
  }
  if (index > 1 && index < 8 && cargoState !== 'ATTACHED') {
    return { complete: false, invariantBroken: true,
      issue: 'Ящик должен быть в захвате. Подними его снова или сбрось сценарий.' }
  }
  if (index >= 3 && index <= 6 && !cargoLifted) {
    return { complete: false, invariantBroken: true, issue: 'Верни ящик в поднятое положение.' }
  }
  if (step.id === 'lower-to-platform' && cargoHint === 'landed' && !cargoInsideLandingArea) {
    return { complete: false, issue: 'Ящик опущен вне контура. Подними его и совмести с площадкой.' }
  }
  if (step.id === 'release-cargo' && cargoLifted) {
    return { complete: false, invariantBroken: true, issue: 'Снова опусти ящик до касания площадки.' }
  }
  if (step.id === 'retract-empty-rope' && !delivered) {
    return { complete: false, invariantBroken: true, issue: 'Оставь ящик внутри площадки или сбрось сценарий.' }
  }
  return { complete: cargoReady && matchesGuideValue(step, snapshot) && !snapshot.moving, issue: '' }
}
