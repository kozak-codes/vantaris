import type { AdjacencyMap } from './types';

export function buildAdjacencyMap(
  cellIds: string[],
  cellPositions: Record<string, [number, number, number]>,
): AdjacencyMap {
  const adjacency: AdjacencyMap = {};

  for (const id of cellIds) {
    adjacency[id] = [];
  }

  const angleThreshold = 0.6;
  const radius = 5;
  const chordThreshold = 2 * radius * Math.sin(angleThreshold / 2);

  for (let i = 0; i < cellIds.length; i++) {
    const idA = cellIds[i];
    const posA = cellPositions[idA];
    if (!posA) continue;

    for (let j = i + 1; j < cellIds.length; j++) {
      const idB = cellIds[j];
      const posB = cellPositions[idB];
      if (!posB) continue;

      const dx = posA[0] - posB[0];
      const dy = posA[1] - posB[1];
      const dz = posA[2] - posB[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < chordThreshold && dist > 0.01) {
        adjacency[idA].push(idB);
        adjacency[idB].push(idA);
      }
    }
  }

  return adjacency;
}