import * as THREE from 'three'
import { buildCrane } from './CraneModel'
import { CraneRig } from './CraneRig'
import type { CranePose } from '../state/controls'
import { crateHandleHeight, crateSize, crateSpawnOffset, crateStartYaw, deliveryArea } from './cargoGeometry'
import { box, cylinder, metal, part } from './geometry'

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function canvasTexture(size: number, paint: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D unavailable')
  paint(context)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function concreteTexture(base: number) {
  const random = seededRandom(1732)
  const texture = canvasTexture(256, context => {
    context.fillStyle = `rgb(${base}, ${base + 5}, ${base + 10})`
    context.fillRect(0, 0, 256, 256)
    for (let index = 0; index < 1000; index++) {
      const x = random() * 256
      const y = random() * 256
      const radius = 2 + random() ** 2 * 20
      const shade = random() > 0.5 ? 255 : 0
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius)
      gradient.addColorStop(0, `rgba(${shade}, ${shade}, ${shade}, 0.029)`)
      gradient.addColorStop(1, `rgba(${shade}, ${shade}, ${shade}, 0)`)
      for (const dx of [-256, 0, 256]) {
        for (const dy of [-256, 0, 256]) {
          if (x + dx + radius < 0 || x + dx - radius > 256 ||
            y + dy + radius < 0 || y + dy - radius > 256) continue
          context.save()
          context.translate(x + dx, y + dy)
          context.fillStyle = gradient
          context.fillRect(-radius, -radius, radius * 2, radius * 2)
          context.restore()
        }
      }
    }
    for (let index = 0; index < 2400; index++) {
      context.fillStyle = random() > 0.55 ? '#0b15211a' : '#fff3d717'
      context.fillRect(random() * 256, random() * 256, random() * 1.9, random() * 1.4)
    }
  })
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

function woodTexture() {
  const random = seededRandom(4972)
  return canvasTexture(256, context => {
    context.fillStyle = '#b58c64'
    context.fillRect(0, 0, 256, 256)
    for (let index = 0; index < 1500; index++) {
      const x = random() * 320 - 65
      const y = random() * 256
      const length = 5 + random() * 130
      context.strokeStyle = random() > 0.5 ? '#5537203d' : '#fce0b54a'
      context.lineWidth = 0.4 + random() * 2.1
      context.beginPath()
      context.moveTo(x, y)
      context.bezierCurveTo(x + length * 0.32, y + 4, x + length * 0.7, y - 3, x + length, y)
      context.stroke()
    }
  })
}

function buildCrate(scene: THREE.Scene, x: number, z: number) {
  const crate = new THREE.Group()
  crate.name = 'cargoCrate'
  crate.position.set(x, 0, z)
  crate.rotation.y = THREE.MathUtils.degToRad(crateStartYaw)
  scene.add(crate)

  const { width, depth, height } = crateSize
  const grain = woodTexture()
  const planks = [0xe3c6a9, 0xcdae91, 0xdab697, 0xe0bf9d].map(color =>
    new THREE.MeshStandardMaterial({ color, map: grain, roughness: 0.83 }))
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x65472f, roughness: 0.9 })
  const darkSteel = metal(0x46515b, 0.55)
  const steel = metal(0xa0aab2, 0.70, 0.29)
  box(crate, darkWood, [width - 0.035, height - 0.04, depth - 0.035], [0, height / 2, 0])

  for (let index = 0; index < planks.length; index++) {
    const plankHeight = (height - 0.10) / planks.length
    const y = 0.035 + plankHeight * (index + 0.5)
    const material = planks[index]
    for (const side of [-1, 1]) {
      box(crate, material, [width, plankHeight - 0.013, 0.042], [0, y, side * depth / 2], 0.007)
      const sidePlank = box(crate, material, [depth, plankHeight - 0.013, 0.042],
        [side * width / 2, y, 0], 0.007)
      sidePlank.rotation.y = Math.PI / 2
    }
    const lid = box(crate, material, [width, depth / 4 - 0.007, 0.066],
      [0, height - 0.034, depth * ((index + 0.5) / 4 - 0.5)], 0.008)
    lid.rotation.x = -Math.PI / 2
  }

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cornerX = sx * (width / 2 - 0.055)
      const cornerZ = sz * (depth / 2 - 0.055)
      const batten = box(crate, planks[0], [height, 0.105, 0.035],
        [cornerX, height / 2, sz * (depth / 2 + 0.031)], 0.009)
      batten.rotation.z = Math.PI / 2
      box(crate, planks[0], [0.04, height, 0.105],
        [sx * (width / 2 + 0.028), height / 2, cornerZ], 0.008)
      for (const y of [0.077, height - 0.083]) {
        box(crate, darkSteel, [0.17, 0.145, 0.030],
          [sx * (width / 2 - 0.057), y, sz * (depth / 2 + 0.052)], 0.012)
        box(crate, darkSteel, [0.028, 0.145, 0.15],
          [sx * (width / 2 + 0.044), y, sz * (depth / 2 - 0.047)], 0.010)
        for (const offset of [-0.036, 0.036]) {
          const bolt = cylinder(crate, steel, 0.017, 0.012,
            [cornerX + offset, y + offset, sz * (depth / 2 + 0.072)], 12)
          bolt.rotation.x = Math.PI / 2
          const sideBolt = cylinder(crate, steel, 0.017, 0.012,
            [sx * (width / 2 + 0.062), y + offset, cornerZ + offset], 12)
          sideBolt.rotation.z = Math.PI / 2
        }
      }
    }
  }

  for (const sign of [-1, 1]) {
    box(crate, darkSteel, [0.20, 0.035, 0.23], [sign * 0.29, height + 0.012, 0], 0.016)
    for (const offset of [-0.073, 0.073]) cylinder(crate, steel, 0.019, 0.02,
      [sign * 0.29, height + 0.035, offset], 10)
  }
  const handle = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.29, height + 0.034, 0),
    new THREE.Vector3(-0.24, height + 0.21, 0),
    new THREE.Vector3(0, crateHandleHeight, 0),
    new THREE.Vector3(0.24, height + 0.21, 0),
    new THREE.Vector3(0.29, height + 0.034, 0),
  ])
  part(crate, new THREE.TubeGeometry(handle, 36, 0.047, 12, false), steel)
  return crate
}

