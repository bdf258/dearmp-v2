/**
 * Push Job Handlers
 *
 * Handles jobs that push data from the shadow database
 * to the legacy Caseworker system.
 */

import PgBoss from 'pg-boss';
import { OfficeId, ExternalId } from '../../../domain/value-objects';
import { ILegacyApiClient } from '../../../domain/interfaces';
import { IConstituentRepository, ICaseRepository, IEmailRepository } from '../../../domain/interfaces';
import {
  JobNames,
  PushConstituentJobData,
  PushCaseJobData,
  PushEmailJobData,
  PushCasenoteJobData,
  PushJobResult,
} from '../types';
import { PgBossClient } from '../PgBossClient';

export interface PushJobHandlerDependencies {
  pgBossClient: PgBossClient;
  legacyApiClient: ILegacyApiClient;
  constituentRepository: IConstituentRepository;
  caseRepository: ICaseRepository;
  emailRepository: IEmailRepository;
  auditLogRepository: IAuditLogRepository;
}

export interface IAuditLogRepository {
  log(entry: {
    officeId: string;
    entityType: string;
    operation: string;
    externalId?: number;
    internalId?: string;
    oldData?: object;
    newData?: object;
    error?: string;
  }): Promise<void>;
}

/**
 * Handler for push jobs (shadow DB -> legacy system)
 */
export class PushJobHandler {
  private readonly client: PgBossClient;
  private readonly legacyApi: ILegacyApiClient;
  private readonly constituentRepo: IConstituentRepository;
  private readonly caseRepo: ICaseRepository;
  private readonly emailRepo: IEmailRepository;
  private readonly auditLog: IAuditLogRepository;

  constructor(deps: PushJobHandlerDependencies) {
    this.client = deps.pgBossClient;
    this.legacyApi = deps.legacyApiClient;
    this.constituentRepo = deps.constituentRepository;
    this.caseRepo = deps.caseRepository;
    this.emailRepo = deps.emailRepository;
    this.auditLog = deps.auditLogRepository;
  }

