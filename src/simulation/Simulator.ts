import * as THREE from 'three'
import { craneControls, type CameraControl, type CameraValues, type CraneAxis, type CraneControl } from '../state/controls'
import { createCameraController } from './CameraController'
import { captureOpening, CargoController, type CargoHint, type CargoState } from './CargoController'
import { CraneMotion } from './CraneMotion'
import { DemoSequence, type DemoPhase } from './DemoSequence'
import { buildWorld } from './SceneWorld'

export type RopeContact = 'floor' | 'lid' | 'side' | null
const crateApproachAxes = ['platformYaw', 'boomPitch', 'boomLength', 'gripperOpen'] as const

interface SceneEvents {
  onContextChange: (lost: boolean) => void
  onCameraChange: (values: CameraValues) => void
  onMotionChange: (moving: boolean, ropeMaximum: number, contact: RopeContact) => void
  onCargoChange: (state: CargoState, hint: CargoHint) => void
  onCraneTargetChange: (id: CraneControl, value: number) => void
  onDemoChange: (phase: DemoPhase, running: boolean, pausing: boolean) => void
}

export function mountScene(viewport: HTMLElement, events: SceneEvents) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.domElement.setAttribute('aria-label', 'Жёлтый телескопический кран, ящик и площадка доставки')

  const motion = new CraneMotion()
  const { scene, crane, crate } = buildWorld(motion.actual)
  const cargo = new CargoController(crate)
  const demo = new DemoSequence(targets => {
    for (const [id, value] of Object.entries(targets) as [CraneAxis, number][]) {
      setTarget(id, value)
    }
  })
  const surfaceAt = cargo.surfaceUnderGripper.bind(cargo)
  let sideBlocked = false
  positionCrane()
  cargo.update(crane.model.gripper, motion.actual.gripperOpen, motion.target.gripperOpen)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 205)
  viewport.prepend(renderer.domElement)
  let frame: number | undefined
  let previous: number | undefined

  function requestRender() {
    if (frame === undefined) frame = requestAnimationFrame(render)
  }

  const cameraController = createCameraController(camera, renderer.domElement, values => {
    events.onCameraChange(values)
    requestRender()
  })

  function positionCrane() {
    crane.applyPose(motion.actual, cargo.minimumSuspensionHeight, surfaceAt)
  }

  function limitRope() {
    const requestedLength = motion.target.ropeLength
    motion.limitRope(crane.maxRopeLength)
    if (motion.target.ropeLength !== requestedLength) {
      events.onCraneTargetChange('ropeLength', motion.target.ropeLength)
    }
  }

  function setTarget(id: CraneControl, value: number) {
    sideBlocked = false
    if (id !== 'gripperOpen') cargo.clearReleaseWarning()
    motion.setTarget(id, id === 'ropeLength' ? Math.min(value, crane.maxRopeLength) : value)
    return motion.target[id]
  }

  function publishValues(values: Record<CraneControl, number>) {
    for (const { id } of craneControls) events.onCraneTargetChange(id, values[id])
  }

  function publishDemo() {
    events.onDemoChange(demo.phase, demo.running, demo.pausing)
  }

  function render(time: number) {
    frame = undefined
    if (renderer.getContext().isContextLost()) {
      previous = undefined
      return
    }
    if (motion.moving) {
      const previousPose = { ...motion.actual }
      const wasBesideCrate = crane.crateTop === null
      motion.advance(previous === undefined ? 0 : (time - previous) / 1000)
      const minimumHeight = cargo.minimumSuspensionHeight
      positionCrane()
      if (wasBesideCrate && crane.crateTop !== null && motion.actual.ropeLength > crane.maxRopeLength + 1e-8) {
        // Reject entry through a side without lifting the gripper in one frame.
        sideBlocked = true
        for (const id of crateApproachAxes) {
          if (motion.actual[id] === previousPose[id]) continue
          motion.actual[id] = previousPose[id]
          motion.setTarget(id, previousPose[id])
          events.onCraneTargetChange(id, previousPose[id])
        }
        positionCrane()
      }
      limitRope()
      const interaction = cargo.update(crane.model.gripper, motion.actual.gripperOpen, motion.target.gripperOpen)
      if (interaction === 'block-opening') {
        const heldOpening = Math.min(previousPose.gripperOpen, captureOpening)
        motion.actual.gripperOpen = previousPose.gripperOpen
        motion.setTarget('gripperOpen', heldOpening)
        positionCrane()
        limitRope()
        events.onCraneTargetChange('gripperOpen', heldOpening)
      } else if (cargo.minimumSuspensionHeight !== minimumHeight) {
        positionCrane()
        limitRope()
      }
      renderer.shadowMap.needsUpdate = true
    }
    const wasDemonstrating = demo.running
    demo.update({ moving: motion.moving, cargo: cargo.state, hint: cargo.hint, ropeMaximum: crane.maxRopeLength }, time)
    if (wasDemonstrating) publishValues(motion.actual)
    publishDemo()
    events.onCargoChange(cargo.state, cargo.hint)
    const contact = sideBlocked ? 'side' : crane.crateLimited ? 'lid' : crane.floorLimited ? 'floor' : null
    events.onMotionChange(motion.moving, crane.maxRopeLength, contact)
    previous = motion.moving ? time : undefined
    if (motion.moving || demo.running) requestRender()

    const width = viewport.clientWidth
    const height = viewport.clientHeight
    if (!width || !height) return
    cameraController.resize(width, height)
    const pixelRatio = renderer.getPixelRatio()
    if (renderer.domElement.width !== Math.floor(width * pixelRatio) ||
      renderer.domElement.height !== Math.floor(height * pixelRatio)) renderer.setSize(width, height, false)
    renderer.render(scene, camera)
    renderer.domElement.dataset.ready = 'true'
  }
  const onLost = () => events.onContextChange(true)
  const onRestored = () => {
    renderer.shadowMap.needsUpdate = true
    events.onContextChange(false)
    requestRender()
  }
  const observer = new ResizeObserver(requestRender)
  observer.observe(viewport)
  renderer.domElement.addEventListener('webglcontextlost', onLost)
  renderer.domElement.addEventListener('webglcontextrestored', onRestored)
  requestRender()

  function dispose() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    observer.disconnect()
    cameraController.dispose()
    renderer.domElement.removeEventListener('webglcontextlost', onLost)
    renderer.domElement.removeEventListener('webglcontextrestored', onRestored)
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    const textures = new Set<THREE.Texture>()
    scene.traverse(object => {
      if (object instanceof THREE.Light && object.shadow) object.shadow.dispose()
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return
      geometries.add(object.geometry)
      const list = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of list) {
        materials.add(material)
        if (material instanceof THREE.MeshStandardMaterial && material.map) textures.add(material.map)
      }
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of textures) texture.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }

  return {
    setCraneTarget(id: CraneControl, value: number) {
      if (demo.running) return motion.target[id]
      demo.phase = 'idle'
      const accepted = setTarget(id, value)
      requestRender()
      return accepted
    },
    startDemo() {
      if (demo.running) return
      motion.resetPose()
      cargo.reset()
      positionCrane()
      limitRope()
      cargo.update(crane.model.gripper, motion.actual.gripperOpen, motion.target.gripperOpen)
      renderer.shadowMap.needsUpdate = true
      publishValues(motion.target)
      previous = undefined
      demo.start()
      publishDemo()
      requestRender()
    },
    stopDemo() {
      if (!demo.running) return
      demo.stop()
      motion.stop()
      previous = undefined
      publishValues(motion.target)
      publishDemo()
      requestRender()
    },
    setCamera(id: CameraControl, value: number) { cameraController.set(id, value) },
    resetCamera: cameraController.reset,
    dispose,
  }
}
