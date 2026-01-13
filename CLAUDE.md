# ISF Cost Estimator - Project Guide

## Project Overview
**ISF Cost Estimator** is an AI-powered internal tool for Italian Shoe Factory (ISF) staff. It streamlines the estimation process by analyzing customer photos of shoes and bags, suggesting repair/cleaning services, and generating a Shopify draft order for checkout.

## Current Status: M4 Complete, M5 Next

### Completed
- **M1: Foundation** ✅
  - Next.js 14 with App Router, TypeScript, Tailwind
  - Supabase database with 3 tables (estimations, estimation_items, item_services)
  - TypeScript interfaces for all data models

- **M2: Image Upload** ✅
  - Image upload component with camera capture + drag/drop + file picker
  - Supabase Storage integration (bucket: `item-images`)
  - Image preview gallery
  - Storage RLS policies configured

- **M3: AI Analysis** ✅
  - OpenAI GPT-4o Vision integration
  - API route for image analysis (`/api/analyze`)
  - ItemCard component showing analysis results
  - ConfidenceIndicator component
  - Detects: item type, material, condition, issues, suggested services

- **M4: Shopify Integration** ✅
  - Shopify Admin API client (`/lib/shopify/client.ts`)
  - API route to fetch service products (`/api/services`)
  - ServiceSelector component with AI-suggested services highlighted
  - Price calculation engine with material/condition modifiers
  - PriceSummary component with totals breakdown

### Next Up: M5 - Draft Order Creation
- Create API route to generate Shopify draft orders
- Build customer info input (name, phone, email)
- Wire up "Generate Draft Order" button
- Show order confirmation with Shopify link

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS (mobile-first)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (bucket: `item-images`)
- **AI**: OpenAI GPT-4 Vision
- **E-commerce**: Shopify Admin API
- **Currency**: AED

## Project Structure
```
isf-cost-estimator/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main estimation workflow
│   │   ├── layout.tsx            # Root layout
│   │   └── api/
│   │       ├── analyze/
│   │       │   └── route.ts      # AI analysis endpoint
│   │       └── services/
│   │           └── route.ts      # Shopify services endpoint
│   ├── components/
│   │   └── estimation/
│   │       ├── image-upload.tsx      # Camera + drag/drop upload
│   │       ├── item-card.tsx         # Item with analysis results
│   │       ├── confidence-indicator.tsx  # AI confidence bar
│   │       ├── service-selector.tsx  # Service selection with AI hints
│   │       ├── price-summary.tsx     # Price totals + order button
│   │       └── index.ts
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── openai.ts         # OpenAI client
│   │   │   └── prompts.ts        # Analysis prompts
│   │   ├── shopify/
│   │   │   ├── client.ts         # Shopify Admin API client
│   │   │   ├── services.ts       # Fetch service products
│   │   │   └── index.ts
│   │   ├── pricing/
│   │   │   ├── calculator.ts     # Price calculation + modifiers
│   │   │   └── index.ts
│   │   ├── zoko/
│   │   │   ├── client.ts         # Zoko CRM API client
│   │   │   └── index.ts
│   │   └── supabase/
│   │       ├── client.ts         # Supabase client
│   │       └── storage.ts        # Image upload functions
│   └── types/
│       ├── estimation.ts         # Estimation types
│       ├── item.ts               # Item & AI analysis types
│       ├── service.ts            # Service & pricing types
│       └── index.ts
├── supabase/
│   └── migrations/
│       ├── 003_complete_setup.sql    # Database schema
│       └── 004_storage_policy.sql    # Storage RLS policies
├── tasks/
│   ├── prd-isf-estimator.md      # Full PRD
│   └── prd.json                  # Structured task breakdown
├── .env.local                    # Environment variables (not in git)
└── .env.example                  # Template for env vars
```

## Database Schema (Supabase)
- **estimations**: Main estimation records
- **estimation_items**: Items within an estimation (linked to images)
- **item_services**: Services selected for each item

