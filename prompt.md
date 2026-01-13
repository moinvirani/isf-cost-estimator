# Ralph Agent Instructions

You are an autonomous coding agent implementing the ISF Cost Estimator. Each iteration, you will:

1. Read the PRD and progress log
2. Implement the highest-priority incomplete user story
3. Run quality checks
4. Commit changes
5. Update progress

## Workflow

### Step 1: Read Current State

Read these files to understand context:
- `prd.json` - User stories with `passes: true/false`
- `progress.txt` - What's been done and learnings
- `CLAUDE.md` - Project overview and patterns

### Step 2: Select Next Story

Find the first user story in `prd.json` where `passes: false`, ordered by priority.
If all stories have `passes: true`, output `<promise>ISF COST ESTIMATOR COMPLETE</promise>` and stop.

### Step 3: Implement the Story

For the selected story:

1. **Plan**: Identify files to create/modify based on acceptance criteria
2. **Implement**: Write code following existing patterns in the codebase
3. **Test**: Verify the implementation works:
   - Run `npm run build` to check for TypeScript errors
   - Run `npm run lint` to check code style
   - If there's a dev server, verify in browser

### Step 4: Quality Checks

Before committing, ensure:
- [ ] `npm run build` passes without errors
- [ ] `npm run lint` passes without errors
- [ ] Code follows existing patterns (check similar files)
- [ ] No hardcoded values that should be env variables
- [ ] Mobile-first responsive design for UI components

### Step 5: Commit Changes

Create a focused commit:
```bash
git add -A
git commit -m "feat(US-XXX): Brief description

- Detail 1
- Detail 2

Implements: US-XXX"
```

### Step 6: Update Progress

Append to `progress.txt`:
```
---
## [Date] - US-XXX: Story Title

### Implementation
- What was done
- Files created/modified

### Learnings
- Patterns discovered
- Gotchas to remember
- Decisions made and why

### Next
- What the next story should consider
```

### Step 7: Update PRD

In `prd.json`, set `passes: true` for the completed story.

## Code Patterns

### Directory Structure
```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components organized by feature
├── lib/           # Utility functions and API clients
└── types/         # TypeScript interfaces
```

### Naming Conventions
- Components: PascalCase (`ServiceSelector.tsx`)
- Files: kebab-case (`service-selector.tsx`)
- API routes: `route.ts` in feature folders

### Component Pattern
```tsx
'use client';

import { useState } from 'react';

interface Props {
  // typed props
}

export function ComponentName({ prop }: Props) {
  // implementation
}
```

### API Route Pattern
```ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // implementation
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'message' }, { status: 500 });
  }
}
```

## Important Files

- `src/app/page.tsx` - Main estimation workflow
- `src/lib/shopify/client.ts` - Shopify API client
- `src/lib/pricing/calculator.ts` - Price calculation logic
- `src/types/` - All TypeScript interfaces

## Environment Variables

Required (already configured):
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`

## Completion

When ALL user stories have `passes: true`, output:

```
<promise>ISF COST ESTIMATOR COMPLETE</promise>
```
