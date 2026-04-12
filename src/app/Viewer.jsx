import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export default function Viewer({ geometry, generating }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const meshRef = useRef(null)
  const hasInitialFit = useRef(false)
  const rafRef = useRef(null)

  // Set up Three.js scene once
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#111114')

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(40, -30, 50)
    camera.up.set(0, 0, 1)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(20, 15, 2)
    controls.update()

    // Lights
    const ambient = new THREE.AmbientLight('#8890a8', 0.9)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight('#fff5e6', 1.2)
    dirLight.position.set(30, -20, 50)
    scene.add(dirLight)

    // Grid helper
    const gridHelper = new THREE.GridHelper(100, 20, '#222230', '#1a1a24')
    gridHelper.rotation.x = Math.PI / 2
    scene.add(gridHelper)

    function handleResize() {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    const resizeObs = new ResizeObserver(handleResize)
    resizeObs.observe(container)
    handleResize()

    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    sceneRef.current = { scene, camera, controls, renderer }

    return () => {
      cancelAnimationFrame(rafRef.current)
      resizeObs.disconnect()
      renderer.dispose()
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material.dispose()
        }
      })
      container.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [])

  // Update mesh when geometry changes
  useEffect(() => {
    const ctx = sceneRef.current
    if (!ctx) return

    // Remove old mesh
    if (meshRef.current) {
      ctx.scene.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      meshRef.current.material.dispose()
      meshRef.current = null
    }

    if (!geometry) {
      hasInitialFit.current = false
      return
    }

    const material = new THREE.MeshStandardMaterial({
      color: '#c8d4dc',
      metalness: 0.0,
      roughness: 0.75,
      flatShading: true,
    })

    const mesh = new THREE.Mesh(geometry, material)
    ctx.scene.add(mesh)
    meshRef.current = mesh

    // Auto-fit camera on first geometry
    if (!hasInitialFit.current) {
      hasInitialFit.current = true
      fitCamera(ctx.camera, ctx.controls, geometry)
    }
  }, [geometry])

  function handleFitCamera() {
    const ctx = sceneRef.current
    if (!ctx || !meshRef.current) return
    fitCamera(ctx.camera, ctx.controls, meshRef.current.geometry)
  }

  return (
    <div className="viewer-wrap">
      <div className="viewer-canvas" ref={containerRef} />
      {generating && (
        <div className="viewer-overlay">
          <div className="viewer-spinner" />
        </div>
      )}
      <button className="btn-small btn-fit" onClick={handleFitCamera} title="Fit camera">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </button>
    </div>
  )
}

function fitCamera(camera, controls, geometry) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return
  const center = new THREE.Vector3()
  box.getCenter(center)
  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z)
  const dist = maxDim * 2.2

  controls.target.copy(center)
  camera.position.set(center.x + dist * 0.6, center.y - dist * 0.5, center.z + dist * 0.7)
  camera.lookAt(center)
  controls.update()
}
