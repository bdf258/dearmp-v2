// Process Queue Edge Function
// Scheduled job to process pending messages in the AI processing queue
// This serves as a fallback when webhook triggers don't fire

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, jsonResponse, errorResponse, log, validateEnv } from '../_shared/utils.ts';

const BATCH_SIZE = 10;
const EDGE_FUNCTION_BASE_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1';

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

    const supabase = getSupabaseClient();

    // Get pending messages from queue
    const { data: pendingItems, error: fetchError } = await supabase.rpc(
      'get_pending_messages_for_processing',
      { batch_size: BATCH_SIZE }
    );

    if (fetchError) {
      log('error', 'Failed to fetch pending messages', { error: fetchError });
      return errorResponse(`Failed to fetch queue: ${fetchError.message}`, 500);
    }

    if (!pendingItems || pendingItems.length === 0) {
      log('info', 'No pending messages to process');
      return jsonResponse({ success: true, processed: 0, message: 'No pending items' });
    }

    log('info', `Processing ${pendingItems.length} messages`, {
      message_ids: pendingItems.map((item: { message_id: string }) => item.message_id),
    });

    const results: Array<{
      message_id: string;
      success: boolean;
      error?: string;
    }> = [];

    // Process each message
    for (const item of pendingItems) {
      try {
        // Call the email-ingestion function
        const response = await fetch(`${EDGE_FUNCTION_BASE_URL}/email-ingestion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            message_id: item.message_id,
            office_id: item.office_id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
          results.push({
            message_id: item.message_id,
            success: true,
          });
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        log('error', 'Failed to process message', {
          message_id: item.message_id,
          error: errorMessage,
        });

        // Mark as failed in queue
        await supabase.rpc('mark_queue_item_failed', {
          queue_item_id: item.queue_id,
          error_message: errorMessage,
        });

        results.push({
          message_id: item.message_id,
          success: false,
          error: errorMessage,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    log('info', 'Queue processing completed', { successful, failed });

    return jsonResponse({
      success: true,
      processed: results.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    log('error', 'Queue processing failed', { error: (error as Error).message });
    return errorResponse(`Processing failed: ${(error as Error).message}`, 500);
  }
});
