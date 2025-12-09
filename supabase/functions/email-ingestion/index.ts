// Email Ingestion Edge Function
// Triggered when new messages are inserted to classify, tag, assign, and draft responses

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import {
  classifyEmail,
  suggestTags,
  suggestAssignment,
  generateDraftResponse,
  generateBulkResponse,
  generateFingerprint,
  detectCampaignSimilarity,
} from '../_shared/gemini.ts';
import {
  handleCors,
  jsonResponse,
  errorResponse,
  log,
  validateEnv,
  createSnippet,
} from '../_shared/utils.ts';
import type {
  Message,
  Office,
  OfficeSettings,
  Tag,
  User,
  Campaign,
  BulkResponse,
  AIProcessingResult,
  ProcessingContext,
} from '../_shared/types.ts';

/**
 * Main handler for email ingestion
 */
serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Validate environment
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']);

    const supabase = getSupabaseClient();

    // Parse request body
    const body = await req.json();
    const { message_id, office_id } = body;

    if (!message_id) {
      return errorResponse('message_id is required', 400);
    }

    log('info', 'Processing email ingestion', { message_id, office_id });

    // Fetch the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError || !message) {
      log('error', 'Failed to fetch message', { message_id, error: messageError });
      return errorResponse(`Message not found: ${message_id}`, 404);
    }

    // Skip if already processed
    if (message.ai_processed_at) {
      log('info', 'Message already processed', { message_id });
      return jsonResponse({ success: true, skipped: true, reason: 'Already processed' });
    }

    // Skip outbound messages
    if (message.direction !== 'inbound') {
      log('info', 'Skipping outbound message', { message_id });
      return jsonResponse({ success: true, skipped: true, reason: 'Outbound message' });
    }

    // Fetch context data in parallel
    const contextPromises = await Promise.all([
      supabase.from('offices').select('*').eq('id', message.office_id).single(),
      supabase.from('office_settings').select('*').eq('office_id', message.office_id).single(),
      supabase.from('tags').select('*').eq('office_id', message.office_id),
      supabase.from('users').select('*').eq('office_id', message.office_id).eq('is_active', true),
      supabase.from('campaigns').select('*').eq('office_id', message.office_id).eq('status', 'active'),
      supabase.from('bulk_responses').select('*').eq('office_id', message.office_id),
    ]);

    const [officeResult, settingsResult, tagsResult, usersResult, campaignsResult, bulkResponsesResult] = contextPromises;

    if (officeResult.error || !officeResult.data) {
      log('error', 'Failed to fetch office', { office_id: message.office_id, error: officeResult.error });
      return errorResponse('Office not found', 404);
    }

    const context: ProcessingContext = {
      message: message as Message,
      office: officeResult.data as Office,
      office_settings: (settingsResult.data || {
        ai_classification_enabled: true,
        ai_draft_response_enabled: true,
        ai_tagging_enabled: true,
        auto_assign_enabled: true,
        round_robin_enabled: false,
        policy_response_style: 'formal',
        casework_acknowledgment_enabled: false,
      }) as OfficeSettings,
      available_tags: (tagsResult.data || []) as Tag[],
      available_users: (usersResult.data || []) as User[],
      active_campaigns: (campaignsResult.data || []) as Campaign[],
      existing_bulk_responses: (bulkResponsesResult.data || []) as BulkResponse[],
    };

    // Process the email
    const result = await processEmail(context, supabase);

    log('info', 'Email processing completed', {
      message_id,
      email_type: result.classification.email_type,
      is_campaign: result.classification.is_campaign_email,
      tags_added: result.tags.length,
      assigned_to: result.assignment?.user_id,
      draft_created: !!result.draft_response,
    });

    return jsonResponse({
      success: true,
      result: {
        classification: result.classification,
        tags: result.tags.map((t) => t.tag_name),
        assigned_to: result.assignment?.user_name,
        draft_response_created: !!result.draft_response,
        existing_bulk_response: !!result.existing_bulk_response_id,
      },
    });
  } catch (error) {
    log('error', 'Email ingestion failed', { error: (error as Error).message });
    return errorResponse(`Processing failed: ${(error as Error).message}`, 500);
  }
});

/**
 * Process an email through the AI pipeline
 */
