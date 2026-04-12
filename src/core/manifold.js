import Module from 'manifold-3d'

let cached = null

export async function getManifold() {
  if (!cached) {
    const wasm = await Module()
    wasm.setup()
    cached = wasm
  }
  return cached
}