## Environment Variables
Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
OPENAI_API_KEY=sk-...
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
ZOKO_API_KEY=your-zoko-api-key
```

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Core Workflow (Target)
1. Staff uploads photos → **DONE**
2. AI analyzes items → **DONE**
3. System suggests services → **DONE**
4. Staff reviews/edits → **DONE**
5. Generate Shopify draft order → **NEXT (M5)**
6. Generate customer message → M6

## Key Files to Know
- `src/app/page.tsx` - Main page with full workflow
- `src/app/api/analyze/route.ts` - AI analysis API endpoint
- `src/app/api/services/route.ts` - Shopify services API endpoint
- `src/components/estimation/service-selector.tsx` - Service selection UI
- `src/lib/shopify/client.ts` - Shopify Admin API client
- `src/lib/pricing/calculator.ts` - Price calculations with modifiers
- `tasks/prd.json` - Full task breakdown by milestone

## Development Notes
- User is a beginner - explain code clearly
- No AI slop - every line intentional
- Mobile-first design (staff use phones/tablets)

## Shopify Tag Structure
Services are identified by the `Repair` tag. Category filtering uses:
- `Men's Repair` → Men's shoe services
- `Women's Repair` → Women's shoe services
- `Sneaker Repair` → Sneaker services
- `bag repair` → Bag services

Products can have multiple tags (e.g., "Stitching" has all category tags, shown for all items).

## Zoko CRM Integration
Client created at `src/lib/zoko/client.ts`. API access confirmed:
- **38,418 customers** with message history
- **Image messages** with `mediaUrl` (Google Cloud Storage)
- **Conversation context** to find quoted prices after images

Key functions:
- `getCustomers(page)` - Paginated customer list
- `getCustomerMessages(customerId)` - Full message history
- `findConversationsWithImages(startPage, max)` - Find convos with images

### AI Training System ✅ COMPLETE (Shopify-First)
Training page at `/training` uses a **Shopify-first approach**:
1. Fetches recent Shopify orders (90 days)
2. Matches to Zoko customers by **phone number** (primary identifier)
3. Finds images sent within 7 days BEFORE order date
4. Shows only verified matches for reliable training data

Key features:
- **Phone-priority matching**: Phone match is sufficient (names often differ between systems)
- **Zoko phone index**: Cached for 1 hour (~37k customers, O(1) lookups)
- **Auto pre-fill**: Services from Shopify order auto-selected
- **Match confidence badge**: Shows name similarity % (informational)
- **Error resilience**: Individual customer errors don't crash the whole request

Files:
- `src/app/training/page.tsx` - Training UI
- `src/app/api/training/matched-conversations/route.ts` - Shopify-first matching endpoint
- `src/app/api/training/examples/route.ts` - Save/fetch training data
- `src/lib/shopify/orders.ts` - Shopify orders client (`getRecentOrders`)
- `src/lib/zoko/client.ts` - Zoko client with phone index caching
- `src/lib/matching/index.ts` - Phone normalization & name matching utilities
- `src/types/training.ts` - TypeScript types
- `supabase/migrations/005_training_examples.sql` - Database table

Training workflow:
1. Go to `/training`
2. Each item shows: customer image + matched Shopify order + services
3. Verify services are correct (auto-selected from order)
4. Click "Save & Next" to save training example
5. AI learns from verified examples over time

## Ralph Autonomous Development

This project is configured for Ralph - an autonomous AI agent loop that implements features iteratively.

### Ralph Files
- `prd.json` - User stories with `passes: true/false` status (root directory)
- `prompt.md` - Agent instructions for each iteration
- `progress.txt` - Learning log and implementation history

### How to Run Ralph

Using Claude Code Ralph Loop plugin:
```
/ralph-loop "Read prompt.md and implement the next incomplete user story from prd.json" --max-iterations 20 --completion-promise "ISF COST ESTIMATOR COMPLETE"
```

### User Story Status
- US-001 to US-004: ✅ Complete (M1-M4)
- US-005 to US-012: ❌ Pending (M5-M6)

### Workflow Per Iteration
1. Read `prd.json` and `progress.txt`
2. Find first story with `passes: false`
3. Implement acceptance criteria
4. Run `npm run build` and `npm run lint`
5. Commit changes
6. Update `progress.txt` with learnings
7. Set `passes: true` in `prd.json`

## GitHub
Repository: https://github.com/moinvirani/isf-cost-estimator
