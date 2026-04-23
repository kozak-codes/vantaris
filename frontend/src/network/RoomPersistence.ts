export function getRoomIdFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

export function setRoomIdInURL(roomId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  window.history.replaceState({}, '', url.toString());
}

export function clearRoomFromURL(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url.toString());
}

export function getCameraFromURL(): { lat: number; lng: number; zoom: number } | null {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#cam=')) return null;
  const parts = hash.slice(5).split(',');
  if (parts.length !== 3) return null;
  const [lat, lng, zoom] = parts.map(Number);
  if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) return null;
  return { lat, lng, zoom };
}

export function setCameraInURL(lat: number, lng: number, zoom: number): void {
  window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}#cam=${lat},${lng},${zoom}`);
}

export function storeSessionId(roomId: string, sessionId: string): void {
  localStorage.setItem(`vantaris_session_${roomId}`, sessionId);
}

export function getSessionId(roomId: string): string | null {
  return localStorage.getItem(`vantaris_session_${roomId}`);
}