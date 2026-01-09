/**
 * HTTP Routes Exports
 */

export { createSyncRoutes } from './sync';
export type { SyncRoutesDependencies } from './sync';

export { createTriageRoutes } from './triage';
export type { TriageRoutesDependencies } from './triage';

export { createTestTriageRoutes } from './testTriage';
export type { TestTriageRoutesDependencies } from './testTriage';

export { createReferenceDataRoutes } from './referenceData';
export type { ReferenceDataRoutesDependencies } from './referenceData';

export { createHealthRoutes } from './health';
export type { HealthRoutesDependencies } from './health';

export { createCasesRoutes } from './cases';
export type { CasesRoutesDependencies } from './cases';

export { createEmailsRoutes } from './emails';
export type { EmailsRoutesDependencies } from './emails';

export { createCaseworkerProxyRoutes } from './caseworkerProxy';
export type { CaseworkerProxyRoutesDependencies } from './caseworkerProxy';
