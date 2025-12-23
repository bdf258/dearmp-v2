/**
 * DTO: TriageContextDto
 *
 * Context data passed to the LLM for email analysis and triage suggestions.
 * This DTO contains all the information needed to generate intelligent
 * suggestions for constituent matching, case creation, and categorization.
 */

/**
 * Email content for LLM analysis
 */
export interface EmailContentForAnalysis {
  subject: string;
  body: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: string;
}

/**
 * Reference data type for LLM context
 */
export interface ReferenceDataItem {
  id: number;
  name: string;
  description?: string;
  keywords?: string[];
}

/**
 * Constituent context for LLM
 */
export interface ConstituentContextDto {
  id: string;
  externalId: number;
  fullName: string;
  title?: string;
  isOrganisation: boolean;
  previousCaseCount: number;
  lastContactDate?: string;
}

/**
 * Case context for LLM (existing open cases)
 */
export interface CaseContextDto {
  id: string;
  externalId: number;
  summary?: string;
  caseTypeName?: string;
  categoryName?: string;
  statusName?: string;
  createdAt: string;
  lastActivityAt?: string;
}

/**
 * Campaign context for LLM
 */
export interface CampaignContextDto {
  id: string;
  name: string;
  description?: string;
  emailCount: number;
  matchConfidence: number;
  matchType: 'pattern' | 'fingerprint' | 'fuzzy';
}

/**
 * Office reference data for suggestions
 */
export interface OfficeReferenceDataDto {
  caseTypes: ReferenceDataItem[];
  categoryTypes: ReferenceDataItem[];
  statusTypes: ReferenceDataItem[];
  caseworkers: Array<{
    id: number;
    name: string;
    email?: string;
    specialties?: string[];
  }>;
  tags: Array<{
    id: string;
    name: string;
    color: string;
    description?: string;
    keywords?: string[];
  }>;
}

/**
 * Complete triage context for LLM analysis
 */
export interface TriageContextDto {
  // The email being triaged
  email: EmailContentForAnalysis;

  // Matched constituent (if found)
  matchedConstituent?: ConstituentContextDto;

  // Constituent match confidence (0-1)
  constituentMatchConfidence?: number;

  // Existing open cases for the matched constituent
  existingCases: CaseContextDto[];

  // Matched campaigns (sorted by confidence)
  matchedCampaigns: CampaignContextDto[];

  // Office reference data for making suggestions
  referenceData: OfficeReferenceDataDto;

  // Office-specific context
  officeContext?: {
    mpName?: string;
    constituencyName?: string;
    officeGuidelines?: string;
  };
}

/**
 * LLM suggestion output structure
 */
export interface TriageSuggestionDto {
  // Classification
  emailType: 'casework' | 'policy' | 'campaign' | 'spam' | 'personal';
  classificationConfidence: number;
  classificationReasoning?: string;

  // Recommended action
  recommendedAction: 'create_case' | 'add_to_case' | 'assign_campaign' | 'ignore';
  actionConfidence: number;
  actionReasoning?: string;

  // For 'add_to_case' - which existing case to add to
  suggestedExistingCaseId?: string;
  suggestedExistingCaseConfidence?: number;

  // For 'assign_campaign' - which campaign to assign to
  suggestedCampaignId?: string;
  suggestedCampaignConfidence?: number;

  // Case details suggestions (for create_case or add_to_case)
  suggestedCaseType?: {
    id: number;
    name: string;
    confidence: number;
  };
  suggestedCategory?: {
    id: number;
    name: string;
    confidence: number;
  };
  suggestedAssignee?: {
    id: number;
    name: string;
    confidence: number;
    reasoning?: string;
  };
  suggestedPriority: 'low' | 'medium' | 'high' | 'urgent';
  priorityConfidence: number;

  // Suggested tags
  suggestedTags?: Array<{
    id: string;
    name: string;
    confidence: number;
  }>;

  // Case summary generated from email
  suggestedSummary?: string;

  // Suggested review date (ISO string)
  suggestedReviewDate?: string;

  // Draft response (for policy/campaign emails)
  suggestedResponse?: string;

  // Constituent details extracted from email
  extractedConstituentDetails?: {
    name?: string;
    address?: string;
    phone?: string;
    postcode?: string;
  };
}

/**
 * Helper function to build triage context for LLM
 */
export function buildTriageContextPrompt(context: TriageContextDto): string {
  const lines: string[] = [];

  // Email content
  lines.push('## Email Being Triaged');
  lines.push(`**Subject:** ${context.email.subject}`);
  lines.push(`**From:** ${context.email.senderName ? `${context.email.senderName} <${context.email.senderEmail}>` : context.email.senderEmail}`);
  lines.push(`**Received:** ${context.email.receivedAt}`);
  lines.push('');
  lines.push('**Body:**');
  lines.push(context.email.body);
  lines.push('');

  // Constituent match
  if (context.matchedConstituent) {
    lines.push('## Matched Constituent');
    lines.push(`**Name:** ${context.matchedConstituent.fullName}`);
    lines.push(`**Type:** ${context.matchedConstituent.isOrganisation ? 'Organisation' : 'Individual'}`);
    lines.push(`**Previous Cases:** ${context.matchedConstituent.previousCaseCount}`);
    if (context.matchedConstituent.lastContactDate) {
      lines.push(`**Last Contact:** ${context.matchedConstituent.lastContactDate}`);
    }
    lines.push(`**Match Confidence:** ${Math.round((context.constituentMatchConfidence || 0) * 100)}%`);
    lines.push('');
  } else {
    lines.push('## Constituent Status');
    lines.push('No existing constituent match found. This may be a new constituent.');
    lines.push('');
  }

  // Existing cases
  if (context.existingCases.length > 0) {
    lines.push('## Open Cases for This Constituent');
    for (const caseItem of context.existingCases) {
      lines.push(`- **Case ${caseItem.externalId}:** ${caseItem.summary || 'No summary'}`);
      lines.push(`  - Type: ${caseItem.caseTypeName || 'Unknown'}, Category: ${caseItem.categoryName || 'Unknown'}`);
      lines.push(`  - Status: ${caseItem.statusName || 'Unknown'}, Created: ${caseItem.createdAt}`);
    }
    lines.push('');
  }

  // Campaign matches
  if (context.matchedCampaigns.length > 0) {
    lines.push('## Potential Campaign Matches');
    for (const campaign of context.matchedCampaigns) {
      lines.push(`- **${campaign.name}** (${Math.round(campaign.matchConfidence * 100)}% confidence, ${campaign.matchType} match)`);
      if (campaign.description) {
        lines.push(`  - ${campaign.description}`);
      }
      lines.push(`  - ${campaign.emailCount} emails in this campaign`);
    }
    lines.push('');
  }

  // Reference data summary
  lines.push('## Available Categories');
  lines.push('Case Types: ' + context.referenceData.caseTypes.map(ct => ct.name).join(', '));
  lines.push('Category Types: ' + context.referenceData.categoryTypes.map(ct => ct.name).join(', '));
  lines.push('');

  // Office context
  if (context.officeContext) {
    lines.push('## Office Context');
    if (context.officeContext.mpName) {
      lines.push(`**MP:** ${context.officeContext.mpName}`);
    }
    if (context.officeContext.constituencyName) {
      lines.push(`**Constituency:** ${context.officeContext.constituencyName}`);
    }
    if (context.officeContext.officeGuidelines) {
      lines.push(`**Guidelines:** ${context.officeContext.officeGuidelines}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
