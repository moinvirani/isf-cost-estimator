# ISF Cost Estimator - Project Guide

## Project Overview
**ISF Cost Estimator** is an AI-powered internal tool for Italian Shoe Factory (ISF) staff. It streamlines the estimation process by analyzing customer photos of shoes and bags, suggesting repair/cleaning services, and generating a Shopify draft order for checkout.

### Core Workflow
1.  **Input**: Staff uploads photos of item(s) (Shoe/Bag) received via Zoko/WhatsApp.
2.  **AI Analysis**: System identifies item type, material, issues (damage/stains).
3.  **Estimation Engine**:
    -   Suggests Services (e.g., "Deep Clean", "Heel Repair", "Sole Protector").
    -   Calculates Price (Base Price + Modifiers).
    -   Suggests Turnaround Time.
    -   Handles multiple items per customer (e.g., 2 pairs of shoes, 1 bag).
4.  **Review**: Staff reviews/edits the AI suggestions.
5.  **Output**: Generates a Shopify Cart/Draft Order link to be shared with the customer.
6.  **Assistive Text**: Generates a draft response message for the customer.

## Tech Stack
-   **Framework**: Next.js (App Router)
-   **Styling**: Tailwind CSS
-   **Language**: TypeScript
-   **Backend/Integration**: Server Actions / API Routes
-   **AI**: Gemini Pro Vision / Claude 3 (for image analysis)
-   **E-commerce**: Shopify Admin/Storefront API
-   **CRM Data**: Zoko (Historical chat data for context)

## Architecture & Rules

### Pricing Logic
-   **Granularity**: Service item per specific repair (e.g., "Ladies Shoe Cleaning" + "Heel Tip Replacement").
-   **Modifiers**: Add-ons like "Rush Service", "Suede Material Surcharge".
-   **Cart Structure**: One cart per customer, containing multiple line items.

### Code Guidelines
-   **Directory Structure**: Use `src/app` for pages, `src/components` for UI, `src/lib` for logic/utils.
-   **Styling**: Use standard Tailwind utility classes.
-   **Forms**: React Hook Form for complex inputs (if needed).
-   **Type Safety**: Strict TypeScript interfaces for all Data Models (Product, Service, Cart).

## Commands
-   `npm run dev`: Start development server.
-   `npm run build`: Build for production.
-   `npm run lint`: Run ESLint.

## External Services
-   **Shopify**: DraftOrder resource via Admin API.
-   **Zoko**: Input source for images/context (Manual upload initially, API integration later).