  /**
   * Register all push job handlers
   */
  async register(): Promise<void> {
    await this.client.work<PushConstituentJobData>(
      JobNames.PUSH_CONSTITUENT,
      this.handlePushConstituent.bind(this),
      { teamSize: 3, teamConcurrency: 1 }
    );

    await this.client.work<PushCaseJobData>(
      JobNames.PUSH_CASE,
      this.handlePushCase.bind(this),
      { teamSize: 3, teamConcurrency: 1 }
    );

    await this.client.work<PushEmailJobData>(
      JobNames.PUSH_EMAIL,
      this.handlePushEmail.bind(this),
      { teamSize: 3, teamConcurrency: 1 }
    );

    await this.client.work<PushCasenoteJobData>(
      JobNames.PUSH_CASENOTE,
      this.handlePushCasenote.bind(this),
      { teamSize: 2, teamConcurrency: 1 }
    );

    console.log('[PushJobHandler] Registered all push job handlers');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUSH CONSTITUENT
  // ─────────────────────────────────────────────────────────────────────────

  private async handlePushConstituent(
    job: PgBoss.Job<PushConstituentJobData>
  ): Promise<void> {
    const { officeId, constituentId, operation, data } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[PushConstituent] ${operation} constituent ${constituentId} for office: ${officeId}`);

    const result: PushJobResult = {
      success: false,
      entityType: 'constituent',
      internalId: constituentId,
      operation,
      durationMs: 0,
    };

    try {
      if (operation === 'create') {
        // Create constituent in legacy system
        const legacyResponse = await this.legacyApi.createConstituent(office, {
          firstName: data.firstName,
          lastName: data.lastName,
          title: data.title,
          organisationType: data.organisationType,
        });

        result.externalId = legacyResponse.id;

        // Update shadow DB with external ID
        await this.constituentRepo.updateExternalId(constituentId, ExternalId.create(legacyResponse.id));

        await this.auditLog.log({
          officeId,
          entityType: 'constituent',
          operation: 'create',
          internalId: constituentId,
          externalId: legacyResponse.id,
          newData: data,
        });
      } else if (operation === 'update') {
        // Get existing external ID
        const constituent = await this.constituentRepo.findById(constituentId);
        if (!constituent?.externalId) {
          throw new Error(`Constituent ${constituentId} has no external ID`);
        }

        await this.legacyApi.updateConstituent(office, constituent.externalId, {
          firstName: data.firstName,
          lastName: data.lastName,
          title: data.title,
          organisationType: data.organisationType,
        });

        result.externalId = constituent.externalId.toNumber();

        await this.auditLog.log({
          officeId,
          entityType: 'constituent',
          operation: 'update',
          internalId: constituentId,
          externalId: constituent.externalId.toNumber(),
          newData: data,
        });
      }

      result.success = true;
      result.durationMs = Date.now() - startTime;

      console.log(
        `[PushConstituent] Completed ${operation} for ${constituentId} ` +
          `(external: ${result.externalId}) in ${result.durationMs}ms`
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;

      await this.auditLog.log({
        officeId,
        entityType: 'constituent',
        operation,
        internalId: constituentId,
        error: result.error,
      });

      console.error(`[PushConstituent] Failed:`, error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUSH CASE
  // ─────────────────────────────────────────────────────────────────────────

  private async handlePushCase(job: PgBoss.Job<PushCaseJobData>): Promise<void> {
    const { officeId, caseId, operation, data } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[PushCase] ${operation} case ${caseId} for office: ${officeId}`);

    const result: PushJobResult = {
      success: false,
      entityType: 'case',
      internalId: caseId,
      operation,
      durationMs: 0,
    };

    try {
      // Get constituent external ID
      const constituent = await this.constituentRepo.findById(data.constituentId);
      if (!constituent?.externalId) {
        throw new Error(`Constituent ${data.constituentId} has no external ID`);
      }

      if (operation === 'create') {
        const legacyResponse = await this.legacyApi.createCase(office, {
          constituentID: constituent.externalId.toNumber(),
          caseTypeID: data.caseTypeId,
          statusID: data.statusId,
          categoryTypeID: data.categoryTypeId,
          contactTypeID: data.contactTypeId,
          assignedToID: data.assignedToId,
          summary: data.summary,
          reviewDate: data.reviewDate,
        });

        result.externalId = legacyResponse.id;

        // Update shadow DB with external ID
        await this.caseRepo.updateExternalId(caseId, ExternalId.create(legacyResponse.id));

        await this.auditLog.log({
          officeId,
          entityType: 'case',
          operation: 'create',
          internalId: caseId,
          externalId: legacyResponse.id,
          newData: data,
        });
      } else if (operation === 'update') {
        const caseEntity = await this.caseRepo.findById(caseId);
        if (!caseEntity?.externalId) {
          throw new Error(`Case ${caseId} has no external ID`);
        }

        await this.legacyApi.updateCase(office, caseEntity.externalId, {
          caseTypeID: data.caseTypeId,
          statusID: data.statusId,
          categoryTypeID: data.categoryTypeId,
          contactTypeID: data.contactTypeId,
          assignedToID: data.assignedToId,
          summary: data.summary,
          reviewDate: data.reviewDate,
        });

        result.externalId = caseEntity.externalId.toNumber();

        await this.auditLog.log({
          officeId,
          entityType: 'case',
          operation: 'update',
          internalId: caseId,
          externalId: caseEntity.externalId.toNumber(),
          newData: data,
        });
      }

      result.success = true;
      result.durationMs = Date.now() - startTime;

      console.log(
        `[PushCase] Completed ${operation} for ${caseId} ` +
          `(external: ${result.externalId}) in ${result.durationMs}ms`
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;

      await this.auditLog.log({
        officeId,
        entityType: 'case',
        operation,
        internalId: caseId,
        error: result.error,
      });

      console.error(`[PushCase] Failed:`, error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUSH EMAIL
  // ─────────────────────────────────────────────────────────────────────────

  private async handlePushEmail(job: PgBoss.Job<PushEmailJobData>): Promise<void> {
    const { officeId, emailId, operation, data } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[PushEmail] ${operation} email ${emailId} for office: ${officeId}`);

    const result: PushJobResult = {
      success: false,
      entityType: 'email',
      internalId: emailId,
      operation,
      durationMs: 0,
    };

    try {
      const email = await this.emailRepo.findById(emailId);

      if (operation === 'update' && email?.externalId) {
        // Update email (e.g., mark as actioned)
        if (data.actioned !== undefined) {
          await this.legacyApi.markEmailActioned(office, email.externalId);
        }

        result.externalId = email.externalId.toNumber();

        await this.auditLog.log({
          officeId,
          entityType: 'email',
          operation: 'update',
          internalId: emailId,
          externalId: email.externalId.toNumber(),
          newData: data,
        });
      } else if (operation === 'send') {
        // Send email through legacy system
        // First create a draft, then send it
        if (!data.to || data.to.length === 0) {
          throw new Error('Email must have at least one recipient');
        }

        if (!data.subject) {
          throw new Error('Email must have a subject');
        }

        // Create draft email in legacy system
        const draftResponse = await this.legacyApi.createDraftEmail(office, {
          to: data.to,
          cc: data.cc,
          bcc: data.bcc,
          subject: data.subject,
          htmlBody: data.htmlBody ?? '',
          caseId: data.caseId,
        });

        result.externalId = draftResponse.id;

        // Send the draft
        await this.legacyApi.sendDraftEmail(
          office,
          { toNumber: () => draftResponse.id } as ExternalId
        );

        // Update shadow DB with external ID if needed
        if (email && !email.externalId) {
          await this.emailRepo.updateExternalId(emailId, ExternalId.create(draftResponse.id));
        }

        await this.auditLog.log({
          officeId,
          entityType: 'email',
          operation: 'send',
          internalId: emailId,
          externalId: draftResponse.id,
          newData: data,
        });

        console.log(`[PushEmail] Sent email ${emailId} (external: ${draftResponse.id})`);
      } else if (operation === 'create') {
        // Create a draft email without sending
        if (!data.subject) {
          throw new Error('Email must have a subject');
        }

        const draftResponse = await this.legacyApi.createDraftEmail(office, {
          to: data.to ?? [],
          cc: data.cc,
          bcc: data.bcc,
          subject: data.subject,
          htmlBody: data.htmlBody ?? '',
          caseId: data.caseId,
        });

        result.externalId = draftResponse.id;

        // Update shadow DB with external ID
        await this.emailRepo.updateExternalId(emailId, ExternalId.create(draftResponse.id));

        await this.auditLog.log({
          officeId,
          entityType: 'email',
          operation: 'create',
          internalId: emailId,
          externalId: draftResponse.id,
          newData: data,
        });
      }

      result.success = true;
      result.durationMs = Date.now() - startTime;

      console.log(
        `[PushEmail] Completed ${operation} for ${emailId} in ${result.durationMs}ms`
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;

      await this.auditLog.log({
        officeId,
        entityType: 'email',
        operation,
        internalId: emailId,
        error: result.error,
      });

      console.error(`[PushEmail] Failed:`, error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUSH CASENOTE
  // ─────────────────────────────────────────────────────────────────────────

  private async handlePushCasenote(job: PgBoss.Job<PushCasenoteJobData>): Promise<void> {
    const { officeId, casenoteId, caseExternalId, operation, data } = job.data;
    const startTime = Date.now();
    const office = OfficeId.create(officeId);

    console.log(`[PushCasenote] ${operation} casenote ${casenoteId} for office: ${officeId}`);

    const result: PushJobResult = {
      success: false,
      entityType: 'casenote',
      internalId: casenoteId,
      operation,
      durationMs: 0,
    };

    try {
      // Call the legacy API based on operation type
      if (operation === 'create') {
        const response = await this.legacyClient.createCasenote(
          office,
          caseExternalId,
          {
            type: data.type,
            content: data.content,
            subtypeId: data.subtypeId,
          }
        );
        result.externalId = response.id;
        console.log(
          `[PushCasenote] Created casenote ${casenoteId} -> external ID ${response.id}`
        );
      } else if (operation === 'update') {
        await this.legacyClient.updateCasenote(
          office,
          { toNumber: () => data.externalId! } as any,
          {
            content: data.content,
            actioned: data.actioned,
          }
        );
        result.externalId = data.externalId;
        console.log(
          `[PushCasenote] Updated casenote ${casenoteId} (external: ${data.externalId})`
        );
      }

      await this.auditLog.log({
        officeId,
        entityType: 'casenote',
        operation,
        internalId: casenoteId,
        externalId: result.externalId ?? caseExternalId,
        newData: data,
      });

      result.success = true;
      result.durationMs = Date.now() - startTime;

      console.log(
        `[PushCasenote] Completed ${operation} for ${casenoteId} in ${result.durationMs}ms`
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.durationMs = Date.now() - startTime;

      await this.auditLog.log({
        officeId,
        entityType: 'casenote',
        operation,
        internalId: casenoteId,
        error: result.error,
      });

      console.error(`[PushCasenote] Failed:`, error);
      throw error;
    }
  }
}