function buildDeliveryZone(scene: THREE.Scene) {
  const { width, depth, x, z } = deliveryArea
  const zone = new THREE.Group()
  zone.name = 'deliveryZone'
  zone.position.set(x, 0.012, z)
  scene.add(zone)
  box(zone, new THREE.MeshBasicMaterial({ color: 0x69d9ba, transparent: true, opacity: 0.19 }),
    [width, 0.004, depth], [0, 0, 0], 0).castShadow = false
  const outline = new THREE.MeshBasicMaterial({ color: 0x69d9ba })
  for (const sign of [-1, 1]) {
    box(zone, outline, [width, 0.007, 0.038], [0, 0.004, sign * depth / 2], 0).castShadow = false
    box(zone, outline, [0.038, 0.007, depth], [sign * width / 2, 0.004, 0], 0).castShadow = false
  }
}

export function buildWorld(initialPose: CranePose) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x667480)
  scene.fog = new THREE.FogExp2(0x667480, 0.017)
  const floorTexture = concreteTexture(86)
  floorTexture.repeat.set(81, 81)
  const floor = part(scene, new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.92 }))
  floor.rotation.x = -Math.PI / 2
  floor.castShadow = false
  const grid = new THREE.GridHelper(240, 96, 0xabbac9, 0xabbac9)
  grid.position.set(-0.70, 0.003, -0.42)
  grid.material.transparent = true
  grid.material.opacity = 0.42
  grid.material.depthWrite = false
  scene.add(grid)

  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(132), roughness: 0.89 })
  const crane = new CraneRig(buildCrane(scene, concrete))
  crane.applyPose(initialPose)
  const crate = buildCrate(scene, crane.ropeAnchor.x + crateSpawnOffset.x, crane.ropeAnchor.z + crateSpawnOffset.z)
  buildDeliveryZone(scene)

  scene.add(new THREE.HemisphereLight(0xe5f0ff, 0x9da5ae, 1.85))
  const sunlight = new THREE.DirectionalLight(0xfff4df, 2.75)
  sunlight.position.set(10, 13, 5)
  sunlight.target.position.set(1, 0, -1)
  sunlight.castShadow = true
  sunlight.shadow.mapSize.set(2048, 2048)
  sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = -9
  sunlight.shadow.camera.right = sunlight.shadow.camera.top = 9
  sunlight.shadow.camera.far = 31
  sunlight.shadow.normalBias = 0.025
  sunlight.shadow.bias = -0.00005
  sunlight.shadow.radius = 4
  scene.add(sunlight, sunlight.target)
  const fill = new THREE.DirectionalLight(0xe4edff, 0.65)
  fill.position.set(-2, 4, 9)
  scene.add(fill)
  return { scene, crane, crate }
}
