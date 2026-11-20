import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export function part(
  parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,
  x = 0, y = 0, z = 0,
) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function box(
  parent: THREE.Object3D, material: THREE.Material, size: number[], position: number[], bevel = 0.018,
) {
  const [width, height, depth] = size
  const [x, y, z] = position
  const geometry = bevel > 0
    ? new RoundedBoxGeometry(width, height, depth, 2, bevel)
    : new THREE.BoxGeometry(width, height, depth)
  return part(parent, geometry, material, x, y, z)
}

export function cylinder(
  parent: THREE.Object3D, material: THREE.Material, radius: number, height: number,
  position: number[], sides = 32, topRadius = radius,
) {
  const [x, y, z] = position
  return part(parent, new THREE.CylinderGeometry(topRadius, radius, height, sides), material, x, y, z)
}

export function shaft(
  parent: THREE.Object3D, material: THREE.Material, radius: number, start: number[], end: number[],
  sides = 16,
) {
  const from = new THREE.Vector3(...start)
  const to = new THREE.Vector3(...end)
  const center = from.clone().lerp(to, 0.5)
  const direction = to.sub(from)
  const mesh = cylinder(parent, material, radius, direction.length(), center.toArray(), sides)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return mesh
}

export function metal(color: number, metalness = 0.28, roughness = 0.42) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness })
}
