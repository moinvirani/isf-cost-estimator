# ISF Cost Estimator - Project Guide

## Project Overview
**ISF Cost Estimator** is an AI-powered internal tool for Italian Shoe Factory (ISF) staff. It streamlines the estimation process by analyzing customer photos of shoes and bags, suggesting repair/cleaning services, and generating a Shopify draft order for checkout.

## Current Status: M2 Complete, M3 Next

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

### Next Up: M3 - AI Analysis
- Connect OpenAI GPT-4 Vision
- Analyze uploaded images for: item type, material, condition, issues
- Display analysis results in item cards
- Suggest services based on analysis

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
│   │   └── api/                  # API routes (to be added)
│   ├── components/
│   │   └── estimation/
│   │       ├── image-upload.tsx  # Camera + drag/drop upload
│   │       └── index.ts
│   ├── lib/
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
```

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Core Workflow (Target)
1. Staff uploads photos → **DONE**
2. AI analyzes items → **NEXT (M3)**
3. System suggests services → M4
4. Staff reviews/edits → M4
5. Generate Shopify draft order → M5
6. Generate customer message → M6

## Key Files to Know
- `src/app/page.tsx` - Main page with upload UI
- `src/components/estimation/image-upload.tsx` - Upload component
- `src/lib/supabase/storage.ts` - Image upload to Supabase
- `src/types/item.ts` - AI analysis result types
- `tasks/prd.json` - Full task breakdown by milestone

## Development Notes
- User is a beginner - explain code clearly
- No AI slop - every line intentional
- Mobile-first design (staff use phones/tablets)
- Shopify services are products tagged "service"

## GitHub
Repository: https://github.com/moinvirani/isf-cost-estimator
