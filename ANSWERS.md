# Mimar Tech Assessment — Written Answers

---

## Q1 — Vertex Displacement & Normals

### Q1a — GLSL Displacement Expression

```glsl
float amplitude = 0.3;
float frequency = 2.0;
float displacement = amplitude * sin(frequency * uTime);
vec3 displacedPosition = position + normal * displacement;
gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
```

### Q1b — Expression Breakdown

- **`position`** — the original vertex position in local (object) space, provided by Three.js as a built-in attribute.
- **`normal`** — the unit vector perpendicular to the surface at this vertex, also a built-in attribute. Multiplying by it ensures the vertex moves *outward from the surface*, not in a fixed world direction.
- **`amplitude` (0.3)** — the maximum distance (in world units) each vertex travels. Scales the effect; tunable to taste.
- **`frequency` (2.0)** — controls how many full oscillation cycles occur per second. Higher values = faster breathing.
- **`sin(frequency * uTime)`** — oscillates between –1 and +1 over time, producing the smooth in-and-out motion. `uTime` is a uniform updated each frame with elapsed seconds.
- **`amplitude * sin(...)`** — final scalar displacement amount, ranging from `–amplitude` to `+amplitude`.
- **`position + normal * displacement`** — the displaced vertex position: original position shifted along the normal by the computed amount.

I chose `sin` because it's smooth (C∞), periodic, and requires no clamping — vertices return to their origin naturally every cycle.

### Q1c — Why Lighting Breaks and How to Fix It

**Root cause:** The vertex shader has moved the vertices, but the *normals* still reflect the original flat geometry. Lighting calculations (diffuse, specular) use normals to determine the angle between the surface and the light source. Since the normals no longer match the actual displaced surface, the shading is wrong — it looks as if the mesh is still in its original shape while being lit.

**Fix 1 — Recalculate normals analytically in the vertex shader:**
For a known displacement function like `sin`, you can derive the partial derivatives mathematically and construct a new normal. The displaced surface tangents are computed by differentiating the displacement function with respect to the surface coordinates (u, v), and the new normal is their cross product. This is GPU-efficient but requires the math to be tractable.

**Fix 2 — Use a normal map / recompute normals on the CPU before upload:**
After displacing geometry on the CPU side (or after baking a displacement texture), call `geometry.computeVertexNormals()` in Three.js to recalculate all normals from the actual triangle faces. This is simple and robust but only works if the geometry is updated on the CPU — not suitable for real-time GPU-only displacement.

---

## Q2 — Performance Diagnosis

### Q2a — Most Likely Causes (ordered)

1. **Too many draw calls** — 50,000+ individual `Mesh` objects each issue a separate draw call to the GPU driver. The CPU overhead of preparing and dispatching these per-frame is the most common culprit.
2. **Excessive JavaScript-side scene graph traversal** — Three.js iterates the entire scene graph each frame for frustum culling, matrix updates, and render sorting. 50,000 objects creates significant GC pressure and traversal cost.
3. **No frustum culling or over-conservative culling** — If bounding volumes are incorrect or culling is disabled, the CPU submits draw calls for objects entirely outside the camera's view.
4. **Frequent geometry or buffer uploads** — Calling `geometry.needsUpdate = true` or `bufferAttribute.needsUpdate = true` unnecessarily forces GPU re-uploads every frame.
5. **Unthrottled or misused raycasting** — Running `raycaster.intersectObjects()` against 50,000 meshes every frame is an O(n) CPU operation.

### Q2b — Specific Fixes

1. **Draw calls → Use `InstancedMesh`:** Replace all individual `Mesh` objects with a single `THREE.InstancedMesh`. This collapses 50,000 draw calls into one, with per-instance transforms stored in a GPU buffer. Typically reduces CPU time by 10–100×.

2. **Scene graph overhead → Flatten hierarchy + use `BufferGeometry` directly:** Avoid deep parent-child nesting. Merge static geometry with `BufferGeometryUtils.mergeGeometries()` where objects share a material and don't need individual transforms. Alternatively, use object pooling to reduce GC churn.

3. **Frustum culling → Ensure bounding spheres are accurate:** Call `geometry.computeBoundingSphere()` after any geometry change. For instanced meshes, set `mesh.frustumCulled = false` and implement custom culling per-instance in the vertex shader using `gl_Position` clipping, or use a spatial partition (BVH).

4. **Buffer uploads → Guard `needsUpdate`:** Only set `needsUpdate = true` on the frame the data actually changes. Use double-buffering or dirty flags in JavaScript.

5. **Raycasting → Throttle and use BVH:** Run raycasting at most once every 2–3 frames, or only when the mouse has moved. Use `three-mesh-bvh` to reduce intersection cost from O(n triangles) to O(log n).

