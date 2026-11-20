export const crateSize = { width: 1.56, height: 1.22, depth: 1.33 }
export const crateStartYaw = 15
export const crateHandleHeight = crateSize.height + 0.29
export const crateSpawnOffset = { x: 0.055, z: -0.055 }
export const deliveryArea = { x: 4.02, z: -5.45, width: 2.15, depth: 1.78 }

// The corner hardware and bolt heads extend beyond the wooden faces.
export const crateHalfFootprint = {
  x: crateSize.width / 2 + 0.068,
  z: crateSize.depth / 2 + 0.078,
}
