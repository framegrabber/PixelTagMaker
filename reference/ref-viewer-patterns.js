/**
 * REFERENCE: Three.js viewer patterns & anti-patterns from apc-invaders
 *
 * These patterns were learned through debugging OOM crashes and
 * camera reset issues. Apply them in PixelTagMaker's Viewer.jsx.
 */

// ═══════════════════════════════════════════════════════════════════
// PATTERN 1: Static objects outside the render loop
// ═══════════════════════════════════════════════════════════════════
//
// BAD (caused OOM — 120 allocations/second):
//   function animate() {
//     renderer.render({
//       entities: [
//         { type: 'grid', size: [200, 200] },  // NEW object every frame!
//         { type: 'axis', size: 100 },           // NEW object every frame!
//         ...modelEntities,
//       ],
//     })
//     requestAnimationFrame(animate)
//   }
//
// GOOD:
//   const gridHelper = new THREE.GridHelper(200, 20);
//   const axisHelper = new THREE.AxesHelper(100);
//   scene.add(gridHelper, axisHelper);  // Added ONCE
//
//   function animate() {
//     renderer.render(scene, camera);  // No allocations
//     requestAnimationFrame(animate)
//   }

// ═══════════════════════════════════════════════════════════════════
// PATTERN 2: Camera auto-fit only on first geometry load
// ═══════════════════════════════════════════════════════════════════
//
// BAD (camera jumps every time user adjusts a slider):
//   useEffect(() => {
//     camera.fitToObject(mesh);  // Resets zoom/rotation on EVERY update
//   }, [geometry])
//
// GOOD:
//   const hasInitialFit = useRef(false);
//   useEffect(() => {
//     if (!hasInitialFit.current) {
//       hasInitialFit.current = true;
//       camera.fitToObject(mesh);
//     }
//   }, [geometry])
//
// Provide an explicit "Fit" button for the user to re-center manually.

// ═══════════════════════════════════════════════════════════════════
// PATTERN 3: Use refs for Three.js state, not React state
// ═══════════════════════════════════════════════════════════════════
//
// BAD (React re-renders fight with requestAnimationFrame):
//   const [rotation, setRotation] = useState(0);
//   function animate() {
//     setRotation(r => r + 0.01);  // Triggers React re-render 60x/sec!
//   }
//
// GOOD:
//   const sceneRef = useRef(null);
//   // All mutable Three.js state lives in the ref
//   // Only update React state for UI elements (loading, error, etc.)

// ═══════════════════════════════════════════════════════════════════
// PATTERN 4: Debounced geometry generation
// ═══════════════════════════════════════════════════════════════════
//
// When the user is painting rapidly, don't regenerate on every cell change.
//
// useEffect with debounce:
//   const timerRef = useRef(null);
//   const counterRef = useRef(0);
//
//   useEffect(() => {
//     if (timerRef.current) clearTimeout(timerRef.current);
//     const id = ++counterRef.current;
//
//     timerRef.current = setTimeout(() => {
//       if (id !== counterRef.current) return;  // Stale, skip
//       const mesh = generateMesh(grid, params);
//       setGeometry(mesh);
//     }, 300);
//
//     return () => clearTimeout(timerRef.current);
//   }, [grid, params]);

// ═══════════════════════════════════════════════════════════════════
// PATTERN 5: Trackpad-friendly zoom
// ═══════════════════════════════════════════════════════════════════
//
// Three.js OrbitControls handles this well out of the box.
// If using custom wheel handling:
//
// BAD (fixed delta — too fast on trackpad):
//   const zoomDelta = e.deltaY > 0 ? 0.05 : -0.05;
//
// GOOD (proportional to actual scroll, clamped):
//   const raw = e.deltaY * 0.0003;
//   const zoomDelta = Math.max(-0.02, Math.min(0.02, raw));

// ═══════════════════════════════════════════════════════════════════
// PATTERN 6: Cleanup on unmount
// ═══════════════════════════════════════════════════════════════════
//
//   useEffect(() => {
//     const renderer = new THREE.WebGLRenderer({ canvas });
//     // ... setup scene, camera, controls ...
//
//     return () => {
//       cancelAnimationFrame(rafRef.current);
//       renderer.dispose();
//       // Dispose geometries and materials to free GPU memory
//       scene.traverse(obj => {
//         if (obj.geometry) obj.geometry.dispose();
//         if (obj.material) obj.material.dispose();
//       });
//     };
//   }, []);