---

## Q3 — Shader Debugging

### Q3a — What the Shader Does Visually

The shader applies a horizontal wave distortion to a texture. For every fragment, it takes the fragment's UV coordinate and shifts the U (horizontal) component by a sine function applied to the V (vertical) coordinate, scaled by `uTime`. The result is that the texture appears to ripple or undulate horizontally — each row of pixels is offset left or right by a different amount, and the offset animates over time. It looks like a flag waving or a heat-shimmer effect on a flat surface.

### Q3b — The Seam: Where and Why

The seam appears at **UV.x = 1.0** (the right edge of the mesh).

**Mechanism:** The distortion adds up to `±0.05` to `uv.x`. When the original `uv.x` is close to `1.0`, the displaced value can exceed `1.0`. By default, `texture2D` uses `GL_REPEAT` wrapping, so a UV of `1.05` wraps to `0.05`. This causes the sampler to jump from one edge of the texture to the opposite edge, creating a sudden discontinuity — a hard visible seam.

The same can occur near `uv.x = 0.0` when the sine is negative, wrapping to values just below `0.0` → wrapping to near `1.0`.

### Q3c — Two Fixes

**Fix 1 — Use `GL_CLAMP_TO_EDGE` wrapping:**
```js
texture.wrapS = THREE.ClampToEdgeWrapping;
```
Clamping means UVs outside `[0, 1]` sample the edge pixel color instead of wrapping. No seam appears because there's no sudden jump — the edge colour is just held. Trade-off: the edge pixels stretch, which may be visible on strong distortions.

**Fix 2 — Clamp or guard the UV in the shader before sampling:**
```glsl
uv.x = clamp(uv.x, 0.0, 1.0);
gl_FragColor = texture2D(uTexture, uv);
```
This keeps the displaced UV within the valid range, preventing the sampler from wrapping. It's a purely shader-side fix that works regardless of texture settings. The visual trade-off is the same: edge pixels stretch, but for a wave effect with small amplitude (0.05) this is usually imperceptible.

---

## Q4 — Instanced Rendering

### Q4a — Naive Approach

The naive approach is to create one `THREE.Mesh` per box:
```js
for (let i = 0; i < 10000; i++) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...);
  mesh.material.color.set(...);
  scene.add(mesh);
}
```

**Internally,** Three.js issues one WebGL draw call per mesh: `gl.drawElements()` or `gl.drawArrays()`. Each draw call requires the driver to validate state, bind buffers, and dispatch work to the GPU. At 10,000 objects, this means up to 10,000 state-change + dispatch cycles per frame, purely on the CPU/driver side — the GPU may be sitting idle waiting for the next command. Modern GPUs can process geometry far faster than the CPU can feed it commands. At scale, this bottleneck keeps frame rates low even on powerful hardware.

### Q4b — Instanced Approach in Three.js

```js
const mesh = new THREE.InstancedMesh(geometry, material, 10000);
for (let i = 0; i < 10000; i++) {
  dummy.position.set(...);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}
mesh.instanceMatrix.needsUpdate = true;
```

For per-instance color, use an `InstancedBufferAttribute`:
```js
const colors = new Float32Array(10000 * 3);
// fill with RGB values...
geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
```
And read `aColor` inside the vertex shader.

**Why it's faster:** All 10,000 transforms (and colors) are uploaded to the GPU in a single buffer. The GPU then runs the vertex shader 10,000 times internally, reading each instance's matrix from that buffer — with zero additional CPU involvement per instance. The driver issues exactly **one draw call** for all 10,000 boxes, eliminating the CPU bottleneck entirely. The GPU's internal parallelism handles the per-instance variation natively.

### Q4c — Limitations of Instancing

**1. All instances share the same geometry and material.** You cannot easily give individual instances different mesh shapes or different shader programs. If you need 50 boxes and 50 spheres, you need two separate `InstancedMesh`es, not one. Mixing geometry types breaks the single-draw-call model.

**2. Per-instance CPU-side operations are expensive when dynamic.** If instances need to be individually culled, sorted (e.g. for transparency), or physics-simulated, you must update the `instanceMatrix` buffer every frame. For 10,000 objects that all move independently, the CPU cost of writing the buffer can negate the GPU savings. In these scenarios, a compute-shader approach or GPU-side simulation (particles, transform feedback) is more appropriate.

**3. Transparency / sorting.** Instanced rendering renders all instances in buffer order — there's no automatic back-to-front sorting. For translucent instanced objects, you either accept incorrect blending artifacts or implement a custom per-instance depth sort on the CPU, which is costly.

