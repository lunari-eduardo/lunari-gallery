

## Add 3D Orbital Background to Dashboard

### Overview
Replace the current animated blob background in `DashboardBackground` with a Three.js 3D orbital scene using `@react-three/fiber` and `@react-three/drei`. The scene will feature 4 torus rings and 3 orbiting spheres in terra-cotta tones, layered behind the existing gradient, glow zones, and noise overlay.

### Dependencies to Install
- `three@>=0.133`
- `@react-three/fiber@^8.18`
- `@react-three/drei@^9.122.0`

### Changes to `src/pages/Home.tsx`

**Replace the `DashboardBackground` component** with a layered structure:

1. **Base gradient div** (unchanged) — `linear-gradient(135deg, #fdf0e6, #f5dcc4, #fdf0e6)` light / `#0a0608, #1a0f08, #0d0705` dark
2. **3D Canvas** — `<Canvas>` from R3F, positioned absolute inset-0, transparent background (`gl={{ alpha: true }}`):
   - 4 `<Torus>` rings at radius 6.0 with varied inclinations (rotations on X/Z), slowly rotating on Y axis at ~0.032 rad/s via `useFrame`
   - Ring colors: `#c2956a`, `#d2691e`, `#cd853f`, `#b8652a` — `MeshBasicMaterial` with opacity 0.10-0.22 (light) / lower in dark
   - 3 `<Sphere>` meshes orbiting along the torus paths using sine/cosine position updates in `useFrame`
   - Camera: `position={[0, 0, 12]}`, `fov={50}`
   - Respect `prefers-reduced-motion`: skip rotation updates if reduced motion is preferred
3. **3 radial glow zones** — `radial-gradient` divs with terra-cotta colors, blur 80-100px, opacity 0.04-0.08
4. **SVG noise overlay** — `feTurbulence fractalNoise baseFrequency=0.65`, opacity 0.02

The 3D scene component (`OrbitalScene`) will be a separate function within the file containing the torus/sphere meshes and `useFrame` logic.

### Files
- **Edit**: `src/pages/Home.tsx` — replace `DashboardBackground` function only; all dashboard data logic unchanged
- **No other files modified** — edge functions, Layout, other pages untouched

