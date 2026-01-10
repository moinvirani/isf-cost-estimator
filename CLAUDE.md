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

### AI Training System ✅ COMPLETE
Training page at `/training` allows staff to:
1. View images from Zoko CRM
2. See conversation context
3. Select correct services
4. Save as training examples

Files created:
- `src/app/training/page.tsx` - Training UI
- `src/app/api/training/zoko-images/route.ts` - Fetch Zoko images
- `src/app/api/training/examples/route.ts` - Save/fetch training data
- `src/types/training.ts` - TypeScript types
- `supabase/migrations/005_training_examples.sql` - Database table

AI learns from training:
- Prompts updated with ISF-specific service names
- Few-shot examples from verified training data
- More accurate service recommendations over time

### Next Steps
1. Run the migration: `005_training_examples.sql` in Supabase
2. Go to `/training` and train the AI with 20-30 examples
3. AI will start auto-selecting correct services

## GitHub
Repository: https://github.com/moinvirani/isf-cost-estimator
