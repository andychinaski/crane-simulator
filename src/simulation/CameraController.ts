import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { cameraControls, clampControl, controlDefinition, initialValues, type CameraControl, type CameraValues } from '../state/controls'

const center = new THREE.Vector3(2.15, 3.43, -1.20)
const startOffset = new THREE.Vector3(16, 8, 11)
const startAzimuth = Math.atan2(startOffset.x, startOffset.z)
const { degToRad, radToDeg, euclideanModulo } = THREE.MathUtils

export function createCameraController(
  camera: THREE.OrthographicCamera,
  canvas: HTMLCanvasElement,
  onChange: (values: CameraValues) => void,
) {
  const controls = new OrbitControls(camera, canvas)
  const initial = initialValues(cameraControls)
  const values = { ...initial }
  const sphere = new THREE.Spherical()
  const offset = new THREE.Vector3()
  const pan = new THREE.Vector3()
  const screenAxis = new THREE.Vector3()
  const zoom = controlDefinition('cameraZoom')
  let halfWidth = 1
  let halfHeight = 1
  controls.minZoom = zoom.min / 100
  controls.maxZoom = zoom.max / 100
  controls.minPolarAngle = 0.22
  controls.maxPolarAngle = Math.PI / 2 - 0.09
  controls.screenSpacePanning = true
  controls.target.copy(center)
  camera.zoom = initial.cameraZoom / 100
  camera.position.copy(startOffset).applyAxisAngle(camera.up, degToRad(initial.sceneOrbit))
    .add(controls.target)
  controls.update()
  camera.updateMatrixWorld()
  controls.saveState()

  function updateProjection() {
    camera.left = values.cameraPanX - halfWidth
    camera.right = values.cameraPanX + halfWidth
    camera.top = values.cameraPanY + halfHeight
    camera.bottom = values.cameraPanY - halfHeight
    camera.updateProjectionMatrix()
  }

  function sync() {
    // Convert OrbitControls' mouse pan to an offset in the image plane,
    // keeping the orbit centered on the same world-space point.
    camera.updateMatrixWorld()
    pan.subVectors(controls.target, center)
    if (pan.lengthSq() > 0) {
      values.cameraPanX = clampControl('cameraPanX',
        values.cameraPanX + pan.dot(screenAxis.setFromMatrixColumn(camera.matrix, 0)))
      values.cameraPanY = clampControl('cameraPanY',
        values.cameraPanY + pan.dot(screenAxis.setFromMatrixColumn(camera.matrix, 1)))
      camera.position.sub(pan)
      controls.target.copy(center)
      camera.updateMatrixWorld()
    }
    const angle = radToDeg(controls.getAzimuthalAngle() - startAzimuth)
    const wrapped = euclideanModulo(angle + 180, 360) - 180
    values.sceneOrbit = Math.abs(Math.abs(wrapped) - 180) < 1e-8 && values.sceneOrbit > 0 ? 180 : wrapped
    values.cameraZoom = camera.zoom * 100
    updateProjection()
    onChange({ ...values })
  }

  updateProjection()
  controls.addEventListener('change', sync)

  return {
    resize(width: number, height: number) {
      const aspect = width / height
      const heightForAspect = Math.max(4.35, 6.8 / aspect)
      const widthForAspect = heightForAspect * aspect
      if (halfWidth === widthForAspect && halfHeight === heightForAspect) return
      halfWidth = widthForAspect
      halfHeight = heightForAspect
      updateProjection()
    },
    set(id: CameraControl, value: number) {
      if (!Number.isFinite(value)) return
      value = clampControl(id, value)
      values[id] = value
      if (id === 'sceneOrbit') {
        sphere.setFromVector3(offset.copy(camera.position).sub(controls.target))
        sphere.theta = startAzimuth + degToRad(value)
        camera.position.copy(offset.setFromSpherical(sphere).add(controls.target))
        controls.update()
      }
      if (id === 'cameraZoom') camera.zoom = value / 100
      sync()
    },
    reset() {
      Object.assign(values, initial)
      controls.reset()
      sync()
    },
    dispose() {
      controls.removeEventListener('change', sync)
      controls.dispose()
    },
  }
}
