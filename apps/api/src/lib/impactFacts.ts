import { experienceImpactFactsSchema } from '@portfolio/shared/schemas/experience';
import { projectImpactFactsSchema } from '@portfolio/shared/schemas/projects';
import { DomainValidationError } from './errors';

function normalizeImpactFacts(
  impactFacts: string[] | undefined,
  schema: typeof projectImpactFactsSchema | typeof experienceImpactFactsSchema
) {
  if (impactFacts === undefined) return undefined;

  const result = schema.safeParse(impactFacts);
  if (result.success) {
    return result.data ?? [];
  }

  throw new DomainValidationError(
    result.error.issues[0]?.message ?? 'impactFacts is invalid',
    result.error.issues.map((issue) => ({ field: 'impactFacts', message: issue.message }))
  );
}

export function normalizeProjectImpactFacts(impactFacts: string[] | undefined) {
  return normalizeImpactFacts(impactFacts, projectImpactFactsSchema);
}

export function normalizeExperienceImpactFacts(impactFacts: string[] | undefined) {
  return normalizeImpactFacts(impactFacts, experienceImpactFactsSchema);
}
