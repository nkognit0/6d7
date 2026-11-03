import { Geometry, Mesh, Shader } from 'pixi.js'
import type { Camera } from './camera'
import type { Paint } from './theme'

// the quad is scaled to the view by the mesh transform, so the mesh has its real bounds
const vertex = `
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uSize;
out vec2 vScreen;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vScreen = aPosition * uSize;
}
`

// A hairline at every cell edge: half a CSS px, but never thinner than one device pixel,
// antialiased. It fades out when cells get too small to read (no moire when the whole map is in
// view). Away from the spotlight the grid has the opacity uBase (1 for the master, 0 for
// players); around the spotlight it shows fully and fades out towards its edge.
const fragment = `
in vec2 vScreen;
uniform vec2 uCamera;
uniform float uScale;
uniform vec2 uOrigin;
uniform float uCell;
uniform float uDpr;
// not uColor: Pixi binds its own uColor (the mesh tint) under that name
uniform vec4 uLineColor;
// x1, y1, x2, y2 of the picture; x2 < x1 means no picture (endless grid)
uniform vec4 uBounds;
uniform float uBase;
// x, y, radius in image pixels; radius 0 means no spotlight
uniform vec3 uSpot;
out vec4 finalColor;

void main() {
  vec2 world = (vScreen - uCamera) / uScale;
  vec2 g = (world - uOrigin) / uCell;
  float cellScreen = uCell * uScale;
  vec2 d = abs(fract(g + 0.5) - 0.5) * cellScreen * uDpr;
  float width = max(1.0, uDpr * 0.5);
  float a = clamp(width * 0.5 + 0.5 - min(d.x, d.y), 0.0, 1.0);
  a *= smoothstep(4.0, 10.0, cellScreen);
  float k = uBase;
  if (uSpot.z > 0.0) k = max(k, 1.0 - smoothstep(uSpot.z * 0.35, uSpot.z, distance(world, uSpot.xy)));
  a *= k;
  if (uBounds.z >= uBounds.x && (world.x < uBounds.x || world.y < uBounds.y || world.x > uBounds.z || world.y > uBounds.w)) a = 0.0;
  finalColor = uLineColor * a;
}
`

/**
 * Colors of the grid: players see a dark half-transparent line; the master sees a light line in
 * the 'screen' blend mode (it brightens the map under it), readable on dark and mid-tone maps.
 */
export interface GridLook {
  /** the players' dark line */
  paint: Paint
  /** the master's light line */
  contrast: Paint
}

/** The players' grid is half transparent. */
const OPACITY = 0.5
/** The master's grid is a little brighter. */
const MASTER_OPACITY = 0.6
/** Radius of the spotlight around a dragged token, in cells. */
export const SPOT_CELLS = 4

/** The grid as one full-screen shader: no geometry per line, endless before a picture is loaded. */
export class GridLayer {
  readonly mesh: Mesh<Geometry, Shader>
  private uniforms: Record<string, unknown>

  constructor() {
    const geometry = new Geometry({
      attributes: { aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) },
      indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3])
    })
    const shader = Shader.from({
      gl: { vertex, fragment, name: 'map-grid' },
      resources: {
        grid: {
          uSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uCamera: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uScale: { value: 1, type: 'f32' },
          uOrigin: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uCell: { value: 100, type: 'f32' },
          uDpr: { value: 1, type: 'f32' },
          uLineColor: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
          uBounds: { value: new Float32Array([0, 0, -1, -1]), type: 'vec4<f32>' },
          uBase: { value: 1, type: 'f32' },
          uSpot: { value: new Float32Array([0, 0, 0]), type: 'vec3<f32>' }
        }
      }
    })
    this.uniforms = shader.resources.grid.uniforms
    this.mesh = new Mesh({ geometry, shader })
  }

  /**
   * `bounds`: the picture (the grid stays on it) or null (endless grid of the empty editor).
   * `everywhere`: the whole grid is shown (the master); otherwise only the spotlight around
   * `spot`, a dragged token (players), or nothing without it.
   */
  update(
    camera: Camera, viewW: number, viewH: number, dpr: number, origin: { x: number; y: number }, cell: number,
    bounds: { width: number; height: number } | null, everywhere: boolean, spot: { x: number; y: number } | null, look: GridLook
  ) {
    const u = this.uniforms as {
      uSize: Float32Array; uCamera: Float32Array; uScale: number; uOrigin: Float32Array; uCell: number; uDpr: number; uLineColor: Float32Array
      uBounds: Float32Array; uBase: number; uSpot: Float32Array
    }
    this.mesh.blendMode = everywhere ? 'screen' : 'normal'
    this.mesh.scale.set(viewW, viewH)

    u.uBase = everywhere ? 1 : 0
    u.uSpot.set(spot ? [spot.x, spot.y, cell * SPOT_CELLS] : [0, 0, 0])
    u.uSize[0] = viewW
    u.uSize[1] = viewH
    u.uCamera[0] = camera.x
    u.uCamera[1] = camera.y
    u.uScale = camera.scale
    u.uOrigin[0] = origin.x
    u.uOrigin[1] = origin.y
    u.uCell = cell
    u.uDpr = dpr
    // premultiplied
    const paint = everywhere ? look.contrast : look.paint
    const a = paint.alpha * (everywhere ? MASTER_OPACITY : OPACITY)
    u.uLineColor[0] = (((paint.color >> 16) & 255) / 255) * a
    u.uLineColor[1] = (((paint.color >> 8) & 255) / 255) * a
    u.uLineColor[2] = ((paint.color & 255) / 255) * a
    u.uLineColor[3] = a
    u.uBounds.set(bounds ? [0, 0, bounds.width, bounds.height] : [0, 0, -1, -1])
  }

  destroy() {
    this.mesh.destroy()
  }
}
