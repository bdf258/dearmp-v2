/**
 * GeminiLLMService
 *
 * Implementation of ILLMAnalysisService using Google's Gemini 2.0 Flash model.
 * Uses structured output to guarantee JSON schema compliance.
 */

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  TriageContextDto,
  TriageSuggestionDto,
  buildTriageContextPrompt,
} from '../../application/dtos';
import { ILLMAnalysisService } from '../../application/services';

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zod schema for the LLM response - ensures structured output
 */
const TriageSuggestionSchema = z.object({
  // Classification
  emailType: z.enum(['casework', 'policy', 'campaign', 'spam', 'personal']).describe(
    'The type of email: casework (constituent needs help), policy (opinion on legislation), campaign (organized mass email), spam (junk), personal (non-constituent business)'
  ),
  classificationConfidence: z.number().min(0).max(1).describe(
    'Confidence in the email type classification (0-1)'
  ),
  classificationReasoning: z.string().optional().describe(
    'Brief explanation of why this classification was chosen'
  ),

  // Recommended action
  recommendedAction: z.enum(['create_case', 'add_to_case', 'assign_campaign', 'ignore']).describe(
    'What action to take: create_case (new constituent issue), add_to_case (relates to existing case), assign_campaign (bulk campaign email), ignore (spam/not relevant)'
  ),
  actionConfidence: z.number().min(0).max(1).describe(
    'Confidence in the recommended action (0-1)'
  ),
  actionReasoning: z.string().optional().describe(
    'Brief explanation of why this action is recommended'
  ),

  // For add_to_case - which existing case to add to
  suggestedExistingCaseId: z.string().optional().describe(
    'If action is add_to_case, the ID of the existing case to add to'
  ),
  suggestedExistingCaseConfidence: z.number().min(0).max(1).optional().describe(
    'Confidence that this email relates to the suggested existing case'
  ),

  // For assign_campaign - which campaign to assign to
  suggestedCampaignId: z.string().optional().describe(
    'If action is assign_campaign, the ID of the campaign to assign to'
  ),
  suggestedCampaignConfidence: z.number().min(0).max(1).optional().describe(
    'Confidence that this email belongs to the suggested campaign'
  ),

  // Case details suggestions
  suggestedCaseType: z.object({
    id: z.number().describe('The case type ID from reference data'),
    name: z.string().describe('The case type name'),
    confidence: z.number().min(0).max(1).describe('Confidence in this suggestion'),
  }).optional().describe('Suggested case type for new cases'),

  suggestedCategory: z.object({
    id: z.number().describe('The category ID from reference data'),
    name: z.string().describe('The category name'),
    confidence: z.number().min(0).max(1).describe('Confidence in this suggestion'),
  }).optional().describe('Suggested category for the case'),

  suggestedAssignee: z.object({
    id: z.number().describe('The caseworker ID from reference data'),
    name: z.string().describe('The caseworker name'),
    confidence: z.number().min(0).max(1).describe('Confidence in this suggestion'),
    reasoning: z.string().optional().describe('Why this caseworker was suggested'),
  }).optional().describe('Suggested caseworker to assign the case to'),

  suggestedPriority: z.enum(['low', 'medium', 'high', 'urgent']).describe(
    'Suggested priority level: low (routine), medium (standard), high (time-sensitive), urgent (immediate action needed)'
  ),
  priorityConfidence: z.number().min(0).max(1).describe(
    'Confidence in the priority suggestion'
  ),

  // Suggested tags
  suggestedTags: z.array(z.object({
    id: z.string().describe('The tag ID from reference data'),
    name: z.string().describe('The tag name'),
    confidence: z.number().min(0).max(1).describe('Confidence this tag applies'),
  })).optional().describe('Suggested tags to apply to the case'),

  // Case summary
  suggestedSummary: z.string().optional().describe(
    'A concise summary of the constituent\'s issue (2-3 sentences max)'
  ),

  // Review date
  suggestedReviewDate: z.string().optional().describe(
    'Suggested review date in ISO format if the case needs follow-up'
  ),

  // Draft response for policy/campaign emails
  suggestedResponse: z.string().optional().describe(
    'Draft response for policy or campaign emails'
  ),

  // Extracted constituent details
  extractedConstituentDetails: z.object({
    name: z.string().optional().describe('Full name if found in email'),
    address: z.string().optional().describe('Address if found in email'),
    phone: z.string().optional().describe('Phone number if found in email'),
    postcode: z.string().optional().describe('Postcode if found in email'),
  }).optional().describe('Contact details extracted from the email body'),
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert email triage assistant for a UK Member of Parliament's office. Your role is to analyze incoming emails and provide structured suggestions to help caseworkers efficiently process their inbox.

## Your Responsibilities

1. **Classify emails** accurately into one of these types:
   - **casework**: A constituent is asking for help with a personal issue (benefits, housing, immigration, NHS, etc.)
   - **policy**: A constituent is expressing an opinion about legislation, government policy, or asking the MP's position
   - **campaign**: An organized email campaign (often identical or near-identical emails from many senders)
   - **spam**: Unsolicited commercial email or irrelevant content
   - **personal**: Non-constituent business, press enquiries, invitations, etc.

2. **Recommend the appropriate action**:
   - **create_case**: Create a new case for casework emails from constituents
   - **add_to_case**: Link to an existing open case if this email relates to ongoing casework
   - **assign_campaign**: Assign to an existing campaign if detected
   - **ignore**: For spam or emails that don't require action

3. **Suggest metadata** for efficient processing:
   - Case type and category from the available options
   - Priority level based on urgency signals
   - Appropriate caseworker based on their specialties
   - Relevant tags for categorization

4. **Extract information**:
   - Create a concise case summary
   - Extract constituent contact details if provided in the email
   - Suggest a review date if follow-up is needed

## Guidelines

- Always prioritize constituent welfare - err on the side of creating cases for genuine requests
- Look for urgency signals: words like "urgent", "emergency", deadlines, eviction notices, etc.
- Check if the sender's email matches a known constituent
- Consider if the email relates to any existing open cases
- For campaign emails, check the matched campaigns list
- Match case types and categories to the available reference data
- UK postcodes are typically in formats like "SW1A 1AA" or "M1 1AA"
- Be concise in summaries - focus on the core issue

## Important

- Only suggest case types, categories, and assignees that exist in the provided reference data
- Only suggest tags that are available in the reference data
- If unsure, set lower confidence scores so caseworkers know to review carefully
- For campaign emails, prioritize bulk processing efficiency`;

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export interface GeminiLLMServiceConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Debug info returned from LLM analysis
 */
export interface LLMAnalysisDebugInfo {
  fullPrompt: string;
  rawResponse: string;
  parsedSuggestion: TriageSuggestionDto;
  model: string;
  llmDurationMs: number;
}

/**
 * Result with optional debug info
 */
export interface LLMAnalysisResult {
  suggestion: TriageSuggestionDto;
  debugInfo?: LLMAnalysisDebugInfo;
}

export class GeminiLLMService implements ILLMAnalysisService {
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly maxRetries: number;

  constructor(config: GeminiLLMServiceConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gemini-2.0-flash';
    this.maxRetries = config.maxRetries ?? 3;
    // Note: config.timeoutMs is accepted but not currently used
    // Future implementation could use AbortController for request timeout
  }

  /**
   * Analyze an email and generate triage suggestions
   */
  async analyzeEmail(context: TriageContextDto): Promise<TriageSuggestionDto> {
    const result = await this.analyzeEmailWithDebug(context);
    return result.suggestion;
  }

  /**
   * Analyze an email and return both suggestions and debug info
   * Used for test emails to show what's happening inside the LLM
   */
  async analyzeEmailWithDebug(context: TriageContextDto): Promise<LLMAnalysisResult> {
    const prompt = this.buildPrompt(context);
    const jsonSchema = zodToJsonSchema(TriageSuggestionSchema, 'TriageSuggestion');

    let lastError: Error | null = null;
    let rawResponse: string | undefined;
    let llmStartTime = Date.now();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        llmStartTime = Date.now();
        rawResponse = await this.callGemini(prompt, jsonSchema);
        const llmDurationMs = Date.now() - llmStartTime;
        const parsed = this.parseAndValidate(rawResponse, context);

        return {
          suggestion: parsed,
          debugInfo: {
            fullPrompt: prompt,
            rawResponse: rawResponse,
            parsedSuggestion: parsed,
            model: this.model,
            llmDurationMs,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[GeminiLLMService] Attempt ${attempt}/${this.maxRetries} failed:`, lastError.message);

        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }

    console.error('[GeminiLLMService] All retries exhausted, returning fallback');
    const fallback = this.getFallbackSuggestion(context);

    return {
      suggestion: fallback,
      debugInfo: {
        fullPrompt: prompt,
        rawResponse: rawResponse || `LLM failed after ${this.maxRetries} attempts: ${lastError?.message}`,
        parsedSuggestion: fallback,
        model: this.model,
        llmDurationMs: Date.now() - llmStartTime,
      },
    };
  }

  /**
   * Build the prompt for the LLM
   */
  private buildPrompt(context: TriageContextDto): string {
    const contextPrompt = buildTriageContextPrompt(context);

    return `${SYSTEM_PROMPT}

---

${contextPrompt}

---

Analyze this email and provide your triage suggestions. Use the reference data provided to suggest appropriate case types, categories, assignees, and tags.`;
  }

  /**
   * Call the Gemini API with structured output
   */
  private async callGemini(
    prompt: string,
    jsonSchema: ReturnType<typeof zodToJsonSchema>
  ): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as object,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    return text;
  }

  /**
   * Parse and validate the LLM response
   */
  private parseAndValidate(
    response: string,
    context: TriageContextDto
  ): TriageSuggestionDto {
    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }

    // Validate against schema
    const validated = TriageSuggestionSchema.parse(parsed);

    // Build result object, only including optional fields if they have values
    // This satisfies TypeScript's exactOptionalPropertyTypes
    const result: TriageSuggestionDto = {
      emailType: validated.emailType,
      classificationConfidence: validated.classificationConfidence,
      recommendedAction: validated.recommendedAction,
      actionConfidence: validated.actionConfidence,
      suggestedPriority: validated.suggestedPriority,
      priorityConfidence: validated.priorityConfidence,
    };

    // Add optional string fields only if present
    if (validated.classificationReasoning) result.classificationReasoning = validated.classificationReasoning;
    if (validated.actionReasoning) result.actionReasoning = validated.actionReasoning;
    if (validated.suggestedExistingCaseId) result.suggestedExistingCaseId = validated.suggestedExistingCaseId;
    if (validated.suggestedExistingCaseConfidence !== undefined) result.suggestedExistingCaseConfidence = validated.suggestedExistingCaseConfidence;
    if (validated.suggestedCampaignId) result.suggestedCampaignId = validated.suggestedCampaignId;
    if (validated.suggestedCampaignConfidence !== undefined) result.suggestedCampaignConfidence = validated.suggestedCampaignConfidence;
    if (validated.suggestedSummary) result.suggestedSummary = validated.suggestedSummary;
    if (validated.suggestedReviewDate) result.suggestedReviewDate = validated.suggestedReviewDate;
    if (validated.suggestedResponse) result.suggestedResponse = validated.suggestedResponse;

    // Add optional object fields only if present
    if (validated.suggestedCaseType) result.suggestedCaseType = validated.suggestedCaseType;
    if (validated.suggestedCategory) result.suggestedCategory = validated.suggestedCategory;
    if (validated.suggestedTags && validated.suggestedTags.length > 0) result.suggestedTags = validated.suggestedTags;

    // Handle suggestedAssignee specially to strip undefined reasoning
    if (validated.suggestedAssignee) {
      const assignee: TriageSuggestionDto['suggestedAssignee'] = {
        id: validated.suggestedAssignee.id,
        name: validated.suggestedAssignee.name,
        confidence: validated.suggestedAssignee.confidence,
      };
      if (validated.suggestedAssignee.reasoning) {
        assignee.reasoning = validated.suggestedAssignee.reasoning;
      }
      result.suggestedAssignee = assignee;
    }

    // Handle extractedConstituentDetails specially
    if (validated.extractedConstituentDetails) {
      const details: NonNullable<TriageSuggestionDto['extractedConstituentDetails']> = {};
      if (validated.extractedConstituentDetails.name) details.name = validated.extractedConstituentDetails.name;
      if (validated.extractedConstituentDetails.address) details.address = validated.extractedConstituentDetails.address;
      if (validated.extractedConstituentDetails.phone) details.phone = validated.extractedConstituentDetails.phone;
      if (validated.extractedConstituentDetails.postcode) details.postcode = validated.extractedConstituentDetails.postcode;
      if (Object.keys(details).length > 0) result.extractedConstituentDetails = details;
    }

    // Validate that suggested IDs actually exist in the reference data
    this.validateAgainstReferenceData(result, context);

    return result;
  }

  /**
   * Validate that LLM suggestions match available reference data
   * Uses delete operator to remove invalid optional properties
   */
  private validateAgainstReferenceData(
    suggestion: TriageSuggestionDto,
    context: TriageContextDto
  ): void {
    // Validate case type
    if (suggestion.suggestedCaseType) {
      const exists = context.referenceData.caseTypes.some(
        ct => ct.id === suggestion.suggestedCaseType!.id
      );
      if (!exists) {
        console.warn(
          `[GeminiLLMService] Suggested case type ${suggestion.suggestedCaseType.id} not in reference data`
        );
        delete suggestion.suggestedCaseType;
      }
    }

    // Validate category
    if (suggestion.suggestedCategory) {
      const exists = context.referenceData.categoryTypes.some(
        ct => ct.id === suggestion.suggestedCategory!.id
      );
      if (!exists) {
        console.warn(
          `[GeminiLLMService] Suggested category ${suggestion.suggestedCategory.id} not in reference data`
        );
        delete suggestion.suggestedCategory;
      }
    }

    // Validate assignee
    if (suggestion.suggestedAssignee) {
      const exists = context.referenceData.caseworkers.some(
        cw => cw.id === suggestion.suggestedAssignee!.id
      );
      if (!exists) {
        console.warn(
          `[GeminiLLMService] Suggested assignee ${suggestion.suggestedAssignee.id} not in reference data`
        );
        delete suggestion.suggestedAssignee;
      }
    }

    // Validate tags
    if (suggestion.suggestedTags) {
      const validTags = suggestion.suggestedTags.filter(tag => {
        const exists = context.referenceData.tags.some(t => t.id === tag.id);
        if (!exists) {
          console.warn(`[GeminiLLMService] Suggested tag ${tag.id} not in reference data`);
        }
        return exists;
      });
      if (validTags.length > 0) {
        suggestion.suggestedTags = validTags;
      } else {
        delete suggestion.suggestedTags;
      }
    }

    // Validate existing case suggestion
    if (suggestion.suggestedExistingCaseId) {
      const exists = context.existingCases.some(
        c => c.id === suggestion.suggestedExistingCaseId
      );
      if (!exists) {
        console.warn(
          `[GeminiLLMService] Suggested case ${suggestion.suggestedExistingCaseId} not in existing cases`
        );
        delete suggestion.suggestedExistingCaseId;
        delete suggestion.suggestedExistingCaseConfidence;
        // If action was add_to_case but no valid case, fall back to create_case
        if (suggestion.recommendedAction === 'add_to_case') {
          suggestion.recommendedAction = 'create_case';
          suggestion.actionReasoning = 'Suggested case not found, recommending new case instead';
        }
      }
    }

    // Validate campaign suggestion
    if (suggestion.suggestedCampaignId) {
      const exists = context.matchedCampaigns.some(
        c => c.id === suggestion.suggestedCampaignId
      );
      if (!exists) {
        console.warn(
          `[GeminiLLMService] Suggested campaign ${suggestion.suggestedCampaignId} not in matched campaigns`
        );
        delete suggestion.suggestedCampaignId;
        delete suggestion.suggestedCampaignConfidence;
        // If action was assign_campaign but no valid campaign, change action
        if (suggestion.recommendedAction === 'assign_campaign') {
          const firstCampaign = context.matchedCampaigns[0];
          if (firstCampaign) {
            suggestion.suggestedCampaignId = firstCampaign.id;
            suggestion.suggestedCampaignConfidence = firstCampaign.matchConfidence;
          } else {
            suggestion.recommendedAction = 'create_case';
            suggestion.actionReasoning = 'No valid campaign found, recommending new case';
          }
        }
      }
    }
  }

  /**
   * Generate a fallback suggestion when LLM fails
   */
  private getFallbackSuggestion(context: TriageContextDto): TriageSuggestionDto {
    // Use campaign if high confidence match exists
    const firstCampaign = context.matchedCampaigns[0];
    if (firstCampaign && firstCampaign.matchConfidence >= 0.8) {
      return {
        emailType: 'campaign',
        classificationConfidence: firstCampaign.matchConfidence,
        classificationReasoning: `Matched to campaign: ${firstCampaign.name}`,
        recommendedAction: 'assign_campaign',
        actionConfidence: firstCampaign.matchConfidence,
        suggestedCampaignId: firstCampaign.id,
        suggestedCampaignConfidence: firstCampaign.matchConfidence,
        suggestedPriority: 'low',
        priorityConfidence: 0.7,
      };
    }

    // Check for existing cases
    const firstCase = context.existingCases[0];
    if (firstCase && context.matchedConstituent) {
      return {
        emailType: 'casework',
        classificationConfidence: 0.6,
        classificationReasoning: 'Known constituent with existing cases',
        recommendedAction: 'add_to_case',
        actionConfidence: 0.5,
        actionReasoning: 'Review existing cases for relevance',
        suggestedExistingCaseId: firstCase.id,
        suggestedExistingCaseConfidence: 0.5,
        suggestedPriority: 'medium',
        priorityConfidence: 0.5,
        suggestedSummary: context.email.subject || 'Email requires manual review',
      };
    }

    // Default fallback
    return {
      emailType: 'casework',
      classificationConfidence: 0.4,
      classificationReasoning: 'LLM analysis failed - manual review required',
      recommendedAction: 'create_case',
      actionConfidence: 0.4,
      actionReasoning: 'Unable to analyze automatically - please review manually',
      suggestedPriority: 'medium',
      priorityConfidence: 0.5,
      suggestedSummary: context.email.subject || 'Email requires manual review',
    };
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
