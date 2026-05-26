/**
 * features/maps/mapValidation.ts
 *
 * Map schema validation utility.
 * Run this against any MapDefinition before it's used in the renderer or gameplay.
 * Throws no exceptions — returns a MapValidationResult with all errors collected.
 */
import type { MapDefinition, MapValidationResult, MapValidationError } from './types';

export function validateMap(map: MapDefinition): MapValidationResult {
  const errors: MapValidationError[] = [];

  const addError = (code: string, message: string, territory_id?: string) => {
    errors.push({ code, message, territory_id });
  };

  // ── 1. Unique territory IDs ─────────────────────────────────────────────────
  const seenIds = new Set<string>();
  for (const t of map.territories) {
    if (!t.territory_id) {
      addError('MISSING_ID', `Territory is missing territory_id`, undefined);
    } else if (seenIds.has(t.territory_id)) {
      addError('DUPLICATE_ID', `Duplicate territory_id: "${t.territory_id}"`, t.territory_id);
    } else {
      seenIds.add(t.territory_id);
    }
  }

  const regionIds   = new Set(map.regions.map(r => r.id));
  const continentIds = new Set(map.continents.map(c => c.id));

  for (const t of map.territories) {
    const tid = t.territory_id ?? '(unknown)';

    // ── 2. region_id and continent_id present and valid ───────────────────────
    if (!t.region_id) {
      addError('MISSING_REGION', `Territory "${tid}" is missing region_id`, tid);
    } else if (!regionIds.has(t.region_id)) {
      addError('INVALID_REGION', `Territory "${tid}" references unknown region_id "${t.region_id}"`, tid);
    }

    if (!t.continent_id) {
      addError('MISSING_CONTINENT', `Territory "${tid}" is missing continent_id`, tid);
    } else if (!continentIds.has(t.continent_id)) {
      addError('INVALID_CONTINENT', `Territory "${tid}" references unknown continent_id "${t.continent_id}"`, tid);
    }

    // ── 3. Visual geometry present ────────────────────────────────────────────
    if (!t.points || !t.points.trim()) {
      addError('MISSING_POINTS', `Territory "${tid}" is missing SVG polygon points`, tid);
    }
    if (t.cx == null || t.cy == null) {
      addError('MISSING_CENTER', `Territory "${tid}" is missing cx/cy center coordinates`, tid);
    }

    // ── 4. Resource distribution totals 100 ───────────────────────────────────
    if (!t.resource_distribution) {
      addError('MISSING_RESOURCES', `Territory "${tid}" is missing resource_distribution`, tid);
    } else {
      const { brick, lumber, wool, grain, ore } = t.resource_distribution;
      const total = (brick ?? 0) + (lumber ?? 0) + (wool ?? 0) + (grain ?? 0) + (ore ?? 0);
      if (total !== 100) {
        addError(
          'INVALID_RESOURCE_TOTAL',
          `Territory "${tid}" resource_distribution totals ${total}, expected 100`,
          tid,
        );
      }
      for (const [key, val] of Object.entries({ brick, lumber, wool, grain, ore })) {
        if (val == null || val < 0) {
          addError('INVALID_RESOURCE_VALUE', `Territory "${tid}" resource "${key}" is invalid (${val})`, tid);
        }
      }
    }
  }

  // ── 5. Every referenced region has a continent_id ────────────────────────────
  for (const r of map.regions) {
    if (!r.continent_id) {
      addError('REGION_MISSING_CONTINENT', `Region "${r.id}" is missing continent_id`);
    } else if (!continentIds.has(r.continent_id)) {
      addError('REGION_INVALID_CONTINENT', `Region "${r.id}" references unknown continent_id "${r.continent_id}"`);
    }
  }

  // ── 6. Adjacency edges reference valid territory IDs ─────────────────────────
  for (const [a, b] of map.adjacency) {
    if (!seenIds.has(a)) {
      addError('INVALID_ADJACENCY', `Adjacency references unknown territory_id "${a}"`);
    }
    if (!seenIds.has(b)) {
      addError('INVALID_ADJACENCY', `Adjacency references unknown territory_id "${b}"`);
    }
    if (a === b) {
      addError('SELF_ADJACENCY', `Adjacency entry has territory "${a}" adjacent to itself`);
    }
  }

  // ── 7. No duplicate adjacency edges ─────────────────────────────────────────
  const edgesSeen = new Set<string>();
  for (const [a, b] of map.adjacency) {
    const edgeKey = [a, b].sort().join('::');
    if (edgesSeen.has(edgeKey)) {
      addError('DUPLICATE_EDGE', `Duplicate adjacency edge between "${a}" and "${b}"`);
    }
    edgesSeen.add(edgeKey);
  }

  // ── 8. Map dimensions valid ──────────────────────────────────────────────────
  if (!map.width || map.width <= 0) {
    addError('INVALID_DIMENSIONS', 'Map width must be > 0');
  }
  if (!map.height || map.height <= 0) {
    addError('INVALID_DIMENSIONS', 'Map height must be > 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Convenience: throw if map is invalid. Use in dev/test only. */
export function assertMapValid(map: MapDefinition): void {
  const result = validateMap(map);
  if (!result.valid) {
    const summary = result.errors.map(e => `  [${e.code}] ${e.message}`).join('\n');
    throw new Error(`Map "${map.id}" failed validation:\n${summary}`);
  }
}