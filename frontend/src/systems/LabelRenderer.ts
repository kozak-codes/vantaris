import * as THREE from 'three';

/**
 * Generic 3D label rendered as a Three.js sprite (so it lives inside the WebGL
 * scene and moves in lockstep with the objects it labels — no DOM sync jitter).
 *
 * - Renders above other objects (depthTest: false, depthWrite: false) so labels
 *   never get hidden behind terrain/spacecraft.
 * - Scales smoothly with camera distance so text stays a constant on-screen
 *   size regardless of zoom level.
 * - Supports an optional background color and tooltip-style error appearance
 *   (red bg) for the landing ghost validation feedback.
 *
 * Create via `LabelRenderer.createLabel(text, opts)` and add the returned
 * sprite to your scene/group. Call `labelRenderer.update(camera)` each frame
 * to rescale all managed labels based on distance to the camera.
 */

export interface LabelOptions {
  /** Text color (hex). Default #aabbcc. */
  color?: string;
  /** Background color (hex with alpha) or null for transparent. Default rgba(0,0,0,0.55). */
  background?: string | null;
  /** Font size in px (canvas space). Default 16. Higher = crisper at large zoom. */
  fontSize?: number;
  /** Padding around the text in px. Default 4. */
  padding?: number;
  /** Bold text. Default false. */
  bold?: boolean;
}

interface ManagedLabel {
  sprite: THREE.Sprite;
  /** World-space anchor offset from the sprite's parent origin (e.g. the
   *  object the label is attached to). The sprite position is set by the
   *  caller; this is just metadata for the auto-scale logic. */
  baseScale: number;
  /** Min scale factor (don't shrink below this). */
  minScale: number;
  /** Max scale factor (don't grow above this). */
  maxScale: number;
  /** Scale so the label is ~this many world units tall at the reference
   *  distance. Set to 0 to use the sprite's natural pixel size. */
  targetWorldHeight: number;
}

export class LabelRenderer {
  private labels: ManagedLabel[] = [];

  /**
   * Create a label sprite. The caller is responsible for adding it to the
   * scene and setting its `.position` each frame. Register it via
   * `registerLabel` if you want auto-scaling with camera distance.
   */
  static createLabel(text: string, opts: LabelOptions = {}): THREE.Sprite {
    const color = opts.color ?? '#aabbcc';
    const background = opts.background === undefined ? 'rgba(0,0,0,0.55)' : opts.background;
    const fontSize = opts.fontSize ?? 16;
    const padding = opts.padding ?? 4;
    const bold = opts.bold ?? false;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = `${bold ? 'bold ' : ''}${fontSize}px ui-monospace, monospace`;
    ctx.font = font;
    const textWidth = ctx.measureText(text).width;
    canvas.width = Math.ceil(textWidth) + padding * 2;
    canvas.height = fontSize + padding * 2;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, padding, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    // Render above everything; don't occlude or be occluded.
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    // Natural scale: 1 world unit = 1 canvas px would be huge, so we scale
    // down. The registerLabel() call tunes the final on-screen size.
    sprite.scale.set(canvas.width / 100, canvas.height / 100, 1);
    sprite.raycast = () => {};
    return sprite;
  }

  /**
   * Register a label for automatic camera-distance scaling each frame.
   * `targetWorldHeight` is the desired height of the label in world units at
   * the reference distance (the sprite is scaled so it appears roughly that
   * tall regardless of zoom). Pass 0 to use a simple distance-proportional
   * scale with the sprite's current scale as the base.
   */
  registerLabel(
    sprite: THREE.Sprite,
    opts: { targetWorldHeight?: number; minScale?: number; maxScale?: number; baseScale?: number } = {},
  ): void {
    const baseScale = opts.baseScale ?? sprite.scale.x;
    this.labels.push({
      sprite,
      baseScale,
      minScale: opts.minScale ?? baseScale * 0.3,
      maxScale: opts.maxScale ?? baseScale * 3,
      targetWorldHeight: opts.targetWorldHeight ?? 0,
    });
  }

  unregisterLabel(sprite: THREE.Sprite): void {
    const idx = this.labels.findIndex((l) => l.sprite === sprite);
    if (idx >= 0) this.labels.splice(idx, 1);
  }

  /** Update all registered labels' scale based on distance to the camera. */
  update(camera: THREE.Camera): void {
    for (const label of this.labels) {
      const dist = label.sprite.position.distanceTo(camera.position);
      // Target: keep the label at a roughly constant on-screen height.
      // Sprite scale is in world units; a sprite of scale S at distance D
      // appears ~S/D of the viewport height. We want it to appear as
      // targetWorldHeight / referenceDistance, so scale = dist * (target / ref).
      const refDist = 20; // reference distance for "comfortable" size
      let scale: number;
      if (label.targetWorldHeight > 0) {
        scale = (dist / refDist) * label.targetWorldHeight;
      } else {
        scale = (dist / refDist) * label.baseScale;
      }
      scale = THREE.MathUtils.clamp(scale, label.minScale, label.maxScale);
      // Preserve aspect ratio (canvas width / height).
      const aspect = label.sprite.material.map
        ? label.sprite.material.map.image.width / label.sprite.material.map.image.height
        : 3;
      label.sprite.scale.set(scale * aspect, scale, 1);
    }
  }

  /** Dispose all registered labels' textures + materials. */
  dispose(): void {
    for (const label of this.labels) {
      label.sprite.material.map?.dispose();
      label.sprite.material.dispose();
    }
    this.labels = [];
  }
}