async function processEmail(
  context: ProcessingContext,
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<AIProcessingResult> {
  const { message, office, office_settings, available_tags, available_users, active_campaigns, existing_bulk_responses } = context;

  // Generate fingerprint for campaign detection
  const fingerprint = generateFingerprint(message.subject, message.body);

  // Step 1: Classify the email
  log('info', 'Classifying email', { message_id: message.id });
  const classification = await classifyEmail(
    message.subject,
    message.body,
    message.from_email,
    available_tags,
    active_campaigns
  );

  // Step 2: Check for campaign similarity
  const campaignMatch = await detectCampaignSimilarity(
    message.subject,
    message.body,
    active_campaigns,
    existing_bulk_responses
  );

  // Override campaign detection if AI found it
  if (campaignMatch.isCampaign || classification.is_campaign_email) {
    classification.is_campaign_email = true;
    classification.email_type = 'campaign';
  }

  // Step 3: Suggest tags (if enabled)
  let tagSuggestions: AIProcessingResult['tags'] = [];
  if (office_settings.ai_tagging_enabled && available_tags.length > 0) {
    log('info', 'Suggesting tags', { message_id: message.id });
    tagSuggestions = await suggestTags(
      message.subject,
      message.body,
      classification,
      available_tags
    );
  }

  // Step 4: Suggest assignment (if enabled)
  let assignmentSuggestion: AIProcessingResult['assignment'] = undefined;
  if (office_settings.auto_assign_enabled && available_users.length > 0) {
    log('info', 'Suggesting assignment', { message_id: message.id });
    assignmentSuggestion = await suggestAssignment(
      message.subject,
      message.body,
      classification,
      available_users,
      office_settings.default_casework_assignee || undefined,
      office_settings.default_policy_assignee || undefined
    ) || undefined;
  }

  // Step 5: Generate draft response (if applicable)
  let draftResponse: AIProcessingResult['draft_response'] = undefined;
  let existingBulkResponseId: string | undefined = undefined;

  // Only draft responses for policy/campaign emails, NOT casework
  if (office_settings.ai_draft_response_enabled && classification.is_policy_email) {
    if (classification.is_campaign_email) {
      // Campaign email handling
      if (campaignMatch.matchedBulkResponseId) {
        // Existing bulk response - just link to it
        log('info', 'Using existing bulk response', {
          message_id: message.id,
          bulk_response_id: campaignMatch.matchedBulkResponseId,
        });
        existingBulkResponseId = campaignMatch.matchedBulkResponseId;
      } else {
        // First email in campaign - generate bulk response
        log('info', 'Generating bulk response template', { message_id: message.id });

        // Get sample emails with similar fingerprint
        const { data: similarMessages } = await supabase
          .from('messages')
          .select('body')
          .eq('fingerprint_hash', fingerprint)
          .limit(3);

        const sampleBodies = similarMessages?.map((m) => m.body) || [message.body];

        draftResponse = await generateBulkResponse(
          message.subject,
          sampleBodies,
          classification.campaign_topic || classification.suggested_tags.join(', ') || 'Policy matter',
          office.mp_name || '[MP Name]',
          office_settings.policy_response_style as 'formal' | 'friendly' | 'brief',
          office.signature_template || undefined
        );

        // Create the bulk response record
        // Note: campaign_id is required per schema - use matched campaign or skip creation
        if (!campaignMatch.matchedCampaignId) {
          log('warn', 'Cannot create bulk response without campaign_id', { message_id: message.id });
        }
        const { data: newBulkResponse, error: bulkError } = campaignMatch.matchedCampaignId ? await supabase
          .from('bulk_responses')
          .insert({
            office_id: message.office_id,
            campaign_id: campaignMatch.matchedCampaignId,
            subject: draftResponse.subject,
            body_markdown: draftResponse.body,
            status: 'draft',
          })
          .select()
          .single() : { data: null, error: null };

        if (!bulkError && newBulkResponse) {
          existingBulkResponseId = newBulkResponse.id;
          log('info', 'Created bulk response', { bulk_response_id: newBulkResponse.id });
        }
      }
    } else {
      // Individual policy email - generate individual draft
      log('info', 'Generating individual draft response', { message_id: message.id });
      draftResponse = await generateDraftResponse(
        message.subject,
        message.body,
        message.from_name || message.from_email,
        classification,
        office.mp_name || '[MP Name]',
        office_settings.policy_response_style as 'formal' | 'friendly' | 'brief',
        office.signature_template || undefined
      );
    }
  }

  // Step 6: Update the message with classification results
  const updateData: Partial<Message> = {
    is_policy_email: classification.is_policy_email,
    email_type: classification.email_type,
    classification_confidence: classification.confidence,
    classification_reasoning: classification.reasoning,
    fingerprint_hash: fingerprint,
    is_campaign_email: classification.is_campaign_email,
    campaign_id: campaignMatch.matchedCampaignId || null,
    ai_processed_at: new Date().toISOString(),
    is_triage_needed: true, // Still needs human review
  };

  if (assignmentSuggestion) {
    updateData.assigned_to_user_id = assignmentSuggestion.user_id;
  }

  const { error: updateError } = await supabase
    .from('messages')
    .update(updateData)
    .eq('id', message.id);

  if (updateError) {
    log('error', 'Failed to update message', { message_id: message.id, error: updateError });
  }

  // Step 7: Add tags to message
  if (tagSuggestions.length > 0) {
    const tagInserts = tagSuggestions.map((tag) => ({
      message_id: message.id,
      tag_id: tag.tag_id,
      added_by: 'ai',
      confidence: tag.confidence,
    }));

    const { error: tagError } = await supabase.from('message_tags').upsert(tagInserts, {
      onConflict: 'message_id,tag_id',
    });

    if (tagError) {
      log('error', 'Failed to add tags', { message_id: message.id, error: tagError });
    }
  }

  // Step 8: Create draft response record (for individual policy emails)
  if (draftResponse && !classification.is_campaign_email) {
    const { error: draftError } = await supabase.from('draft_responses').insert({
      message_id: message.id,
      office_id: message.office_id,
      subject: draftResponse.subject,
      body: draftResponse.body,
      body_html: draftResponse.body_html,
      draft_type: 'individual',
      status: 'draft',
      generated_by: 'gemini-flash-lite',
    });

    if (draftError) {
      log('error', 'Failed to create draft response', { message_id: message.id, error: draftError });
    }
  }

  // Step 9: Update campaign email count if matched
  if (campaignMatch.matchedCampaignId) {
    await supabase.rpc('increment_campaign_count', { campaign_id: campaignMatch.matchedCampaignId });
  }

  // Step 10: Update bulk response recipient count if exists
  if (existingBulkResponseId) {
    await supabase.rpc('increment_bulk_response_recipients', { bulk_response_id: existingBulkResponseId });
  }

  // Step 11: Mark processing queue item as completed
  await supabase
    .from('ai_processing_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('message_id', message.id);

  return {
    classification,
    tags: tagSuggestions,
    assignment: assignmentSuggestion,
    draft_response: draftResponse,
    fingerprint_hash: fingerprint,
    existing_bulk_response_id: existingBulkResponseId,
  };
}
