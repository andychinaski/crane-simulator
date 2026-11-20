import config from '../../config/g6-route.json' with { type: 'json' }
import type { ScenarioSnapshot } from '../simulation/Simulator'
import { controlDefinition, formatValue, type CraneAxis } from './controls'

type StepId = 'lower-to-handle' | 'close-gripper' | 'lift-cargo' | 'rotate-platform' |
  'pitch-boom' | 'extend-boom' | 'align-gripper' | 'lower-to-platform' |
  'release-cargo' | 'retract-empty-rope'

interface RouteStep {
  id: StepId
  controlId: CraneAxis
  target: number | null
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
  'lower-to-platform': 'Опусти груз до касания площадки. На ползунке троса можно нажать End.',
  'release-cargo': 'Раскрой захват и оставь ящик на площадке',
  'retract-empty-rope': 'Укороти трос и подними пустой захват',
}

const epsilon = 1e-8

export function guideValue(step: RouteStep, ropeMaximum: number) {
  return formatValue(controlDefinition(step.controlId), step.target ?? Number(ropeMaximum.toFixed(2)))
}

export function guideInstruction(step: RouteStep) {
  return instructions[step.id]
}

export function matchesGuideValue(step: RouteStep, snapshot: ScenarioSnapshot) {
  const target = step.target ?? snapshot.ropeMaximum
  const tolerance = step.target === null ? epsilon : controlDefinition(step.controlId).step / 2 + epsilon
  return Math.abs(snapshot.actual[step.controlId] - target) <= tolerance
}

export function restoreValue(step: RouteStep, snapshot: ScenarioSnapshot) {
  return `Верни значение «${controlDefinition(step.controlId).label}» к ${guideValue(step, snapshot.ropeMaximum)}.`
}

export function evaluateStep(index: number, snapshot: ScenarioSnapshot) {
  const step = guideSteps[index]
  const { cargoState, cargoHint, cargoLifted, cargoInsideLandingArea } = snapshot
  const delivered = cargoState === 'PLACED' && cargoInsideLandingArea
  if (cargoHint === 'outside') {
    return { complete: false, issue: 'Ящик вне площадки. Подними его снова или сбрось сценарий.' }
  }
  // Keep the latest completed setting on each axis until that axis is needed again.
  const preserved = new Set<CraneAxis>([step.controlId])
  for (let earlier = index - 1; earlier >= 0; earlier--) {
    const previous = guideSteps[earlier]
    if (preserved.has(previous.controlId)) continue
    preserved.add(previous.controlId)
    // The loaded contact limit stops applying as soon as the crate is released.
    if (previous.target !== null && !matchesGuideValue(previous, snapshot)) {
      return { complete: false, issue: restoreValue(previous, snapshot) }
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
      cargoReady = cargoLifted
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
    case 'retract-empty-rope':
      cargoReady = delivered
      break
  }

  if (step.id === 'lower-to-handle' && cargoState !== 'GROUND') {
    return { complete: false, issue: 'Сначала освободи ящик на полу или сбрось сценарий.' }
  }
  if (index > 1 && index < 8 && cargoState !== 'ATTACHED') {
    return { complete: false, issue: 'Ящик должен быть в захвате. Подними его снова или сбрось сценарий.' }
  }
  if (step.id === 'lower-to-platform' && cargoHint === 'landed' && !cargoInsideLandingArea) {
    return { complete: false, issue: 'Ящик опущен вне контура. Подними его и совмести с площадкой.' }
  }
  if (step.id === 'release-cargo' && cargoLifted) {
    return { complete: false, issue: 'Сначала снова опусти ящик до касания площадки.' }
  }
  if (step.id === 'retract-empty-rope' && !delivered) {
    return { complete: false, issue: 'Оставь ящик внутри площадки или сбрось сценарий.' }
  }
  return { complete: cargoReady && matchesGuideValue(step, snapshot) && !snapshot.moving, issue: '' }
}
