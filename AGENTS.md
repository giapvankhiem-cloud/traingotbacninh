# PROJECT OVERVIEW

Trái ngọt Bắc Ninh is a Vietnamese fruit marketplace and orchard portal for buyers, growers, experts, and admins. Main workflows are COD orders, QR traceability, orchard management, and cultivation advice.

Do not read the entire repository by default. First use AGENTS.md to identify the relevant area, then inspect only the files necessary for the current task.

## ARCHITECTURE

React 19, TypeScript, Vite, Tailwind. `src/main.tsx` → `App.tsx` tabs and trace routes → `useFarmData` Auth and Firestore subscriptions. Browser services write directly under Firestore Rules.

Firebase Hosting on Spark serves `dist` with SPA rewrites at `trai-ngot-bac-ninh.web.app`. Hosted AI uses Firebase AI Logic and reCAPTCHA Enterprise App Check. Optional Express (`server.ts`, `server/ai.ts`) runs Gemini locally or on a separate backend.

## IMPORTANT DIRECTORIES

- `src/` holds components, hooks, services, utils, types, and styles. Live data comes from Firestore. `src/data/` holds static categories and demo fixtures.
- `public/`, `ANH/` hold assets. `scripts/` handles builds and operations. `tests/` covers units, UI, and Rules. `docs/` holds dated handoffs.

## IMPORTANT FILES

Pick only the relevant files in a row. Paths start in `src/` unless marked root. Bare component and service names resolve to `components/*.tsx` and `services/*.ts`.

| When editing | Read first | Read if the contract changes |
| --- | --- | --- |
| Login, roles, menus | `AuthModal`, `Header`, `Sidebar`, `App.tsx` | `hooks/useFarmData.ts`, `utils/roleLanding.ts`, `lib/firebase.ts` |
| Orchard, review, certificates | `OrchardDeclarationModal`, `AdminTab`, `FarmerProfileViewer` | `farmStore`, `moderation`, `accountModeration`, `utils/certificates.ts` |
| Catalog, checkout, logs | `MarketplaceTab`, `CartModal`, `OrdersTab`, `CultivationLogViewer` | `farmStore`, `utils/{orders,cultivationLogs}.ts` |
| Story, community | `StoryEditor`, `GardenMedia`, `RealtimeCommunity` | `utils/{story,media,images}.ts` |
| Expert profiles/accounts | `ExpertDirectory`, `ExpertProfile`, `ExpertProfileFields`, `AdminConsultations` | `expertAccounts`, `consultations`, `utils/expertProfile.ts` |
| Expert conversations | `ExpertChatTab`, `FarmerConsultationHub`, `ConsultationStartDialog`, `ConsultationWorkspace` | `consultations`, `types/consultations.ts` |
| Seasonal advice | `SeasonalNotices`, `CalendarTab`, `OverviewTab` | `seasonalNotices`, `utils/seasonalNotices.ts` |
| AI and diagnosis | `AiAssistantTab`, `DiagnosisTab`, `aiClient`, `firebaseAi` | `utils/{aiProtocol,aiValidation}.ts`, root `server/ai.ts` for Express |
| QR and SEO | `Traceability`, `utils/{traceUrl,seo}.ts` | `entry-seo.tsx`, root `scripts/generate-seo.tsx`, `firebase.json` |
| Layout and typography | Relevant component, `index.css`, `styles/` | `fonts.css` for font assets |

## DATA FLOW

- Server-backed identity routes to admin, internal expert, orchard overview, or market. Preserve trace links and manual navigation on refresh.
- Private `farmerApplications` draft → verified submission → revision review → public `farmers` snapshot. Keep the last approved snapshot during edits. Approval gates publishing.
- Cart → atomic stock reservation and private `orders`. One order per SKU, up to five items. Cancellation restocks atomically.
- Verified sender selects an active expert → `consultations` + initial `messages` entry commit together → expert replies in real time. Preserve direct routing and history.

## KEY CONSTRAINTS

- Verified Auth custom claims grant admin authority. Match authorization, schema, and query changes to root `firestore.rules` and `firestore.indexes.json`.
- Orders are buyer/seller private. Consultation access is limited to participants and authorized admins. Expert documents are public even when hidden from the directory. Keep login email private, contact email separate, and credentials/Gemini server keys out of bundles and public data.
- Preserve idempotency, live price/stock checks, revision guards, and immutable audits. Reversible website suspension/deletion retains Auth and history. Expert recovery returns to pending.
- Expert metadata lists cap at 12 entries each. Keep per-entry validation within the Rules expression budget and test both lists at capacity.
- Preserve bounded compressed photos, HTTPS video links, legacy media readers, `/nong-san/{id}`, and `/#trace/{id}`. Display real AI/consultation results and explicit errors.

## COMPLETED FEATURES

Email auth and role landing, orchard approvals/certificates, COD/QR, cultivation logs, inline orchard media, multi-media posts, AI assistant/diagnosis, full expert profiles and direct chat, seasonal notices, and reversible grower/expert account controls.

## CURRENT STATE

Last verified release (2026-11-07) includes full expert profiles and topic → start → chat. Focused verification passed 52 tests across UI, services, and Rules. Preserve working tree changes. README consultation assignment text predates direct routing.

## KNOWN ISSUES

- Weather/3D are illustrative. SEO refreshes on build. Expert availability means accepting requests. Presence, ratings, and total counts are untracked.

## HOW TO WORK ON THIS PROJECT

- Skip unrelated rows, `dist`, dependencies, and old reports. Use `.env.example` for configuration. Avoid credential documents, `.env.local`, and unrelated `.tools` files.
- Node 22.12+, Java 21. Use `npm ci`, `npm run lint`, `npm test`, `npm run test:firebase` as needed. Focus with `node scripts/run-firebase-tests.mjs --expert-accounts` or `--consultation-ui`. Run `demo-traingot` emulators on 9099/8080 sequentially for test writes.
- `npm run build:firebase` builds Hosting and public SEO. When authorized, deploy to `trai-ngot-bac-ninh`, then run read-only `node scripts/check-live-site.mjs`.
