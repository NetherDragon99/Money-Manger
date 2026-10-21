# Personal Finance PWA: Beta v1.1.10 Architectural Upgrade

Comprehensive architectural blueprint and root-cause resolution plan for **Beta v1.1.10**, delivering unblockable header/footer auto-hide mechanics, cross-tab multi-select with pre-action review, instant reactive account long-presses, hardware back button state discipline, calculator single-caret rendering, and an overhaul of the real-time Firebase sharing system with task-style cards and full-screen views.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on our Phase 1 consultation, two core design and functional policies have been explicitly finalized:
> - **Multi-Select Action Bar Presentation**: Cross-tab selections will be rendered with a clean grouped breakdown by entity type (e.g., `2 Accounts · 3 Transactions`) alongside the total badge, making multi-type operations transparent.
> - **Shared View Transaction Sync & Lifecycle**: Transactions created or edited inside a Shared View are seamlessly synced to both the Shared Folder and the user's personal Home feed. When removing a transaction from a Share, the user receives an explicit dual choice: **"Remove from Share Only"** (retaining personal record) or **"Delete Everywhere"**.

---

### 1. Overview & Core Concept

- **What It Delivers**: A high-performance, real-time personal finance management experience where navigation surfaces adapt smoothly to touch scroll dynamics, multi-entity batch workflows span across all app tabs with safety review steps, and collaborative budgeting/sharing acts like a real-time native document feed with instant member presence and zero manual refreshes.
- **Target Persona**: Individuals, families, and shared households tracking daily expenses, categorized budgets, and cross-account transfers across mobile and desktop browsers with high privacy and instant offline-first reliability.
- **Key Value**: Eradicates navigation glitches, UI freezing, and ghost cursors while elevating multi-user collaboration to true real-time streaming with complete user transparency and control.

---

### 2. User Experience & Visual Design

