import * as THREE from 'three';

const GLOBE_RADIUS = 5;
const textureCache = new Map<string, THREE.Texture>();

function createTextureFromSVG(svgString: string, size: number = 128): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = new Image();
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;

  img.onload = () => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    texture.needsUpdate = true;
    URL.revokeObjectURL(url);
  };
  img.src = url;

  return texture;
}

function orientToSurface(mesh: THREE.Mesh, surfacePos: THREE.Vector3): void {
  const normal = surfacePos.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(normal.dot(up)) > 0.99) {
    up.set(1, 0, 0);
  }
  const tangent = new THREE.Vector3().crossVectors(normal, up).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

  const m = new THREE.Matrix4();
  m.makeBasis(tangent, bitangent, normal);
  mesh.quaternion.setFromRotationMatrix(m);
}

export function createInfantryIcon(color: string): THREE.Mesh {
  const key = `infantry_${color}`;
  let texture = textureCache.get(key);

  if (!texture) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
      <circle cx="24" cy="18" r="7" fill="${color}" stroke="#fff" stroke-width="1.2"/>
      <rect x="18" y="26" width="12" height="14" rx="2" fill="${color}" stroke="#fff" stroke-width="1.2"/>
      <line x1="20" y1="30" x2="15" y2="26" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="28" y1="30" x2="33" y2="26" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
    texture = createTextureFromSVG(svg);
    textureCache.set(key, texture);
  }

  const geometry = new THREE.PlaneGeometry(0.35, 0.35);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 999;
  mesh.userData = { type: 'unit' };
  return mesh;
}

export function createCityIcon(color: string, tier: number): THREE.Mesh {
  const key = `city_${color}_${tier}`;
  let texture = textureCache.get(key);

  if (!texture) {
    const heights = [0, 8, 11, 14, 17, 21, 25];
    const h = heights[Math.min(tier, 6)] || 8;
    const w = h * 0.7;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
      <rect x="${24 - w/2}" y="${36 - h}" width="${w}" height="${h}" rx="1" fill="${color}" stroke="#fff" stroke-width="1"/>
      <rect x="${24 - w/4}" y="${36 - h + 3}" width="${w/4}" height="${h - 6}" fill="rgba(255,255,255,0.4)"/>
      <rect x="${24 + 1}" y="${36 - h + 3}" width="${w/4}" height="${h - 6}" fill="rgba(255,255,255,0.4)"/>
      <polygon points="${24 - w/2 - 2},${36 - h} ${24},${36 - h - 5} ${24 + w/2 + 2},${36 - h}" fill="${color}" stroke="#fff" stroke-width="0.8"/>
    </svg>`;
    texture = createTextureFromSVG(svg);
    textureCache.set(key, texture);
  }

  const baseScale = 0.35 + tier * 0.06;
  const geometry = new THREE.PlaneGeometry(baseScale, baseScale);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 998;
  mesh.userData = { type: 'city' };
  return mesh;
}

export function positionOnSurface(mesh: THREE.Mesh, cellCenter: [number, number, number], offset: number = 1.01): void {
  const pos = new THREE.Vector3(cellCenter[0], cellCenter[1], cellCenter[2]).normalize().multiplyScalar(GLOBE_RADIUS * offset);
  mesh.position.copy(pos);
  orientToSurface(mesh, pos);
}

export function offsetOnSurface(basePos: THREE.Vector3, dx: number, dy: number): THREE.Vector3 {
  const normal = basePos.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(normal.dot(up)) > 0.99) {
    up.set(1, 0, 0);
  }
  const tangent1 = new THREE.Vector3().crossVectors(normal, up).normalize();
  const tangent2 = new THREE.Vector3().crossVectors(normal, tangent1).normalize();
  return basePos.clone().add(tangent1.multiplyScalar(dx)).add(tangent2.multiplyScalar(dy));
}

export { orientToSurface, GLOBE_RADIUS };