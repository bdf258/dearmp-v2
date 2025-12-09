// Gemini AI client wrapper for email classification and response generation

import type {
  EmailClassification,
  TagSuggestion,
  AssignmentSuggestion,
  DraftResponseSuggestion,
  ProcessingContext,
  Tag,
  User,
  Campaign,
  BulkResponse,
} from './types.ts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = 'gemini-2.0-flash-lite';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Call Gemini API with a prompt
 */
async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const response = await fetch(
    `${GEMINI_API_URL}/${MODEL_NAME}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data: GeminiResponse = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No response from Gemini API');
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Parse JSON from Gemini response, handling markdown code blocks
 */
function parseJsonResponse<T>(text: string): T {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
}

/**
 * Classify an email using Gemini
 */
export async function classifyEmail(
  subject: string,
  body: string,
  fromEmail: string,
  availableTags: Tag[],
  activeCampaigns: Campaign[]
): Promise<EmailClassification> {
  const tagList = availableTags.map((t) => `- ${t.name}: ${t.description || 'No description'}`).join('\n');
  const campaignList = activeCampaigns
    .map((c) => `- ${c.name}: ${c.description || 'No description'} (pattern: ${c.subject_pattern || 'none'})`)
    .join('\n');

  const systemInstruction = `You are an AI assistant for a UK Member of Parliament's office. Your task is to classify incoming emails to help staff triage and respond efficiently.

Classification types:
- "policy": Emails about political issues, legislation, campaigns, or policy positions the MP should consider. These are typically from constituents expressing opinions on national/local issues.
- "casework": Emails requesting personal assistance with government services, benefits, housing, immigration, or other individual problems that require case management.
- "campaign": Coordinated emails that are part of an organized campaign (often templated or very similar content from multiple senders).
- "spam": Unsolicited commercial emails, scams, or irrelevant content.
- "personal": Personal correspondence, invitations, or non-constituent business.

Key distinction between policy and casework:
- Policy: "I urge you to support the Climate Bill" (opinion on legislation)
- Casework: "I need help with my Universal Credit application" (personal assistance request)`;

  const prompt = `Classify this email and provide structured analysis.

FROM: ${fromEmail}
SUBJECT: ${subject}

EMAIL BODY:
${body}

AVAILABLE TAGS FOR THIS OFFICE:
${tagList || 'No tags defined'}

ACTIVE CAMPAIGNS:
${campaignList || 'No active campaigns'}

Respond with a JSON object (no markdown, just raw JSON):
{
  "email_type": "policy" | "casework" | "campaign" | "spam" | "personal",
  "is_policy_email": boolean (true for policy/campaign, false for casework),
  "confidence": number between 0 and 1,
  "reasoning": "Brief explanation of classification decision",
  "suggested_tags": ["tag_name_1", "tag_name_2"] (from available tags only),
  "is_campaign_email": boolean (true if this appears to be part of an organized campaign),
  "campaign_topic": "Topic if campaign email" | null,
  "priority": "low" | "medium" | "high" | "urgent",
  "sentiment": "positive" | "neutral" | "negative" | "urgent"
}`;

  const response = await callGemini(prompt, systemInstruction);
  return parseJsonResponse<EmailClassification>(response);
}

/**
 * Suggest tags for an email
 */
export async function suggestTags(
  subject: string,
  body: string,
  classification: EmailClassification,
  availableTags: Tag[]
): Promise<TagSuggestion[]> {
  if (availableTags.length === 0) {
    return [];
  }

  const tagList = availableTags
    .map((t) => `- ID: ${t.id}, Name: ${t.name}, Description: ${t.description || 'None'}, Keywords: ${t.auto_assign_keywords?.join(', ') || 'None'}`)
    .join('\n');

  const prompt = `Based on this email and its classification, suggest which tags should be applied.

SUBJECT: ${subject}

EMAIL BODY:
${body}

CLASSIFICATION: ${classification.email_type} (${classification.reasoning})

AVAILABLE TAGS:
${tagList}

Respond with a JSON array of tag suggestions (no markdown, just raw JSON):
[
  {
    "tag_id": "the tag ID from above",
    "tag_name": "the tag name",
    "confidence": number between 0 and 1,
    "reason": "Why this tag applies"
  }
]

Only suggest tags with confidence >= 0.6. Return empty array [] if no tags clearly apply.`;

  const response = await callGemini(prompt);
  return parseJsonResponse<TagSuggestion[]>(response);
}

/**
 * Suggest a staff member to handle this email
 */
export async function suggestAssignment(
  subject: string,
  body: string,
  classification: EmailClassification,
  availableUsers: User[],
  defaultCaseworkAssignee?: string,
  defaultPolicyAssignee?: string
): Promise<AssignmentSuggestion | null> {
  // Filter to active users who can handle this type
  const eligibleUsers = availableUsers.filter((u) => {
    if (!u.is_active) return false;
    if (classification.is_policy_email && !u.can_handle_policy) return false;
    if (!classification.is_policy_email && !u.can_handle_casework) return false;
    return true;
  });

  if (eligibleUsers.length === 0) {
    return null;
  }

  // If there's only one eligible user, assign to them
  if (eligibleUsers.length === 1) {
    return {
      user_id: eligibleUsers[0].id,
      user_name: eligibleUsers[0].name,
      confidence: 1.0,
      reason: 'Only eligible staff member',
    };
  }

  // Check for default assignee
  const defaultId = classification.is_policy_email ? defaultPolicyAssignee : defaultCaseworkAssignee;
  if (defaultId) {
    const defaultUser = eligibleUsers.find((u) => u.id === defaultId);
    if (defaultUser) {
      return {
        user_id: defaultUser.id,
        user_name: defaultUser.name,
        confidence: 0.9,
        reason: `Default ${classification.is_policy_email ? 'policy' : 'casework'} assignee`,
      };
    }
  }

  // Use AI to suggest based on specialties
  const userList = eligibleUsers
    .map((u) => `- ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Specialties: ${u.specialties?.join(', ') || 'General'}`)
    .join('\n');

  const prompt = `Suggest which staff member should handle this email.

SUBJECT: ${subject}
EMAIL TYPE: ${classification.email_type}
SUGGESTED TAGS: ${classification.suggested_tags.join(', ') || 'None'}

EMAIL BODY (first 500 chars):
${body.substring(0, 500)}

AVAILABLE STAFF:
${userList}

Respond with a JSON object (no markdown, just raw JSON):
{
  "user_id": "the user ID",
  "user_name": "the user name",
  "confidence": number between 0 and 1,
  "reason": "Why this person is best suited"
}

If no clear match, pick the first admin or the person with most general expertise.`;

  const response = await callGemini(prompt);
  return parseJsonResponse<AssignmentSuggestion>(response);
}

/**
 * Generate a draft response for a policy email
 */
export async function generateDraftResponse(
  subject: string,
  body: string,
  fromName: string,
  classification: EmailClassification,
  mpName: string,
  responseStyle: 'formal' | 'friendly' | 'brief',
  signatureTemplate?: string
): Promise<DraftResponseSuggestion> {
  const styleInstructions = {
    formal: 'Use formal, professional language appropriate for parliamentary correspondence. Include proper salutations and closings.',
    friendly: 'Use warm but professional language. Be personable while maintaining appropriate decorum.',
    brief: 'Keep the response concise and to the point. Acknowledge the issue and state the MP\'s position clearly without excessive elaboration.',
  };

  const systemInstruction = `You are drafting a response on behalf of a UK Member of Parliament. The response should:
- Acknowledge the constituent's concerns
- Express the MP's position or commitment to look into the matter
- Be appropriate for the tone and style requested
- NOT make specific policy commitments or promises unless directly relevant
- Be ready for the MP to review and personalize before sending`;

  const prompt = `Draft a response to this constituent email about a policy matter.

FROM: ${fromName || 'Constituent'}
SUBJECT: ${subject}

ORIGINAL EMAIL:
${body}

CLASSIFICATION:
- Type: ${classification.email_type}
- Topic: ${classification.campaign_topic || classification.suggested_tags.join(', ') || 'General policy'}
- Sentiment: ${classification.sentiment}

RESPONSE REQUIREMENTS:
- MP Name: ${mpName || '[MP Name]'}
- Style: ${styleInstructions[responseStyle]}
${signatureTemplate ? `- Signature: ${signatureTemplate}` : '- Include appropriate closing and MP name'}

Respond with a JSON object (no markdown, just raw JSON):
{
  "subject": "Re: ${subject}",
  "body": "The plain text response",
  "body_html": "<p>The HTML formatted response</p>",
  "tone": "${responseStyle}"
}

Make the response genuine and thoughtful. Do not use placeholder text like [topic] - use actual content from the email.`;

  const response = await callGemini(prompt, systemInstruction);
  return parseJsonResponse<DraftResponseSuggestion>(response);
}

/**
 * Generate a bulk response template for campaign emails
 */
export async function generateBulkResponse(
  subject: string,
  sampleBodies: string[],
  campaignTopic: string,
  mpName: string,
  responseStyle: 'formal' | 'friendly' | 'brief',
  signatureTemplate?: string
): Promise<DraftResponseSuggestion> {
  const combinedSamples = sampleBodies.slice(0, 3).join('\n\n---\n\n');

  const systemInstruction = `You are drafting a bulk response template for a UK Member of Parliament to respond to a coordinated email campaign. The response should:
- Acknowledge the campaign topic and constituent concerns
- Be general enough to apply to all campaign participants
- Include personalization variables: {{constituent_name}} for the recipient's name, {{mp_name}} for the MP's name
- Express the MP's position thoughtfully
- Be ready for MP review before mass sending`;

  const prompt = `Draft a bulk response template for this email campaign.

CAMPAIGN TOPIC: ${campaignTopic}
SUBJECT PATTERN: ${subject}

SAMPLE EMAILS FROM THIS CAMPAIGN:
${combinedSamples}

RESPONSE REQUIREMENTS:
- MP Name: ${mpName || '[MP Name]'}
- Style: ${responseStyle}
- Include {{constituent_name}} variable for personalization
- Include {{mp_name}} variable for MP name
${signatureTemplate ? `- Signature template: ${signatureTemplate}` : ''}

Respond with a JSON object (no markdown, just raw JSON):
{
  "subject": "Re: [appropriate subject based on campaign]",
  "body": "The plain text template with {{constituent_name}} and {{mp_name}} variables",
  "body_html": "<p>The HTML template with variables</p>",
  "tone": "${responseStyle}"
}

The response should be genuine and address the campaign's core concerns.`;

  const response = await callGemini(prompt, systemInstruction);
  return parseJsonResponse<DraftResponseSuggestion>(response);
}

