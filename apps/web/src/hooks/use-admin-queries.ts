'use client';

//  Phase 2 decomposition: thin re-export facade
// All hooks are re-exported from domain-specific files for backward compatibility.
// For new code, prefer importing directly from the domain files.

// Re-export from shared so API and web use identical slugification logic.
export { generateSlug } from '@portfolio/shared';
// Query key factory (re-exported for backward compat)
export { adminKeys } from './admin/query-keys';
export * from './admin/use-admin-analytics';
export * from './admin/use-admin-auth';
export * from './admin/use-admin-comments';
export * from './admin/use-admin-contacts';
export * from './admin/use-admin-dlq';
export * from './admin/use-admin-education';
export * from './admin/use-admin-experience';
export * from './admin/use-admin-posts';
export * from './admin/use-admin-projects';
export * from './admin/use-admin-tags';
export { useAdminUpload } from './use-admin-uploads';
