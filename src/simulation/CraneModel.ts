import * as THREE from 'three'
import { initialValue } from '../state/controls'
import { box, cylinder, metal, part, shaft } from './geometry'

const radians = THREE.MathUtils.degToRad

function clevis(
  parent: THREE.Object3D, steel: THREE.Material, cap: THREE.Material,
  x: number, y: number, halfWidth: number, radius: number,
) {
  shaft(parent, steel, radius, [x, y, -halfWidth], [x, y, halfWidth], 24)
  for (const side of [-1, 1]) {
    shaft(parent, cap, radius * 0.66, [x, y, side * halfWidth],
      [x, y, side * (halfWidth + 0.035)], 12)
  }
}

export function buildCrane(scene: THREE.Scene, concrete: THREE.Material) {
  const yellow = metal(0xf5b400, 0.12, 0.36)
  const trim = metal(0xffbd0b, 0.15, 0.32)
  const darkYellow = metal(0xb97b02)
  const graphite = metal(0x333b43, 0.43)
  const dark = metal(0x1c232b, 0.35)
  const steel = metal(0x7b8996, 0.64, 0.32)
  const chrome = metal(0xa2acb3, 0.68, 0.23)
  const orange = metal(0xed7416, 0.21, 0.32)
  const orangeDark = metal(0xa9410a)

  const base = new THREE.Group()
  base.name = 'craneBase'
  scene.add(base)
  box(base, concrete, [2.82, 0.52, 2.6], [0, 0.26, 0], 0.029)
  cylinder(base, dark, 1.055, 0.10, [0, 0.56, 0], 12)
  cylinder(base, trim, 1.075, 0.11, [0, 0.65, 0], 12)
  const columnLift = 0.55
  cylinder(base, yellow, 0.70, 1.04 + columnLift, [0, 1.18 + columnLift / 2, 0], 48, 0.72)
  cylinder(base, trim, 0.845, 0.11, [0, 1.73 + columnLift, 0])
  cylinder(base, graphite, 0.793, 0.22, [0, 1.86 + columnLift, 0], 48)
  cylinder(base, dark, 0.765, 0.095, [0, 2.015 + columnLift, 0], 48)

  const gusset = new THREE.Shape()
  gusset.moveTo(0.64, 0.70)
  gusset.lineTo(1.00, 0.70)
  gusset.lineTo(0.67, 1.07)
  gusset.closePath()
  const gussetGeometry = new THREE.ExtrudeGeometry(gusset, {
    depth: 0.045, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.009, bevelThickness: 0.009,
  })
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4
    const x = 0.94 * Math.cos(angle)
    const z = 0.94 * Math.sin(angle)
    const brace = new THREE.Group()
    brace.rotation.y = -angle
    base.add(brace)
    part(brace, gussetGeometry, trim, 0, 0, -0.022)
    cylinder(base, graphite, 0.086, 0.020, [x, 0.716, z], 12)
    cylinder(base, steel, 0.061, 0.056, [x, 0.753, z], 6)
    cylinder(base, dark, 0.034, 0.025, [x, 0.790, z], 12)
  }
  const toothGeometry = new THREE.BoxGeometry(0.065, 0.085, 0.035)
  for (let index = 0; index < 64; index++) {
    const angle = index * Math.PI / 32
    const tooth = part(base, toothGeometry, dark,
      0.793 * Math.cos(angle), 1.924 + columnLift, 0.793 * Math.sin(angle))
    tooth.rotation.y = -angle
  }

  const platform = new THREE.Group()
  platform.name = 'slewingPlatform'
  platform.position.y = columnLift
  base.add(platform)
  box(platform, dark, [2.42, 0.15, 1.87], [-0.11, 2.10, 0], 0.063)
  box(platform, graphite, [2.47, 0.10, 1.93], [-0.11, 2.21, 0], 0.044)
  box(platform, yellow, [1.23, 0.83, 1.46], [-0.62, 2.66, 0], 0.045)
  box(platform, trim, [1.27, 0.052, 1.49], [-0.62, 3.08, 0], 0.017)
  box(platform, graphite, [0.92, 0.39, 1.06], [-0.69, 3.29, 0], 0.036)
  box(platform, dark, [0.96, 0.047, 1.10], [-0.69, 3.50, 0], 0.016)
  cylinder(platform, dark, 0.108, 0.055, [-0.92, 3.55, 0.26], 16)
  cylinder(platform, steel, 0.074, 0.025, [-0.92, 3.59, 0.26], 16)
  cylinder(platform, dark, 0.068, 0.06, [-0.59, 3.55, 0.23], 16)
  for (const side of [-1, 1]) {
    box(platform, darkYellow, [0.66, 0.55, 0.025], [-0.66, 2.66, side * 0.733], 0.012)
    box(platform, yellow, [0.61, 0.51, 0.029], [-0.66, 2.66, side * 0.745], 0.011)
    box(platform, graphite, [0.18, 0.035, 0.034], [-0.79, 2.80, side * 0.767], 0.005)
    for (let i = 0; i < 6; i++) {
      box(platform, dark, [0.23, 0.018, 0.012], [-0.57, 3.18 + i * 0.043, side * 0.544], 0.003)
    }
    for (const x of [-1.29, -0.70, -0.12, 0.47, 1.06]) {
      shaft(platform, graphite, 0.025, [x, 2.24, side * 0.91], [x, 2.85, side * 0.91])
      box(platform, steel, [0.080, 0.065, 0.049], [x, 2.20, side * 0.966], 0.008)
    }
    for (const height of [2.54, 2.85]) {
      shaft(platform, graphite, 0.023, [-1.29, height, side * 0.91], [1.06, height, side * 0.91])
    }
  }
  for (const height of [2.54, 2.85]) {
    shaft(platform, graphite, 0.023, [-1.29, height, -0.91], [-1.29, height, 0.91])
  }

  const pivot = new THREE.Vector3(0.27, 3.13, 0)
  const support = new THREE.Shape()
  support.moveTo(-0.12, 2.25)
  support.lineTo(0.77, 2.25)
  support.lineTo(0.53, 3.17)
  support.quadraticCurveTo(0.49, 3.38, 0.25, 3.37)
  support.lineTo(0.09, 3.28)
  support.closePath()
  const supportGeometry = new THREE.ExtrudeGeometry(support, {
    depth: 0.084, bevelSize: 0.018, bevelThickness: 0.014, bevelSegments: 2,
  })
  for (const z of [-0.39, 0.306]) part(platform, supportGeometry, yellow, 0, 0, z)
  clevis(platform, darkYellow, steel, pivot.x, pivot.y, 0.455, 0.13)
  clevis(platform, graphite, steel, 0.69, 2.43, 0.30, 0.135)

  const boom = new THREE.Group()
  boom.name = 'boomPivot'
  boom.position.copy(pivot)
  platform.add(boom)

  const tipX = initialValue('boomLength')
  const segments = [
    { start: -0.30, end: tipX - 3.55, depth: 0.70, height: 0.66 },
    { start: tipX - 4.20, end: tipX - 2.30, depth: 0.55, height: 0.51 },
    { start: tipX - 2.96, end: tipX - 1.15, depth: 0.43, height: 0.40 },
    { start: tipX - 1.80, end: tipX + 0.02, depth: 0.32, height: 0.30 },
  ]
  const sections = segments.map(({ start, end, depth, height }, index) => {
    const section = new THREE.Group()
    section.name = `boomSection${index + 1}`
    section.position.x = start
    boom.add(section)
    const length = end - start
    box(section, yellow, [length, height, depth], [length / 2, 0, 0], 0.035)
    box(section, trim, [length - 0.12, 0.026, 0.06], [length / 2, height / 2, depth * 0.32], 0.01)
    if (index < segments.length - 1) {
      box(section, darkYellow, [0.043, height + 0.032, depth + 0.033], [length - 0.025, 0, 0], 0.012)
      box(section, trim, [0.12, height + 0.063, depth + 0.061], [length - 0.10, 0, 0], 0.022)
      for (const side of [-1, 1]) {
        box(section, darkYellow, [0.32, 0.079, 0.028], [length - 0.28, -height * 0.31, side * depth / 2], 0.010)
      }
    }
    return { section, start }
  })

  const hydraulicJoint = new THREE.Vector3(2.52, -0.35, 0)
  clevis(boom, darkYellow, steel, hydraulicJoint.x, hydraulicJoint.y, 0.42, 0.115)
  const rodEnd = hydraulicJoint.clone()
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), radians(initialValue('boomPitch'))).add(pivot)
  const rodBase = new THREE.Vector3(0.69, 2.43, 0)
  const initialHydraulicLength = rodBase.distanceTo(rodEnd)
  const barrelLength = 0.68 * initialHydraulicLength
  const hydraulic = new THREE.Group()
  hydraulic.name = 'hydraulicCylinder'
  hydraulic.position.copy(rodBase)
  platform.add(hydraulic)
  cylinder(hydraulic, graphite, 0.15, barrelLength, [0, barrelLength / 2, 0], 16)
  const piston = cylinder(hydraulic, chrome, 0.079, 1, [0, 0, 0], 16)
  piston.name = 'hydraulicPiston'
  for (const t of [0.12, 0.52, 0.65]) {
    cylinder(hydraulic, steel, 0.157, 0.026 * initialHydraulicLength,
      [0, (t + 0.013) * initialHydraulicLength, 0], 16)
  }
  const hosePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.45, 3.19, 0.41), new THREE.Vector3(-0.15, 3.31, 0.435),
    new THREE.Vector3(0.08, 3.24, 0.44), new THREE.Vector3(0.32, 2.85, 0.445),
    new THREE.Vector3(0.55, 2.49, 0.31),
  ])
  part(platform, new THREE.TubeGeometry(hosePath, 24, 0.025, 8, false), dark)

  const pulley = new THREE.Group()
  pulley.name = 'boomTip'
  pulley.position.set(tipX, 0, 0)
  boom.add(pulley)
  for (const z of [-0.165, 0.165]) {
    shaft(pulley, graphite, 0.212, [0, 0, z - 0.045], [0, 0, z + 0.045], 36)
    box(pulley, trim, [0.31, 0.35, 0.065], [-0.13, 0, z * 1.52], 0.048)
  }
  shaft(pulley, dark, 0.168, [0, 0, -0.15], [0, 0, 0.15], 36)
  clevis(pulley, steel, dark, -0.013, 0, 0.286, 0.054)

  const rope = cylinder(scene, dark, 0.024, 1, [0, 0, 0], 12)
  rope.name = 'verticalRope'

  const gripper = new THREE.Group()
  gripper.name = 'gripperRoot'
  scene.add(gripper)

  const ring = part(gripper, new THREE.TorusGeometry(0.095, 0.024, 12, 32), steel, 0, -0.09, 0)
  ring.scale.y = 1.18
  cylinder(gripper, dark, 0.064, 0.14, [0, -0.26, 0], 16)
  cylinder(gripper, orange, 0.245, 0.29, [0, -0.455, 0], 16, 0.116)
  cylinder(gripper, orangeDark, 0.282, 0.10, [0, -0.615, 0], 16)
  cylinder(gripper, orange, 0.305, 0.052, [0, -0.573, 0], 16)
  cylinder(gripper, graphite, 0.104, 0.21, [0, -0.76, 0], 16)

  const claw = new THREE.Shape()
  claw.moveTo(0.20, -0.60)
  claw.bezierCurveTo(0.39, -0.61, 0.65, -0.81, 0.67, -1.00)
  claw.quadraticCurveTo(0.69, -1.20, 0.50, -1.42)
  claw.bezierCurveTo(0.54, -1.27, 0.53, -1.12, 0.48, -1.04)
  claw.quadraticCurveTo(0.41, -0.90, 0.20, -0.78)
  claw.closePath()
  const clawGeometry = new THREE.ExtrudeGeometry(claw, {
    depth: 0.094, bevelEnabled: true, bevelSize: 0.019, bevelThickness: 0.012,
    bevelSegments: 2, curveSegments: 14,
  })
  clawGeometry.translate(-0.20, 0.60, -0.047)
  const movingClaws: THREE.Mesh[] = []
  for (let index = 0; index < 4; index++) {
    const hinge = new THREE.Group()
    hinge.name = `claw${index + 1}`
    hinge.rotation.y = index * Math.PI / 2
    gripper.add(hinge)
    movingClaws.push(part(hinge, clawGeometry, orange, 0.20, -0.60, 0))
    clevis(hinge, orangeDark, steel, 0.27, -0.665, 0.078, 0.046)
    shaft(hinge, orange, 0.034, [0.10, -0.33, 0], [0.22, -0.55, 0])
  }
  return {
    base, platform, boom, sections, pulley, hydraulicJoint, hydraulic, piston, barrelLength,
    rope, gripper, movingClaws, clawGeometry,
  }
}

export type CraneModel = ReturnType<typeof buildCrane>
