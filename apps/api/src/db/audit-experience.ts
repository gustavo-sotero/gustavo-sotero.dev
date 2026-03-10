/**
 * Audit script: detect experience entries with isCurrent=false and endDate=null.
 *
 * These records violate the domain invariant enforced by createExperienceSchema and
 * the service layer. Running this before tightening the contract lets you identify
 * and manually remediate any legacy data that would otherwise surface as broken
 * entries in the public profile, home, or résumé loaders.
 *
 * Usage:
 *   bun --env-file ../../.env run src/db/audit-experience.ts
 *
 * Output:
 *   Prints a table of offending rows (id, slug, role, company, startDate).
 *   Exits with code 1 if any violations are found, so it can be used in CI.
 */

import { experience } from '@portfolio/shared/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../config/db';

async function main() {
  const violations = await db
    .select({
      id: experience.id,
      slug: experience.slug,
      role: experience.role,
      company: experience.company,
      startDate: experience.startDate,
      endDate: experience.endDate,
      isCurrent: experience.isCurrent,
    })
    .from(experience)
    .where(and(eq(experience.isCurrent, false), isNull(experience.endDate)));

  if (violations.length === 0) {
    console.log('✅ No experience violations found — all non-current entries have an endDate.');
    process.exit(0);
  }

  console.error(
    `❌ Found ${violations.length} experience record(s) with isCurrent=false and endDate=null:\n`
  );

  console.table(
    violations.map((v) => ({
      id: v.id,
      slug: v.slug,
      role: v.role,
      company: v.company,
      startDate: v.startDate,
    }))
  );

  console.error(
    '\nRemediation options:\n' +
      '  1. Edit each entry in the admin panel to set an endDate.\n' +
      '  2. Set isCurrent=true if the role is ongoing.\n' +
      '  3. Run a targeted UPDATE if the correct endDate is known.\n'
  );

  process.exit(1);
}

main().catch((err) => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
