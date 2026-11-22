import { Geometry, Mesh, Shader, Texture } from 'pixi.js'
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
// the point of the view in 0–1: where the grid reads the map from the tiles texture
out vec2 vView;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vScreen = aPosition * uSize;
  vView = aPosition;
}
`

// A hairline at every cell edge: half a CSS px, but never thinner than one device pixel,
// antialiased. It fades out when cells get too small to read (no moire when the whole map is in
// view). Away from the spotlight the grid has the opacity uBase (1: the whole grid, 0: only the
// spotlight); around the spotlight it shows fully and fades out towards its edge.
// The line takes its color from the map under it (QnA, 14.11.2026) — the master's grid and the
// players' grid around a dragged token alike: white where the pixel is dark (lightness L* below 50),
// black where it is light. The map is read from uTiles — the picture as it is on screen now.
const fragment = `
in vec2 vScreen;
in vec2 vView;
uniform sampler2D uTiles;
uniform vec2 uCamera;
uniform float uScale;
uniform vec2 uOrigin;
uniform float uCell;
uniform float uDpr;
// the line over dark places and over light ones (not uColor: Pixi binds its own uColor)
uniform vec4 uLight;
uniform vec4 uDark;
// the empty field where the picture does not cover the screen
uniform vec3 uBackground;
// x1, y1, x2, y2 of the picture; x2 < x1 means no picture (endless grid)
uniform vec4 uBounds;
uniform float uBase;
// x, y, radius in image pixels; radius 0 means no spotlight
uniform vec3 uSpot;
out vec4 finalColor;

float lightness(vec3 c) {
  vec3 lin = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  float y = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  return y > 0.008856 ? 116.0 * pow(y, 1.0 / 3.0) - 16.0 : 903.3 * y;
}

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
  // the tiles are premultiplied: what they do not cover is the empty field
  vec4 t = texture(uTiles, vView);
  vec4 line = lightness(t.rgb + (1.0 - t.a) * uBackground) < 50.0 ? uLight : uDark;
  finalColor = line * a;
}
`

/** Colors of the grid (QnA, «Кто видит сетку?»). */
export interface GridLook {
  /** the line over dark and light places of the map */
  light: Paint
  dark: Paint
  /** the empty field around the picture */
  background: Paint
}

export interface GridShow {
  /** the whole grid (the master), or only the spotlight */
  everywhere: boolean
  /** the center of the spotlight in image pixels: a dragged token, or the pointer in the zoomed-out editor */
  spot: { x: number; y: number } | null
  /** radius of the spotlight in image pixels */
  spotRadius: number
}

/** White or black at 30% (QnA, 14.11.2026). */
const OPACITY = 0.3
/** Radius of the spotlight around a dragged token, in cells. */
export const SPOT_CELLS = 4

const premultiplied = (paint: Paint, opacity: number) => {
  const a = paint.alpha * opacity
  return [(((paint.color >> 16) & 255) / 255) * a, (((paint.color >> 8) & 255) / 255) * a, ((paint.color & 255) / 255) * a, a]
}

/** The grid as one full-screen shader: no geometry per line, endless before a picture is loaded. */
export class GridLayer {
  readonly mesh: Mesh<Geometry, Shader>
  private uniforms: Record<string, unknown>
  private shader: Shader

  constructor() {
    const geometry = new Geometry({
      attributes: { aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) },
      indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3])
    })
    this.shader = Shader.from({
      gl: { vertex, fragment, name: 'map-grid' },
      resources: {
        uTiles: Texture.EMPTY.source,
        grid: {
          uSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uCamera: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uScale: { value: 1, type: 'f32' },
          uOrigin: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uCell: { value: 100, type: 'f32' },
          uDpr: { value: 1, type: 'f32' },
          uLight: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
          uDark: { value: new Float32Array([0, 0, 0, 1]), type: 'vec4<f32>' },
          uBackground: { value: new Float32Array([0, 0, 0]), type: 'vec3<f32>' },
          uBounds: { value: new Float32Array([0, 0, -1, -1]), type: 'vec4<f32>' },
          uBase: { value: 1, type: 'f32' },
          uSpot: { value: new Float32Array([0, 0, 0]), type: 'vec3<f32>' }
        }
      }
    })
    this.uniforms = this.shader.resources.grid.uniforms
    this.mesh = new Mesh({ geometry, shader: this.shader })
  }

  /** The picture as it is on screen (a render texture of the view's size): the master's line reads its colors. */
  setTiles(tiles: Texture) {
    this.shader.resources.uTiles = tiles.source
  }

  /**
   * `bounds`: the picture (the grid stays on it) or null (endless grid of the empty editor).
   */
  update(
    camera: Camera, viewW: number, viewH: number, dpr: number, origin: { x: number; y: number }, cell: number,
    bounds: { width: number; height: number } | null, show: GridShow, look: GridLook
  ) {
    const u = this.uniforms as {
      uSize: Float32Array; uCamera: Float32Array; uScale: number; uOrigin: Float32Array; uCell: number; uDpr: number
      uLight: Float32Array; uDark: Float32Array; uBackground: Float32Array; uBounds: Float32Array; uBase: number; uSpot: Float32Array
    }
    this.mesh.scale.set(viewW, viewH)

    u.uBase = show.everywhere ? 1 : 0
    u.uSpot.set(show.spot ? [show.spot.x, show.spot.y, show.spotRadius] : [0, 0, 0])
    u.uSize[0] = viewW
    u.uSize[1] = viewH
    u.uCamera[0] = camera.x
    u.uCamera[1] = camera.y
    u.uScale = camera.scale
    u.uOrigin[0] = origin.x
    u.uOrigin[1] = origin.y
    u.uCell = cell
    u.uDpr = dpr
    u.uLight.set(premultiplied(look.light, OPACITY))
    u.uDark.set(premultiplied(look.dark, OPACITY))
    const bg = premultiplied(look.background, 1)
    u.uBackground.set([bg[0], bg[1], bg[2]])
    u.uBounds.set(bounds ? [0, 0, bounds.width, bounds.height] : [0, 0, -1, -1])
  }

  destroy() {
    this.mesh.destroy()
  }
}
