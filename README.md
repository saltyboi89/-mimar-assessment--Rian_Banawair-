# Mimar Tech — Frontend 3D Developer Assessment

A real-time WebGL scene built with Vite + Three.js (vanilla JS). Renders 500 instanced boxes as a simplified top-down building floor plan.

## Features

- **500 boxes** via `THREE.InstancedMesh` — zero individual Mesh objects
- **Custom vertex + fragment shaders** — per-instance color via `InstancedBufferAttribute`, passed through GLSL
- **Mouse hover detection** — raycasting against the instanced mesh
- **Shader-based hover response** — animated scale pulse, cyan color shift, and edge outline highlight (bonus)
- **Orbit camera** — drag, scroll, and pan with OrbitControls

## Run Locally

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173)

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deploy

GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys to GitHub Pages automatically on push to `main`.

## Tech Stack

- [Vite](https://vitejs.dev/) — dev server & bundler
- [Three.js](https://threejs.org/) r184 — 3D rendering
- Vanilla JavaScript (ES modules) — no frameworks

---

*Assessment submission for Mimar Tech Frontend 3D Developer role.*