#### Key User Flows & Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                       Top Header Bar                        │
│   [Avatar/Brand]       Accounts Overview         [Actions]  │
│  (Smooth inline translate-Y on scroll: -110% on scroll down) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Active Tab View                        │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Account / Transaction / Category Cards              │   │
│   │ • 450ms long-press triggers instant reactive select │   │
│   │ • Haptic pulse (40ms) + border highlight + checkmark│   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Global Multi-Select Action Bar                │
│   [Count: 2 Accounts · 3 Trx]   [Share]   [Delete]   [✕]    │
│            │                                                │
│            ▼ (User taps Share or Delete)                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │          Selection Review Modal (Pre-Action)        │   │
│   │  • Accounts List (with toggle checkboxes)           │   │
│   │  • Categories List (with toggle checkboxes)         │   │
│   │  • Transactions List (with toggle checkboxes)       │   │
│   │  [Cancel]            [Confirm Action & Proceed]     │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Bottom Navigation Bar                    │
│   [Home]     [Budget]     [Accounts]    [Insights]   [Calc] │
│  (Smooth inline translate-Y on scroll: +115% on scroll down)│
└─────────────────────────────────────────────────────────────┘
```

#### Sharing Hub & Detail View Experience

- **Two Dedicated Hub Sections**:
  - **Shared by Me (`أنا مشيره`)**: Shows all folders owned by the active user, member avatars with live pending/active badges, and quick invite actions.
  - **Shared with Me (`متشير معايا`)**: Displays inbound invitations, accepted shares, and owner identity.
- **Task-Style Block Cards**:
  - Replaces generic list items with structured, high-density cards matching the tactile design of transaction cards.
  - Displays folder icon, title, member count, and live sync indicator dot (green for connected stream).
- **Full-Screen Native Share View (`z-50`)**:
  - Tapping a share opens an immersive full-screen view styled identically to `HomeView`.
  - Includes quick balance summaries, a dedicated action bar to log transactions or link accounts, and an activity list.
- **Collapsible Accordions for Accounts & Categories**:
  - Whole Accounts or Categories inside the share are presented as sleek accordion blocks, collapsed by default.
  - An intuitive tap unfolds individual transactions beneath the parent account or category with smooth transitions.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Unblockable Inline Styles for Navigation Bar Transitions**
  - *Chosen Approach*: Compute scroll direction and threshold via passive capture listeners on the root viewport container and apply direct inline transforms (`transform: translateY(-110%)` / `translateY(115%)`) with CSS easing.
  - *Why*: Eliminates CSS selector collisions and Tailwind class overrides inside nested scroll containers, guaranteeing immediate, 60fps response.
  - *Alternatives Considered*: CSS class toggling (failed due to conflicting `!important` and nested overflow rules).

- **Decision 2: Global Cross-Tab Multi-Select Store**
  - *Chosen Approach*: Lift selection state into `App.tsx` / `AppContext` managing an object of IDs across accounts, categories, and transactions.
  - *Why*: Enables users to build a multi-resource bundle (e.g., selecting an account and related expenses) without losing state when switching between Home, Budget, and Accounts.
  - *Alternatives Considered*: Isolated per-tab multi-select (frustrating for users attempting to share or delete related items across views).

- **Decision 3: Mandatory Pre-Action Selection Review Modal**
  - *Chosen Approach*: Intercepting Share and Delete actions with a clean, itemized review sheet allowing quick exclusions.
  - *Why*: Prevents accidental destructive deletions across tabs and gives users confidence before firing batch network operations.

- **Decision 4: Single Strict Popstate History Guard Hierarchy**
  - *Chosen Approach*: Centralize all browser/hardware back-button handling into a single ordered priority switch in `App.tsx` that executes only one layer per press and maintains the history guard.
  - *Why*: Prevents sub-pages from resetting the entire tab navigation to Home when users simply want to close a modal or return to the Accounts list.

- **Decision 5: Real-Time Firebase RTDB Synchronization & Profile Discovery**
  - *Chosen Approach*: Use live `onValue` subscriptions on share channels and public profile paths (`shared_accounts/profile_${cleanId}`), with sanitized numeric IDs.
  - *Why*: Eliminates stale local caches; invited members and modifications appear instantaneously on both devices without closing modals or refreshing.

---

### 4. Technical Architecture & Data Strategy

#### System Component & Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                              App State                                 │
│  • isBarsVisible: boolean (Scroll Capture Engine)                      │
│  • selectedItems: { accounts: [], categories: [], transactions: [] }   │
│  • activeTab: 'home' | 'budget' | 'accounts' | 'insights' | 'calc'     │
│  • subPageState: selectedAccountId | activeSharePageId                 │
└────────────────────────────────────────────────────────────────────────┘
          │                                  │
          ▼                                  ▼
┌──────────────────┐               ┌─────────────────────────────────────┐
│  Scroll Engine   │               │       Popstate History Guard        │
│  • Root Capture  │               │  1. Open Modals -> Close top-most   │
│  • DeltaY > 6    │               │  2. Sub-Pages   -> Clear ID (no tab)│
│  • DeltaY < -2   │               │  3. Multi-Select-> Clear selection  │
│  • Inline Style  │               │  4. Sidebar     -> Close            │
└──────────────────┘               │  5. Active Tab  -> Reset to 'home'  │
                                   │  6. Exit Guard  -> Exit Modal       │
                                   └─────────────────────────────────────┘
                                                     │
                                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Firebase RTDB Live Sync                         │
│  • Profile Broadcast: shared_accounts/profile_{clean16DigitId}         │
│  • Inbound Invites:   shared_accounts/inbox_{clean16DigitId}           │
│  • Share Folders:     shared_accounts/share_{shareId} (onValue stream) │
└────────────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Implementation Roadmap

1. **Step 0: Strict Version Bump**:
   - Bump version to `Beta v1.1.10` / `'1.1.10'` across `package.json`, `public/version.json`, `version.json`, `src/utils/versionChecker.ts`, `src/utils/appFeatures.ts` (Arabic & English release notes), `src/components/Sidebar.tsx`, `src/utils/storage.ts`, `src/utils/indexedDB.ts`, `src/utils/autoBackup.ts`, and `src/utils/translations.ts`.
2. **Step 1: Top Header & Bottom Navigation Auto-Hide**:
   - Establish `isBarsVisible` state in `App.tsx` with delta tracking (`deltaY > 6`, `scrollTop > 40` hides; `deltaY < -2` or `scrollTop <= 25` reveals).
   - Inject unblockable inline transforms into all 5 view headers and `Navigation.tsx`.
3. **Step 2: AccountsView Long-Press Reactivity**:
   - Remove stale memo wrappers and connect card long-press handlers directly to global multi-select state with instant UI re-render.
4. **Step 3: Global Multi-Select & Selection Review Modal**:
   - Create `SelectionReviewModal.tsx` displaying grouped items with checkboxes.
   - Wire multi-select across Home, Budget, and Accounts tabs with grouped badge counters.
5. **Step 4: Calculator Single-Caret Engine**:
   - Audit `CalculatorView.tsx` formula tree to ensure the blinking caret exists at strictly one location inside `√(...)` or expressions.
6. **Step 5: Unified Popstate Back Navigation Chain**:
   - Consolidate all history operations into `App.tsx` ensuring sub-page exits stay on the active tab.
7. **Step 6 & 7: Sharing System Overhaul & Real-Time Sync**:
   - Build task-style share cards and `ShareDetailView.tsx` with accordion account/category sections.
   - Implement Firebase RTDB profile registration, 16-digit ID sanitization, and persistent `onValue` listeners.
8. **Step 8: Build Verification**:
   - Compile applet with `tsc --noEmit` and `vite build` ensuring 0 TypeScript or packaging errors.
