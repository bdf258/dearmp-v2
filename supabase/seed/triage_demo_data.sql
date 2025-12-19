-- ============================================================================
-- Triage Demo Data Seed
-- ============================================================================
-- This script populates the database with demo data for testing the triage feature.
-- Run with: psql -f supabase/seed/triage_demo_data.sql
-- Or via Supabase dashboard SQL editor.
--
-- IMPORTANT: This is for development/demo environments only.
-- Do NOT run in production.
-- ============================================================================

-- Create a demo office if it doesn't exist
INSERT INTO public.offices (id, name, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Demo MP Office',
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- Create demo campaigns
INSERT INTO public.campaigns (id, office_id, name, description, email_count, created_at, updated_at)
VALUES
    (
        '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000001',
        'Housing Crisis Campaign',
        'Campaign regarding the ongoing housing crisis and rent controls',
        150,
        now() - interval '7 days',
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000102',
        '00000000-0000-0000-0000-000000000001',
        'NHS Funding Petition',
        'Petition for increased NHS funding in local hospitals',
        89,
        now() - interval '14 days',
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000103',
        '00000000-0000-0000-0000-000000000001',
        'Climate Action Now',
        'Constituent concerns about climate change policy',
        45,
        now() - interval '30 days',
        now()
    )
ON CONFLICT (id) DO UPDATE SET
    email_count = EXCLUDED.email_count,
    updated_at = now();

-- Create demo constituents
INSERT INTO public.constituents (id, office_id, full_name, created_at, updated_at)
VALUES
    (
        '00000000-0000-0000-0000-000000000201',
        '00000000-0000-0000-0000-000000000001',
        'John Smith',
        now() - interval '30 days',
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000202',
        '00000000-0000-0000-0000-000000000001',
        'Sarah Johnson',
        now() - interval '60 days',
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000203',
        '00000000-0000-0000-0000-000000000001',
        'Michael Chen',
        now() - interval '90 days',
        now()
    )
ON CONFLICT (id) DO NOTHING;

-- Create constituent contacts
INSERT INTO public.constituent_contacts (id, office_id, constituent_id, type, value, is_primary, created_at, updated_at)
VALUES
    (
        '00000000-0000-0000-0000-000000000301',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000201',
        'email',
        'john.smith@example.com',
        true,
        now(),
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000302',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000201',
        'address',
        '45 High Street, Westminster, London SW1A 0AA',
        true,
        now(),
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000303',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000202',
        'email',
        'sarah.johnson@example.com',
        true,
        now(),
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000304',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000203',
        'email',
        'michael.chen@example.com',
        true,
        now(),
        now()
    )
ON CONFLICT (id) DO NOTHING;

-- Create demo tags
INSERT INTO public.tags (id, office_id, name, color, created_at, updated_at)
VALUES
    (
        '00000000-0000-0000-0000-000000000401',
        '00000000-0000-0000-0000-000000000001',
        'Urgent',
        '#FF0000',
        now(),
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000402',
        '00000000-0000-0000-0000-000000000001',
        'Housing',
        '#FF5733',
        now(),
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000403',
        '00000000-0000-0000-0000-000000000001',
        'Benefits',
        '#33FF57',
        now(),
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000404',
        '00000000-0000-0000-0000-000000000001',
        'NHS',
        '#3357FF',
        now(),
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000405',
        '00000000-0000-0000-0000-000000000001',
        'Environment',
        '#57FF33',
        now(),
        now()
    )
ON CONFLICT (id) DO NOTHING;

-- Create demo triage messages (pending - needs human review)
INSERT INTO public.messages (
    id, office_id, direction, subject, snippet, body_search_text,
    received_at, triage_status, campaign_id, case_id,
    classification_confidence, email_type, is_campaign_email
)
VALUES
    -- Known constituent - Housing Campaign
    (
        '00000000-0000-0000-0000-000000000501',
        '00000000-0000-0000-0000-000000000001',
        'inbound',
        'RE: Housing Crisis - Need Help Urgently',
        'I am writing to express my concern about the housing situation...',
        'I am writing to express my concern about the housing situation in our constituency. The rent increases have become unbearable and I fear eviction. My address is 45 High Street, Westminster.',
        now() - interval '2 hours',
        'pending',
        '00000000-0000-0000-0000-000000000101',
        NULL,
        NULL,
        NULL,
        true
    ),
    -- Unknown constituent with address - Housing Campaign
    (
        '00000000-0000-0000-0000-000000000502',
        '00000000-0000-0000-0000-000000000001',
        'inbound',
        'Housing Crisis Petition',
        'As a resident of your constituency, I urge you to take action...',
        'As a resident of your constituency, I urge you to take action on the housing crisis. I live at 123 Oak Lane, Kensington and have seen numerous families displaced. Please support the rent control bill.',
        now() - interval '3 hours',
        'pending',
        '00000000-0000-0000-0000-000000000101',
        NULL,
        NULL,
        NULL,
        true
    ),
    -- Unknown constituent no address - NHS Campaign
    (
        '00000000-0000-0000-0000-000000000503',
        '00000000-0000-0000-0000-000000000001',
        'inbound',
        'NHS Funding - Please Support',
        'I am deeply concerned about the state of our local hospital...',
        'I am deeply concerned about the state of our local hospital. Staff shortages and long waiting times are affecting patient care. Please vote for increased NHS funding.',
        now() - interval '4 hours',
        'pending',
        '00000000-0000-0000-0000-000000000102',
        NULL,
        NULL,
        NULL,
        true
    ),
    -- AI-triaged message with suggestions
    (
        '00000000-0000-0000-0000-000000000504',
        '00000000-0000-0000-0000-000000000001',
        'inbound',
        'Climate Action Required',
        'The recent flooding has shown us the urgency of climate action...',
        'The recent flooding has shown us the urgency of climate action. My home at 78 River Road, Chelsea was affected. I implore you to support stronger environmental policies.',
        now() - interval '5 hours',
        'triaged',
        '00000000-0000-0000-0000-000000000103',
        NULL,
        0.92,
        'policy',
        true
    ),
    -- Non-campaign individual casework message
    (
        '00000000-0000-0000-0000-000000000505',
        '00000000-0000-0000-0000-000000000001',
        'inbound',
        'Benefits Application Issue',
        'I am having difficulty with my Universal Credit application...',
        'I am having difficulty with my Universal Credit application. The DWP has delayed my payments for 3 weeks now and I am struggling to pay bills. My National Insurance number is AB123456C. Please help.',
        now() - interval '6 hours',
        'pending',
        NULL,
        NULL,
        NULL,
        'casework',
        false
    ),
    -- Another AI-triaged
    (
        '00000000-0000-0000-0000-000000000506',
        '00000000-0000-0000-0000-000000000001',
        'inbound',
        'Request for Surgery',
        'I have been on a waiting list for knee surgery for 18 months...',
        'I have been on a waiting list for knee surgery for 18 months. The pain is unbearable and affects my ability to work. My address is 22 Victoria Street. I need your intervention.',
        now() - interval '1 day',
        'triaged',
        NULL,
        NULL,
        0.88,
        'casework',
        false
    ),
    -- Spam-like message to test dismiss
    (
        '00000000-0000-0000-0000-000000000507',
        '00000000-0000-0000-0000-000000000001',
        'inbound',
        'Re: Your Amazon Order',
        'Your package has been delayed. Click here to track...',
        'Your package has been delayed. Click here to track your delivery. Suspicious link removed.',
        now() - interval '2 days',
        'pending',
        NULL,
        NULL,
        NULL,
        NULL,
        false
    ),
    -- Multiple messages from same sender (duplicate detection test)
    (
        '00000000-0000-0000-0000-000000000508',
        '00000000-0000-0000-0000-000000000001',
        'inbound',
        'Housing Crisis - Following Up',
        'I wrote last week about the housing crisis...',
        'I wrote last week about the housing crisis and haven''t received a response. My address is 45 High Street. Please acknowledge receipt.',
        now() - interval '30 minutes',
        'pending',
        '00000000-0000-0000-0000-000000000101',
        NULL,
        NULL,
        NULL,
        true
    )
ON CONFLICT (id) DO UPDATE SET
    triage_status = EXCLUDED.triage_status,
    classification_confidence = EXCLUDED.classification_confidence,
    email_type = EXCLUDED.email_type,
    updated_at = now();

-- Create message recipients (senders)
INSERT INTO public.message_recipients (
    id, office_id, message_id, recipient_type, email_address, name, constituent_id
)
VALUES
    -- Known constituent
    (
        '00000000-0000-0000-0000-000000000601',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000501',
        'from',
        'john.smith@example.com',
        'John Smith',
        '00000000-0000-0000-0000-000000000201'
    ),
    -- Unknown with address
    (
        '00000000-0000-0000-0000-000000000602',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000502',
        'from',
        'unknown.resident@example.com',
        'Unknown Resident',
        NULL
    ),
    -- Unknown no address
    (
        '00000000-0000-0000-0000-000000000603',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000503',
        'from',
        'concerned.citizen@example.com',
        'A Concerned Citizen',
        NULL
    ),
    -- Climate message
    (
        '00000000-0000-0000-0000-000000000604',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000504',
        'from',
        'climate.activist@example.com',
        'Climate Activist',
        NULL
    ),
    -- Benefits casework
    (
        '00000000-0000-0000-0000-000000000605',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000505',
        'from',
        'sarah.johnson@example.com',
        'Sarah Johnson',
        '00000000-0000-0000-0000-000000000202'
    ),
    -- Surgery casework
    (
        '00000000-0000-0000-0000-000000000606',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000506',
        'from',
        'michael.chen@example.com',
        'Michael Chen',
        '00000000-0000-0000-0000-000000000203'
    ),
    -- Spam
    (
        '00000000-0000-0000-0000-000000000607',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000507',
        'from',
        'spam@suspicious-domain.com',
        'Amazon Delivery',
        NULL
    ),
    -- Follow up from known constituent
    (
        '00000000-0000-0000-0000-000000000608',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000508',
        'from',
        'john.smith@example.com',
        'John Smith',
        '00000000-0000-0000-0000-000000000201'
    )
ON CONFLICT (id) DO NOTHING;

-- Add triage_metadata to AI-triaged messages
UPDATE public.messages
SET triage_metadata = jsonb_build_object(
    'suggested_tags', jsonb_build_array(
        jsonb_build_object('tag_id', '00000000-0000-0000-0000-000000000405', 'tag_name', 'Environment', 'confidence', 0.95),
        jsonb_build_object('tag_id', '00000000-0000-0000-0000-000000000401', 'tag_name', 'Urgent', 'confidence', 0.72)
    ),
    'suggested_assignee', jsonb_build_object(
        'reason', 'Environment policy specialist'
    ),
    'classification_reasoning', 'Message discusses climate change policy and flooding impact. High confidence policy email related to environmental issues.',
    'constituent_match', jsonb_build_object(
        'status', 'fuzzy',
        'extracted_data', jsonb_build_object(
            'address', '78 River Road, Chelsea'
        )
    )
),
triaged_at = now() - interval '4 hours',
triaged_by = 'gemini-flash-2.0'
WHERE id = '00000000-0000-0000-0000-000000000504';

UPDATE public.messages
SET triage_metadata = jsonb_build_object(
    'suggested_tags', jsonb_build_array(
        jsonb_build_object('tag_id', '00000000-0000-0000-0000-000000000404', 'tag_name', 'NHS', 'confidence', 0.98),
        jsonb_build_object('tag_id', '00000000-0000-0000-0000-000000000401', 'tag_name', 'Urgent', 'confidence', 0.85)
    ),
    'classification_reasoning', 'Casework request regarding NHS surgery waiting list. Patient expressing significant distress.',
    'constituent_match', jsonb_build_object(
        'status', 'exact',
        'matched_constituent', jsonb_build_object(
            'id', '00000000-0000-0000-0000-000000000203',
            'name', 'Michael Chen'
        )
    )
),
triaged_at = now() - interval '23 hours',
triaged_by = 'gemini-flash-2.0'
WHERE id = '00000000-0000-0000-0000-000000000506';

-- Create a demo case for linking tests
INSERT INTO public.cases (
    id, office_id, title, description, reference_number, status, priority, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000001',
    'Ongoing Housing Support',
    'Long-term housing support case for constituent',
    1001,
    'open',
    'high',
    now() - interval '30 days',
    now()
)
ON CONFLICT (id) DO NOTHING;

-- Summary output
DO $$
DECLARE
    v_message_count INTEGER;
    v_pending_count INTEGER;
    v_triaged_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_message_count
    FROM public.messages
    WHERE office_id = '00000000-0000-0000-0000-000000000001'
    AND direction = 'inbound';

    SELECT COUNT(*) INTO v_pending_count
    FROM public.messages
    WHERE office_id = '00000000-0000-0000-0000-000000000001'
    AND triage_status = 'pending';

    SELECT COUNT(*) INTO v_triaged_count
    FROM public.messages
    WHERE office_id = '00000000-0000-0000-0000-000000000001'
    AND triage_status = 'triaged';

    RAISE NOTICE '================================================';
    RAISE NOTICE 'Triage Demo Data Seeded Successfully!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Total inbound messages: %', v_message_count;
    RAISE NOTICE 'Pending triage: %', v_pending_count;
    RAISE NOTICE 'AI-triaged (awaiting confirmation): %', v_triaged_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Demo includes:';
    RAISE NOTICE '- 3 campaigns (Housing, NHS, Climate)';
    RAISE NOTICE '- 3 known constituents';
    RAISE NOTICE '- 5 tags (Urgent, Housing, Benefits, NHS, Environment)';
    RAISE NOTICE '- 8 triage messages with various statuses';
    RAISE NOTICE '- 1 existing case for linking tests';
    RAISE NOTICE '================================================';
END $$;
