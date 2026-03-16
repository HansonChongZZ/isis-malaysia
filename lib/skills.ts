// lib/skills.ts

export interface SkillComparison {
  shared: string[];
  toDevelop: string[];
  distance: number;
}

/**
 * Build a map of occupation ID → Set of specific skills
 * from the existing occupations data.
 */
export function buildSpecificSkillsMap(
  occupations: Record<string, { specificSkills: string[] }>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [id, occ] of Object.entries(occupations)) {
    map.set(id, new Set(occ.specificSkills));
  }
  return map;
}

/**
 * Compute skill comparison between two occupations.
 * - shared: specific skills both have
 * - toDevelop: specific skills the target has that the source doesn't
 * - distance: toDevelop.length / (shared.length + toDevelop.length)
 *   Range: 0 (identical) to 1 (no overlap). Division-by-zero returns 0.
 */
export function computeSkillDistance(
  sourceId: string,
  targetId: string,
  skillsMap: Map<string, Set<string>>,
): SkillComparison {
  const sourceSkills = skillsMap.get(sourceId) ?? new Set<string>();
  const targetSkills = skillsMap.get(targetId) ?? new Set<string>();

  const shared: string[] = [];
  const toDevelop: string[] = [];

  for (const skill of targetSkills) {
    if (sourceSkills.has(skill)) {
      shared.push(skill);
    } else {
      toDevelop.push(skill);
    }
  }

  const denominator = shared.length + toDevelop.length;
  const distance = denominator === 0 ? 0 : toDevelop.length / denominator;

  return { shared, toDevelop, distance };
}

/**
 * Compute skill distances from a source node to all its neighbours.
 */
export function computeNeighbourDistances(
  sourceId: string,
  neighbourIds: string[],
  skillsMap: Map<string, Set<string>>,
): Map<string, SkillComparison> {
  const result = new Map<string, SkillComparison>();
  for (const neighbourId of neighbourIds) {
    result.set(neighbourId, computeSkillDistance(sourceId, neighbourId, skillsMap));
  }
  return result;
}
