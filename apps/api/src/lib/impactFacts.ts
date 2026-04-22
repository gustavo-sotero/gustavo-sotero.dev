import { experienceImpactFactsSchema } from '@portfolio/shared/schemas/experience';
import { projectImpactFactsSchema } from '@portfolio/shared/schemas/projects';

type ValidationDetail = {
  field: string;
  message: string;
};

type ValidationError = Error & {
  validationDetails?: ValidationDetail[];
};

function normalizeImpactFacts(
  impactFacts: string[] | undefined,
  schema: typeof projectImpactFactsSchema | typeof experienceImpactFactsSchema
) {
  if (impactFacts === undefined) return undefined;

  const result = schema.safeParse(impactFacts);
  if (result.success) {
    return result.data ?? [];
  }

  const error = new Error(
    `VALIDATION_ERROR: ${result.error.issues[0]?.message ?? 'impactFacts is invalid'}`
  ) as ValidationError;
  error.validationDetails = result.error.issues.map((issue) => ({
    field: 'impactFacts',
    message: issue.message,
  }));
  throw error;
}

export function normalizeProjectImpactFacts(impactFacts: string[] | undefined) {
  return normalizeImpactFacts(impactFacts, projectImpactFactsSchema);
}

export function normalizeExperienceImpactFacts(impactFacts: string[] | undefined) {
  return normalizeImpactFacts(impactFacts, experienceImpactFactsSchema);
}