/**
 * Generate a content fingerprint for campaign detection
 */
export function generateFingerprint(subject: string, body: string): string {
  // Normalize content
  const normalized = `${subject} ${body}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Simple hash function (for demo - in production use proper crypto)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Check if an email is similar to existing campaign emails
 */
export async function detectCampaignSimilarity(
  subject: string,
  body: string,
  existingCampaigns: Campaign[],
  existingBulkResponses: BulkResponse[]
): Promise<{ isCampaign: boolean; matchedCampaignId?: string; matchedBulkResponseId?: string; similarity: number }> {
  const fingerprint = generateFingerprint(subject, body);

  // Check against existing bulk responses first
  for (const br of existingBulkResponses) {
    if (br.fingerprint_hash === fingerprint) {
      return {
        isCampaign: true,
        matchedCampaignId: br.campaign_id || undefined,
        matchedBulkResponseId: br.id,
        similarity: 1.0,
      };
    }
  }

  // Check against campaign subject patterns
  for (const campaign of existingCampaigns) {
    if (campaign.status !== 'active') continue;

    // Check fingerprint match
    if (campaign.fingerprint_hash === fingerprint) {
      const matchedBr = existingBulkResponses.find((br) => br.campaign_id === campaign.id);
      return {
        isCampaign: true,
        matchedCampaignId: campaign.id,
        matchedBulkResponseId: matchedBr?.id,
        similarity: 1.0,
      };
    }

    // Check subject pattern match
    if (campaign.subject_pattern) {
      try {
        const regex = new RegExp(campaign.subject_pattern, 'i');
        if (regex.test(subject)) {
          const matchedBr = existingBulkResponses.find((br) => br.campaign_id === campaign.id);
          return {
            isCampaign: true,
            matchedCampaignId: campaign.id,
            matchedBulkResponseId: matchedBr?.id,
            similarity: 0.8,
          };
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  return { isCampaign: false, similarity: 0 };
}
