import * as THREE from 'three'
import { expect, test } from 'vitest'
import type { CameraValues } from '../state/controls'
import { createCameraController } from './CameraController'

function fixture() {
  const camera = new THREE.OrthographicCamera()
  const root = new EventTarget()
  const input = Object.assign(new EventTarget(), {
    style: {},
    getRootNode: () => root,
  })
  let values: CameraValues | undefined
  const controls = createCameraController(camera, input as unknown as HTMLCanvasElement, next => {
    values = next
  })
  controls.resize(1200, 700)
  return { camera, controls, values: () => values }
}

test.each([0, 72, -135])('camera pan follows the screen axes at %i°', degrees => {
  const { camera, controls } = fixture()
  const point = new THREE.Vector3(2, 3, -1)
  controls.set('sceneOrbit', degrees)
  const start = point.clone().project(camera)
  controls.set('cameraPanX', 1.5)
  const horizontal = point.clone().project(camera)
  expect(horizontal.x).toBeLessThan(start.x)
  expect(horizontal.y).toBeCloseTo(start.y, 12)
  expect(horizontal.z).toBeCloseTo(start.z, 12)
  controls.set('cameraPanY', 2)
  const vertical = point.clone().project(camera)
  expect(vertical.y).toBeLessThan(horizontal.y)
  expect(vertical.x).toBeCloseTo(horizontal.x, 12)
  expect(vertical.z).toBeCloseTo(horizontal.z, 12)
  controls.dispose()
})

test('zoom scales the view and reset restores its original projection and controls', () => {
  const { camera, controls, values } = fixture()
  const first = new THREE.Vector3(-1, 3, -1)
  const second = new THREE.Vector3(3, 3, -1)
  const screenSpan = () => Math.abs(first.clone().project(camera).x - second.clone().project(camera).x)
  const startSpan = screenSpan()
  const initial = camera.projectionMatrix.clone()
  controls.set('cameraZoom', 200)
  expect(screenSpan()).toBeCloseTo(startSpan * 2)
  controls.set('cameraZoom', 5)
  expect(values()?.cameraZoom).toBe(50)
  expect(screenSpan()).toBeCloseTo(startSpan / 2)
  controls.set('cameraPanX', -2)
  controls.set('cameraPanY', 2)
  controls.set('sceneOrbit', 80)
  controls.reset()
  expect(values()).toEqual({ cameraPanX: 0, cameraPanY: 0, cameraZoom: 100, sceneOrbit: 0 })
  expect(camera.projectionMatrix.equals(initial)).toBe(true)
  expect(screenSpan()).toBeCloseTo(startSpan, 12)
  controls.dispose()
})
