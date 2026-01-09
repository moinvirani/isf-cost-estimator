# PRD: ISF Cost Estimator

## Problem Statement

Italian Shoe Factory (ISF) staff receive customer photos of shoes, bags, and leather goods via WhatsApp/Zoko. Currently, they manually:
1. Look at each photo
2. Identify what repairs/cleaning are needed
3. Look up prices from their service list
4. Calculate the total
5. Type out a response to the customer
6. Create a Shopify order manually

This process is slow, error-prone, and inconsistent across staff members.

## Solution

An AI-powered web app that:
1. Staff uploads customer photos (via camera or file upload)
2. AI analyzes the items and suggests services
3. Staff reviews/adjusts the suggestions
4. App generates a Shopify draft order with checkout link
5. App generates a customer response message

## Users

- **Primary**: ISF staff (3-5 people) working in-store
- **Devices**: Phones, tablets, occasionally desktop
- **Tech level**: Basic - needs simple, intuitive interface

## Core Features

### F1: Image Upload
- **Mobile**: Camera capture button (snap photos in-store)
- **All devices**: Drag & drop zone
- **All devices**: File picker button
- **Support**: Multiple images per session (up to 10)
- **Formats**: JPG, PNG, HEIC

### F2: AI Analysis
- **Input**: Uploaded images
- **Output for each item**:
  - Category (shoes/bags/other leather)
  - Material (leather, suede, etc.)
  - Condition (excellent/good/fair/poor)
  - Issues detected (scuffs, stains, heel damage, etc.)
  - Suggested services with confidence %
- **Speed**: Under 10 seconds per image

### F3: Service Selection
- **Display**: AI-suggested services (pre-selected)
- **Actions**: Toggle services on/off, adjust quantity
- **Add more**: Search/browse full service catalog
- **Source**: Shopify products tagged "service"

### F4: Price Calculation
- **Per service**: Base price from Shopify
- **Modifiers**: Material surcharge, rush service, severity
- **Display**: Per-item subtotal, grand total
- **Currency**: AED

### F5: Turnaround Time
- **Calculate**: Based on selected services
- **Display**: "Estimated X days" or "Ready by [date]"
- **Rush option**: Toggle to reduce time (adds cost)

### F6: Draft Order
- **Action**: "Generate Order" button
- **Creates**: Shopify draft order with all line items
- **Output**: Shareable checkout URL
- **Copy**: One-click copy to clipboard

### F7: Customer Message
- **Generate**: Templated message with:
  - Greeting
  - Summary of items and services
  - Total price
  - Turnaround time
  - Checkout link
- **Edit**: Staff can modify before sending
- **Copy**: One-click copy to clipboard

### F8: Estimation History
- **Save**: All estimations stored in database
- **List**: View past estimations
- **Reopen**: Load and modify past estimations

## Technical Requirements

### Database: Supabase
- Tables: estimations, estimation_items, item_services
- Storage: Images stored in Supabase Storage
- Why: Free tier, easy setup, real-time sync

### AI: OpenAI GPT-4 Vision
- Analyze images for item type, material, condition
- Detect issues and suggest repairs
- Structured JSON output for parsing

### E-commerce: Shopify Admin API
- Fetch products tagged "service"
- Create draft orders
- Get shareable checkout URLs

### Frontend: Next.js 14+ with App Router
- TypeScript (strict mode)
- Tailwind CSS (mobile-first)
- Server Components + Client Components where needed

## User Flow

```
[Staff opens app]
       │
       ▼
[Upload photos] ──► Camera / Drag & Drop / File Picker
       │
       ▼
[AI analyzes] ──► Loading spinner ──► Results
       │
       ▼
[Review items] ──► Item cards with issues + suggested services
       │
       ▼
[Adjust services] ──► Toggle on/off, change quantity, add more
       │
       ▼
[Review price] ──► Subtotals, total, turnaround
       │
       ▼
[Generate order] ──► Shopify draft order created
       │
       ▼
[Copy message] ──► Paste into WhatsApp/Zoko
       │
       ▼
[Done] ──► Saved to history
```

## Success Criteria

1. **Time saved**: Estimation takes <2 minutes vs 5-10 minutes manually
2. **Accuracy**: AI correctly identifies item type 90%+ of the time
3. **Adoption**: Staff prefer using the app over manual process
4. **Mobile-friendly**: Works smoothly on phone/tablet

## Out of Scope (v1)

- Customer-facing interface (staff only for v1)
- Automatic Zoko integration (manual copy/paste for v1)
- Multiple languages (English only for v1)
- User authentication (internal tool, trusted network)
- Payment processing (handled by Shopify checkout)

## Milestones

### M1: Foundation
- Next.js project setup
- Supabase database + storage
- Basic page layout

### M2: Image Upload
- Camera capture (mobile)
- Drag & drop + file picker
- Image preview thumbnails
- Upload to Supabase Storage

### M3: AI Analysis
- OpenAI GPT-4 Vision integration
- Analysis prompt for shoes/bags
- Structured response parsing
- Item cards displaying results

### M4: Shopify Integration
- Fetch service catalog
- Match AI suggestions to products
- Service selector UI
- Price calculation

### M5: Order Generation
- Create Shopify draft order
- Display checkout URL
- Customer message generation
- Copy to clipboard

### M6: History & Polish
- Save estimations to Supabase
- History list page
- Error handling
- Mobile optimization

---

## Completion Promise

When this PRD is fully implemented and all features work as described:

```
<promise>ISF COST ESTIMATOR COMPLETE</promise>
```
