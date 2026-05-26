/**
 * Feature: maps
 *
 * Owns: Map definitions, territory data, adjacency graph, map renderer.
 * Entities: MapDefinition, TerritoryDefinition, TerritoryConnection
 *
 * ARCHITECTURE CONSTRAINT:
 *   Map rendering must be schema-driven from MapDefinition + TerritoryDefinition data.
 *   No hardcoded SVG paths or territory coordinates in components.
 *   The renderer reads x/y coordinates from TerritoryDefinition records and builds the visual.
 *
 * Future prompts will add: components/MapRenderer.tsx, hooks/useMap.ts,
 *   hooks/useTerritories.ts, services/mapService.ts, etc.
 * Do not add logic to this file yet.
 */
export {};