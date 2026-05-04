import * as THREE from 'three';
import { CAMERA_CONFIG } from '../constants';

const TOUCH_MOVE_THRESHOLD = 5;

export class CameraControls {
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private pivot: THREE.Group;
  private isRotating = false;
  private previousPointer = { x: 0, y: 0 };
  private velocityX = 0;
  private velocityY = 0;
  private targetZoom: number;
  private currentDistance: number;
  private pinchStartDistance = 0;
  private keysHeld = new Set<string>();
  private _enabled = true;
  private touchGestureActive = false;
  private touchMoved = false;
  private touchStartPos = { x: 0, y: 0 };

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, pivot: THREE.Group) {
    this.camera = camera;
    this.canvas = canvas;
    this.pivot = pivot;
    this.currentDistance = CAMERA_CONFIG.minDistance + (CAMERA_CONFIG.maxDistance - CAMERA_CONFIG.minDistance) * 0.4;
    this.targetZoom = this.currentDistance;

    this.updateCameraPosition();
    this.bindEvents();
  }

  isTouchGestureActive(): boolean {
    return this.touchGestureActive;
  }

  wasTouchMoved(): boolean {
    return this.touchMoved;
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('pointerleave', this.onPointerUp.bind(this));
    this.canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    this.canvas.addEventListener('touchcancel', this.onTouchCancel.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this._enabled) return;
    if (this.touchGestureActive) return;
    if (e.button === 2) {
      this.isRotating = true;
      this.previousPointer = { x: e.clientX, y: e.clientY };
      this.velocityX = 0;
      this.velocityY = 0;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.touchGestureActive) return;
    if (!this.isRotating) return;
    const dx = e.clientX - this.previousPointer.x;
    const dy = e.clientY - this.previousPointer.y;
    this.velocityX = dx;
    this.velocityY = dy;
    this.rotateGlobe(dx, dy);
    this.previousPointer = { x: e.clientX, y: e.clientY };
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.touchGestureActive) return;
    if (e.button === 2 || this.isRotating) {
      this.isRotating = false;
    }
  }

  private rotateGlobe(dx: number, dy: number): void {
    const zoomScale = this.currentDistance / CAMERA_CONFIG.minDistance;
    const sensitivity = 0.005 * zoomScale;

    const yawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      dx * sensitivity,
    );
    this.pivot.quaternion.premultiply(yawQuat);

    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      dy * sensitivity,
    );
    this.pivot.quaternion.premultiply(pitchQuat);

    this.pivot.quaternion.normalize();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this._enabled) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      e.preventDefault();
      this.keysHeld.add(key);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysHeld.delete(e.key.toLowerCase());
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      this.keysHeld.clear();
      this.isRotating = false;
      this.velocityX = 0;
      this.velocityY = 0;
    }
  }

  private applyKeyboardRotation(): void {
    const speed = CAMERA_CONFIG.keyboardRotateSpeed;
    let dx = 0;
    let dy = 0;

    if (this.keysHeld.has('d') || this.keysHeld.has('arrowright')) dx -= speed;
    if (this.keysHeld.has('a') || this.keysHeld.has('arrowleft')) dx += speed;
    if (this.keysHeld.has('w') || this.keysHeld.has('arrowup')) dy += speed;
    if (this.keysHeld.has('s') || this.keysHeld.has('arrowdown')) dy -= speed;

    if (dx !== 0 || dy !== 0) {
      this.rotateGlobe(dx, dy);
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!this._enabled) return;
    e.preventDefault();
    this.targetZoom += e.deltaY * 0.01 * CAMERA_CONFIG.zoomSpeed;
    this.targetZoom = THREE.MathUtils.clamp(
      this.targetZoom,
      CAMERA_CONFIG.minDistance,
      CAMERA_CONFIG.maxDistance,
    );
  }

  private onTouchStart(e: TouchEvent): void {
    if (!this._enabled) return;
    e.preventDefault();
    this.touchGestureActive = true;
    this.touchMoved = false;

    if (e.touches.length === 2) {
      this.pinchStartDistance = this.getTouchDistance(e.touches);
      this.previousPointer = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      this.isRotating = true;
      this.velocityX = 0;
      this.velocityY = 0;
    } else if (e.touches.length === 1) {
      this.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.previousPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.velocityX = 0;
      this.velocityY = 0;
      this.isRotating = false;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.touchMoved = true;
      this.isRotating = true;
      const newDist = this.getTouchDistance(e.touches);
      const delta = this.pinchStartDistance - newDist;
      this.targetZoom += delta * 0.02 * CAMERA_CONFIG.zoomSpeed;
      this.targetZoom = THREE.MathUtils.clamp(
        this.targetZoom,
        CAMERA_CONFIG.minDistance,
        CAMERA_CONFIG.maxDistance,
      );
      this.pinchStartDistance = newDist;

      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = cx - this.previousPointer.x;
      const dy = cy - this.previousPointer.y;
      this.rotateGlobe(dx, dy);
      this.previousPointer = { x: cx, y: cy };
    } else if (e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - this.previousPointer.x;
      const dy = e.touches[0].clientY - this.previousPointer.y;

      const totalDx = e.touches[0].clientX - this.touchStartPos.x;
      const totalDy = e.touches[0].clientY - this.touchStartPos.y;
      const dist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

      if (dist > TOUCH_MOVE_THRESHOLD) {
        this.touchMoved = true;
        if (!this.isRotating) {
          this.isRotating = true;
          this.previousPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else {
          this.velocityX = dx;
          this.velocityY = dy;
          this.rotateGlobe(dx, dy);
          this.previousPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) {
      this.touchGestureActive = false;
      this.isRotating = false;
    } else if (e.touches.length === 1) {
      this.pinchStartDistance = 0;
      this.previousPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.isRotating = false;
      this.velocityX = 0;
      this.velocityY = 0;
    }
  }

  private onTouchCancel(): void {
    this.touchGestureActive = false;
    this.touchMoved = true;
    this.isRotating = false;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private updateCameraPosition(): void {
    this.camera.position.set(0, 0, this.currentDistance);
    this.camera.lookAt(0, 0, 0);
  }

  update(): void {
    this.applyKeyboardRotation();

    if (!this.isRotating) {
      if (Math.abs(this.velocityX) > 0.01 || Math.abs(this.velocityY) > 0.01) {
        this.rotateGlobe(
          this.velocityX * 0.15,
          this.velocityY * 0.15,
        );
        this.velocityX *= CAMERA_CONFIG.rotationDamping;
        this.velocityY *= CAMERA_CONFIG.rotationDamping;
      } else {
        this.velocityX = 0;
        this.velocityY = 0;
      }
    }

    this.currentDistance += (this.targetZoom - this.currentDistance) * 0.1;
    this.updateCameraPosition();
  }

  getPivot(): THREE.Group {
    return this.pivot;
  }

  getQuaternion(): { x: number; y: number; z: number; w: number } {
    const q = this.pivot.quaternion;
    return { x: q.x, y: q.y, z: q.z, w: q.w };
  }

  setQuaternion(x: number, y: number, z: number, w: number): void {
    this.pivot.quaternion.set(x, y, z, w);
  }

  getZoom(): number {
    return this.currentDistance;
  }

   setZoom(zoom: number): void {
    this.currentDistance = zoom;
    this.targetZoom = zoom;
    this.updateCameraPosition();
  }

  focusCell(center: [number, number, number]): void {
    const target = new THREE.Vector3(center[0], center[1], center[2]);
    const defaultForward = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion().setFromUnitVectors(target.clone().normalize(), defaultForward);
    this.pivot.quaternion.premultiply(quat);
    this.targetZoom = CAMERA_CONFIG.minDistance + (CAMERA_CONFIG.maxDistance - CAMERA_CONFIG.minDistance) * 0.35;
    this.currentDistance = this.targetZoom;
    this.updateCameraPosition();
  }
}