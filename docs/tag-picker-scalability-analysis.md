# TagPicker Scalability Analysis & Recommendations

**Date:** 2025-12-22
**Context:** Offices have thousands of tags that must exactly match legacy software tags for interoperability.

---

## Table of Contents

1. [Current Implementation](#current-implementation)
   - [Database Schema](#database-schema)
   - [Human Triage (TagPicker Component)](#human-triage-tagpicker-component)
   - [LLM Triage](#llm-triage)
2. [Scalability Issues](#scalability-issues)
3. [Proposed Implementation](#proposed-implementation)
   - [Database Improvements](#database-improvements)
   - [Human Triage Improvements](#human-triage-improvements)
   - [LLM Triage Improvements](#llm-triage-improvements)
4. [Implementation Priority](#implementation-priority)

---

## Current Implementation

### Database Schema

**Tags Table** (`supabase/migrations/20241208000001_initial_schema.sql`)

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  office_id UUID NOT NULL REFERENCES offices(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(office_id, name)  -- Tag names unique per office
);
```

**Tag Assignments Table** (polymorphic junction table)

```sql
CREATE TABLE tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID REFERENCES tags(id),
  entity_type TEXT,          -- 'message', 'case', 'thread'
  entity_id UUID,
  office_id UUID REFERENCES offices(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Current Indexing:**
- Primary key index on `id`
- Unique constraint index on `(office_id, name)`
- Foreign key index on `office_id`
- No full-text search indexes
- No usage statistics tracking

**Key Observations:**
- Tags are office-scoped (multi-tenant isolation via RLS)
- No hierarchy/category system
- No metadata fields (description, keywords, usage count)
- All queries rely on simple `name` matching

---

### Human Triage (TagPicker Component)

**Location:** `src/components/triage/TagPicker.tsx` (377 lines)

**Architecture:**
```
TagPicker
├── Popover (Radix UI)
│   ├── PopoverTrigger (display area)
│   └── PopoverContent
│       ├── CommandInput (search)
│       ├── CommandList (tag list)
│       └── Create new section
└── Label
```

**Data Fetching** (`src/lib/useSupabaseData.ts:269`):
```typescript
// All tags loaded upfront on user login
const tagsRes = supabase
  .from('tags')
  .select('*')
  .order('name');  // Returns ALL tags for office
```

**Search Implementation** (`TagPicker.tsx:76-80`):
```typescript
const filteredTags = useMemo(() => {
  if (!search) return tags;
  const lowerSearch = search.toLowerCase();
  return tags.filter(t => t.name.toLowerCase().includes(lowerSearch));
}, [tags, search]);
```

**Current Features:**
- ✅ Multi-select with checkbox-style toggling
- ✅ Inline tag creation with random color
- ✅ Tag change state visualization (new/removed/unchanged)
- ✅ Two variants: default and menubar
- ✅ Memoization with `useMemo` and `useCallback`

**Current Limitations:**
| Issue | Impact |
|-------|--------|
| All tags loaded upfront | Memory bloat with thousands of tags |
| No virtualization | DOM performance degrades >200 tags |
| Substring search only | Poor match quality for similar names |
| No search debouncing | Unnecessary re-renders on every keystroke |
| No pagination | Large initial payload |
| No recent/frequent tags | Users must search every time |

---

### LLM Triage

**Location:** `supabase/functions/_shared/gemini.ts`

**Tag Suggestion Function** (`suggestTags`, lines 169-209):
```typescript
export async function suggestTags(
  content: string,
  classification: EmailClassification,
  availableTags: Array<{ id: string; name: string; description?: string }>
): Promise<TagSuggestion[]>
```

**Current Prompt Approach:**
```typescript
const prompt = `Analyze this email and suggest relevant tags...

Available tags:
${availableTags.map(t => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n')}

Email content:
${content}
`;
```

**Current Limitations:**
| Issue | Impact |
|-------|--------|
| All tags passed in prompt | Token limit exceeded with thousands of tags |
| Linear listing of tags | Inefficient context usage |
| No semantic matching | LLM must scan entire list |
| No confidence calibration | Suggestions may be inconsistent |
| No tag co-occurrence learning | Misses common tag patterns |

---

## Scalability Issues

### With 1,000+ Tags

| Component | Current Behavior | Expected Failure Mode |
|-----------|-----------------|----------------------|
| **Frontend Load** | Fetch all tags on login | 2-5s delay, 500KB+ payload |
| **TagPicker Render** | Render all in dropdown | UI freeze, scroll jank |
| **Search Filter** | Filter on every keystroke | Lag 100-300ms per keystroke |
| **LLM Prompt** | Include all tags | Token limit exceeded (~4000 tokens just for tag names) |
| **Memory Usage** | Hold all tags in React state | Browser memory pressure |

### Legacy System Constraint

> Tags must be **identical** to legacy software tags

This means:
- ✅ Cannot normalize/deduplicate tags
- ✅ Cannot rename tags
- ✅ Cannot merge similar tags
- ⚠️ Must support exact legacy naming conventions
- ⚠️ May have inconsistent naming patterns

---

## Proposed Implementation

### Database Improvements

#### 1. Add Full-Text Search Index

```sql
-- Add GIN index for fast text search
CREATE INDEX idx_tags_name_search ON tags
USING gin(to_tsvector('english', name));

-- Or for simple pattern matching, use trigram index
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_tags_name_trgm ON tags
USING gin(name gin_trgm_ops);
```

#### 2. Add Usage Statistics Table

```sql
CREATE TABLE tag_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  office_id UUID REFERENCES offices(id),
  use_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tag_id, user_id)
);

CREATE INDEX idx_tag_usage_by_user ON tag_usage_stats(user_id, use_count DESC);
```

#### 3. Add Tag Categories (Optional)

```sql
CREATE TABLE tag_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  office_id UUID REFERENCES offices(id),
  sort_order INTEGER DEFAULT 0,
  UNIQUE(office_id, name)
);

ALTER TABLE tags ADD COLUMN category_id UUID REFERENCES tag_categories(id);
CREATE INDEX idx_tags_by_category ON tags(category_id, name);
```

#### 4. Add Search RPC Function

```sql
CREATE OR REPLACE FUNCTION search_tags(
  p_office_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 50,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  color TEXT,
  relevance REAL,
  usage_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.color,
    CASE
      WHEN t.name ILIKE p_query THEN 1.0
      WHEN t.name ILIKE p_query || '%' THEN 0.9
      WHEN t.name ILIKE '%' || p_query || '%' THEN 0.7
      ELSE similarity(t.name, p_query)
    END::REAL as relevance,
    COALESCE(tus.use_count, 0)::INTEGER as usage_count
  FROM tags t
  LEFT JOIN tag_usage_stats tus
    ON t.id = tus.tag_id AND tus.user_id = p_user_id
  WHERE t.office_id = p_office_id
    AND (
      p_query IS NULL
      OR p_query = ''
      OR t.name ILIKE '%' || p_query || '%'
      OR similarity(t.name, p_query) > 0.2
    )
  ORDER BY
    COALESCE(tus.use_count, 0) DESC,  -- Frequently used first
    relevance DESC,
    t.name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 5. Add Tag Embeddings Table (for LLM)

```sql
CREATE TABLE tag_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE UNIQUE,
  embedding vector(384),  -- Using pgvector extension
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tag_embeddings_vector ON tag_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

### Human Triage Improvements

#### 1. Server-Side Search with Debouncing

```typescript
// New hook: useTagSearch.ts
import { useDebouncedCallback } from 'use-debounce';

export function useTagSearch() {
  const [searchResults, setSearchResults] = useState<Tag[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const supabase = useSupabaseClient();

  const searchTags = useDebouncedCallback(async (query: string) => {
    if (!query || query.length < 2) {
      // Show recent/frequent tags instead
      const { data } = await supabase.rpc('get_recent_tags', {
        p_limit: 20
      });
      setSearchResults(data || []);
      return;
    }

    setIsSearching(true);
    const { data } = await supabase.rpc('search_tags', {
      p_query: query,
      p_limit: 50
    });
    setSearchResults(data || []);
    setIsSearching(false);
  }, 300); // 300ms debounce

  return { searchResults, searchTags, isSearching };
}
```

#### 2. Virtualized Tag List

```typescript
// Using react-window for virtualization
import { FixedSizeList } from 'react-window';

function VirtualizedTagList({
  tags,
  selectedIds,
  onToggle
}: VirtualizedTagListProps) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const tag = tags[index];
    const isSelected = selectedIds.includes(tag.id);

    return (
      <div style={style}>
        <CommandItem
          key={tag.id}
          onSelect={() => onToggle(tag.id)}
        >
          <div className={cn("mr-2 h-4 w-4 border rounded-sm",
            isSelected && "bg-primary")}>
            {isSelected && <Check className="h-3 w-3" />}
          </div>
          <TagBadge tag={tag} />
        </CommandItem>
      </div>
    );
  };

  return (
    <FixedSizeList
      height={300}
      itemCount={tags.length}
      itemSize={36}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

#### 3. Recent/Frequent Tags Section

```typescript
// Show sections: Recent → Frequent → All (filtered)
function EnhancedTagPicker({ selectedTagIds, onChange }: TagPickerProps) {
  const { recentTags, frequentTags } = useTagStats();
  const { searchResults, searchTags, isSearching } = useTagSearch();

  return (
    <Command>
      <CommandInput
        placeholder="Search tags..."
        onValueChange={searchTags}
      />
      <CommandList>
        {!search && (
          <>
            <CommandGroup heading="Recently Used">
              {recentTags.slice(0, 5).map(tag => (
                <TagItem key={tag.id} tag={tag} />
              ))}
            </CommandGroup>
            <CommandGroup heading="Frequently Used">
              {frequentTags.slice(0, 10).map(tag => (
                <TagItem key={tag.id} tag={tag} />
              ))}
            </CommandGroup>
          </>
        )}
        <CommandGroup heading={search ? "Results" : "All Tags"}>
          {isSearching ? (
            <CommandItem disabled>Searching...</CommandItem>
          ) : (
            <VirtualizedTagList
              tags={searchResults}
              selectedIds={selectedTagIds}
              onToggle={(id) => {/* toggle logic */}}
            />
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
```

#### 4. Fuzzy Matching Display

```typescript
// Highlight matched portions in search results
function HighlightedTagName({ name, query }: { name: string; query: string }) {
  if (!query) return <span>{name}</span>;

  const lowerName = name.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerName.indexOf(lowerQuery);

  if (index === -1) return <span>{name}</span>;

  return (
    <span>
      {name.slice(0, index)}
      <mark className="bg-yellow-200 dark:bg-yellow-800">
        {name.slice(index, index + query.length)}
      </mark>
      {name.slice(index + query.length)}
    </span>
  );
}
```

---

### LLM Triage Improvements

#### 1. Semantic Search for Tag Matching

Instead of passing all tags to the LLM, use embeddings to find relevant tags first:

```typescript
// Step 1: Generate embedding for email content
async function getRelevantTags(
  emailContent: string,
  officeId: string,
  topK: number = 20
): Promise<Tag[]> {
  // Generate embedding for email
  const embedding = await generateEmbedding(emailContent);

  // Vector similarity search in pgvector
  const { data: relevantTags } = await supabase.rpc('search_tags_by_embedding', {
    p_office_id: officeId,
    p_embedding: embedding,
    p_limit: topK
  });

  return relevantTags;
}
```

```sql
-- RPC function for vector search
CREATE OR REPLACE FUNCTION search_tags_by_embedding(
  p_office_id UUID,
  p_embedding vector(384),
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  color TEXT,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.color,
    1 - (te.embedding <=> p_embedding)::REAL as similarity
  FROM tags t
  JOIN tag_embeddings te ON t.id = te.tag_id
  WHERE t.office_id = p_office_id
  ORDER BY te.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 2. Two-Stage LLM Approach

```typescript
async function suggestTagsOptimized(
  content: string,
  classification: EmailClassification,
  officeId: string
): Promise<TagSuggestion[]> {
  // Stage 1: Get top 20 semantically relevant tags via embeddings
  const candidateTags = await getRelevantTags(content, officeId, 20);

  // Stage 2: Let LLM select from small candidate set
  const prompt = `Analyze this email and select the most relevant tags from the candidates.

Email Classification: ${classification.email_type}
Priority: ${classification.priority}
Sentiment: ${classification.sentiment}

Email Content:
${content.slice(0, 2000)}  // Truncate to save tokens

Candidate Tags (select 1-5 most relevant):
${candidateTags.map((t, i) => `${i + 1}. ${t.name}`).join('\n')}

Return a JSON array of selected tag numbers with confidence scores.
`;

  const result = await callGemini(prompt);

  // Map back to tag IDs
  return result.selectedTags.map(selection => ({
    tag_id: candidateTags[selection.index - 1].id,
    tag_name: candidateTags[selection.index - 1].name,
    confidence: selection.confidence,
    reason: selection.reason
  }));
}
```

#### 3. Tag Embedding Generation Pipeline

```typescript
// Background job to generate/update tag embeddings
async function updateTagEmbeddings(officeId: string) {
  // Get tags without embeddings or with stale embeddings
  const { data: tagsNeedingEmbedding } = await supabase
    .from('tags')
    .select('id, name')
    .eq('office_id', officeId)
    .not('id', 'in', supabase
      .from('tag_embeddings')
      .select('tag_id')
      .gt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    );

  // Batch generate embeddings
  const embeddings = await generateEmbeddingsBatch(
    tagsNeedingEmbedding.map(t => t.name)
  );

  // Upsert embeddings
  await supabase.from('tag_embeddings').upsert(
    tagsNeedingEmbedding.map((tag, i) => ({
      tag_id: tag.id,
      embedding: embeddings[i],
      updated_at: new Date().toISOString()
    }))
  );
}
```

#### 4. Tag Co-occurrence Learning

```typescript
// Learn which tags commonly appear together
CREATE TABLE tag_cooccurrences (
  tag_id_1 UUID REFERENCES tags(id),
  tag_id_2 UUID REFERENCES tags(id),
  count INTEGER DEFAULT 1,
  PRIMARY KEY (tag_id_1, tag_id_2)
);

// Update co-occurrences when tags are applied together
CREATE OR REPLACE FUNCTION update_tag_cooccurrences()
RETURNS TRIGGER AS $$
BEGIN
  -- Get all tags on the same entity
  INSERT INTO tag_cooccurrences (tag_id_1, tag_id_2, count)
  SELECT
    LEAST(NEW.tag_id, ta.tag_id),
    GREATEST(NEW.tag_id, ta.tag_id),
    1
  FROM tag_assignments ta
  WHERE ta.entity_type = NEW.entity_type
    AND ta.entity_id = NEW.entity_id
    AND ta.tag_id != NEW.tag_id
  ON CONFLICT (tag_id_1, tag_id_2)
  DO UPDATE SET count = tag_cooccurrences.count + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)

| Task | Impact | Effort |
|------|--------|--------|
| Add search debouncing (300ms) | Reduce re-renders 90% | Low |
| Add trigram index on tags.name | 10x faster search | Low |
| Create `search_tags` RPC function | Server-side filtering | Low |
| Limit initial tag load to 100 | Faster initial load | Low |

### Phase 2: UX Improvements (3-5 days)

| Task | Impact | Effort |
|------|--------|--------|
| Implement server-side search in TagPicker | Handle 1000s of tags | Medium |
| Add virtualization with react-window | Smooth scrolling | Medium |
| Add recent/frequent tags section | Better UX | Medium |
| Add usage statistics tracking | Personalization | Medium |

### Phase 3: LLM Optimization (5-7 days)

| Task | Impact | Effort |
|------|--------|--------|
| Set up pgvector extension | Vector search capability | Medium |
| Create tag embedding pipeline | Semantic search | High |
| Implement two-stage LLM approach | Scale to 1000s of tags | High |
| Add co-occurrence learning | Better suggestions | Medium |

### Phase 4: Advanced Features (Optional)

| Task | Impact | Effort |
|------|--------|--------|
| Tag categories/hierarchy | Organization | Medium |
| Tag search analytics | Insights | Low |
| Tag suggestion caching | Performance | Medium |
| Bulk tag operations | Efficiency | Medium |

---

## Summary

### Current State
- **Database:** Simple schema, no search optimization
- **Human Triage:** All tags loaded upfront, client-side filtering
- **LLM Triage:** All tags passed to prompt (token limit issue)

### Recommended State
- **Database:** Trigram + vector indexes, usage stats, search RPC
- **Human Triage:** Server-side search, virtualization, recent/frequent sections
- **LLM Triage:** Two-stage approach with semantic embeddings, 20 candidate limit

### Key Metrics to Track
- Tag search response time (target: <100ms)
- TagPicker render time (target: <16ms)
- LLM tag suggestion accuracy
- User tag search-to-select ratio
