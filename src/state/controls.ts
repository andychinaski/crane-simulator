import config from '../../config/controls.json' with { type: 'json' }

export type CraneAxis =
  'platformYaw' | 'boomPitch' | 'boomLength' | 'ropeLength' | 'gripperYaw' | 'gripperOpen'
export type CraneControl = CraneAxis | 'movementSpeed'
export type CameraControl = 'cameraPanX' | 'cameraPanY' | 'cameraZoom' | 'sceneOrbit'
export type CranePose = Record<CraneAxis, number>
export type CameraValues = Record<CameraControl, number>

export interface ControlDefinition<Id extends string = string> {
  id: Id
  label: string
  min: number
  max: number
  step: number
  initial: number
  unit: string
}

export const craneControls = config.crane as readonly ControlDefinition<CraneControl>[]
export const cameraControls = config.camera as readonly ControlDefinition<CameraControl>[]
const controls = new Map([...craneControls, ...cameraControls].map(control => [control.id, control]))

export function controlDefinition(id: CraneControl | CameraControl) {
  return controls.get(id)!
}

export function initialValue(id: CraneControl | CameraControl): number {
  return controlDefinition(id).initial
}

export function initialValues<Id extends string>(definitions: readonly ControlDefinition<Id>[]) {
  return Object.fromEntries(definitions.map(control => [control.id, control.initial])) as Record<Id, number>
}

export function clampControl(id: CraneControl | CameraControl, value: number) {
  const { min, max } = controlDefinition(id)
  return Math.max(min, Math.min(max, value))
}

const numberFormat = new Intl.NumberFormat('ru-RU')
const units: Record<string, string> = { deg: '°', m: ' м', percent: '%' }

export function formatValue(control: ControlDefinition, value: number): string {
  return numberFormat.format(value) + units[control.unit]
}
