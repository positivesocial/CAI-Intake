/**
 * CAI Intake - Operations Library Service
 * 
 * Note: This service provides client-side utilities for operations libraries.
 * The main CRUD operations are handled by API routes (/api/v1/hole-patterns, etc.)
 * which directly interact with Supabase server-side.
 * 
 * This file provides:
 * - Type definitions re-exports
 * - Client-side fetch helpers
 * - Usage tracking helpers (called from parser integration)
 */

import type {
  HolePattern,
  HolePatternInput,
  GrooveProfile,
  GrooveProfileInput,
  RoutingProfile,
  RoutingProfileInput,
  OperationsLibrarySummary,
} from './types';

// ============================================================
// CLIENT-SIDE API HELPERS
// ============================================================

/**
 * Fetch hole patterns from API
 */
export async function fetchHolePatterns(options?: {
  kind?: string;
  activeOnly?: boolean;
  limit?: number;
}): Promise<{ patterns: HolePattern[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.kind) params.set('kind', options.kind);
  if (options?.activeOnly === false) params.set('active', 'all');
  if (options?.limit) params.set('limit', String(options.limit));

  const response = await fetch(`/api/v1/hole-patterns?${params}`);
  if (!response.ok) throw new Error('Failed to fetch hole patterns');
  return response.json();
}

/**
 * Fetch groove profiles from API
 */
export async function fetchGrooveProfiles(options?: {
  purpose?: string;
  activeOnly?: boolean;
  limit?: number;
}): Promise<{ profiles: GrooveProfile[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.purpose) params.set('purpose', options.purpose);
  if (options?.activeOnly === false) params.set('active', 'all');
  if (options?.limit) params.set('limit', String(options.limit));

  const response = await fetch(`/api/v1/groove-profiles?${params}`);
  if (!response.ok) throw new Error('Failed to fetch groove profiles');
  return response.json();
}

/**
 * Fetch routing profiles from API
 */
export async function fetchRoutingProfiles(options?: {
  profileType?: string;
  activeOnly?: boolean;
  limit?: number;
}): Promise<{ profiles: RoutingProfile[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.profileType) params.set('type', options.profileType);
  if (options?.activeOnly === false) params.set('active', 'all');
  if (options?.limit) params.set('limit', String(options.limit));

  const response = await fetch(`/api/v1/routing-profiles?${params}`);
  if (!response.ok) throw new Error('Failed to fetch routing profiles');
  return response.json();
}

/**
 * Fetch operations library summary
 */
export async function fetchOperationsLibrarySummary(): Promise<OperationsLibrarySummary> {
  const [holes, grooves, routing] = await Promise.all([
    fetchHolePatterns({ limit: 0 }),
    fetchGrooveProfiles({ limit: 0 }),
    fetchRoutingProfiles({ limit: 0 }),
  ]);

  return {
    hole_patterns: holes.total,
    groove_profiles: grooves.total,
    routing_profiles: routing.total,
  };
}

// ============================================================
// CRUD HELPERS (call API routes)
// ============================================================

export async function createHolePattern(input: HolePatternInput): Promise<HolePattern> {
  const response = await fetch('/api/v1/hole-patterns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create hole pattern');
  }
  return response.json();
}

export async function updateHolePattern(
  patternId: string, 
  input: Partial<HolePatternInput>
): Promise<HolePattern> {
  const response = await fetch(`/api/v1/hole-patterns/${patternId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to update hole pattern');
  }
  return response.json();
}

export async function deleteHolePattern(patternId: string): Promise<void> {
  const response = await fetch(`/api/v1/hole-patterns/${patternId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete hole pattern');
  }
}

export async function createGrooveProfile(input: GrooveProfileInput): Promise<GrooveProfile> {
  const response = await fetch('/api/v1/groove-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create groove profile');
  }
  return response.json();
}

export async function updateGrooveProfile(
  profileId: string,
  input: Partial<GrooveProfileInput>
): Promise<GrooveProfile> {
  const response = await fetch(`/api/v1/groove-profiles/${profileId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to update groove profile');
  }
  return response.json();
}

export async function deleteGrooveProfile(profileId: string): Promise<void> {
  const response = await fetch(`/api/v1/groove-profiles/${profileId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete groove profile');
  }
}

export async function createRoutingProfile(input: RoutingProfileInput): Promise<RoutingProfile> {
  const response = await fetch('/api/v1/routing-profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create routing profile');
  }
  return response.json();
}

export async function updateRoutingProfile(
  profileId: string,
  input: Partial<RoutingProfileInput>
): Promise<RoutingProfile> {
  const response = await fetch(`/api/v1/routing-profiles/${profileId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to update routing profile');
  }
  return response.json();
}

export async function deleteRoutingProfile(profileId: string): Promise<void> {
  const response = await fetch(`/api/v1/routing-profiles/${profileId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete routing profile');
  }
}
