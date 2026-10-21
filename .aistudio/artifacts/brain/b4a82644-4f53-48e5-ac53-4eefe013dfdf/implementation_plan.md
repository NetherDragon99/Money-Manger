# Personal Finance PWA: Beta v1.1.11 Architectural & UX Overhaul

Comprehensive architectural blueprint and root-cause resolution plan for **Beta v1.1.11**, addressing 9 user-reported issues: cross-tab multi-select account freeze, modal scroll bleed, visual progress indicators for sharing actions, global notification z-index precedence, modal layering hierarchy, 16-digit sharing delivery & profile lookup reliability, member cancellation with undo, standalone read-only public web dashboard, and ultra-smooth header/footer auto-hide transitions.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on our Phase 1 interactive consultation and your direct instructions:
> 1. **Version Elevation**: Upgraded release target to **Beta v1.1.11** (`1.1.11`) across the codebase.
> 2. **Public Share Link Behavior**: A dedicated, standalone read-only financial dashboard (**لوحة عرض مستقلة للقراءة فقط دون طلب تسجيل**) presenting accounts, categories, transactions, and balance statistics cleanly without forcing account creation or login.
> 3. **Action Progress & Visual Feedback**: An interactive multi-step progress modal (**نافذة تقدم تفاعلية توضح كل خطوة ونسبة الإنجاز**) displaying animated step progress and percentage for network actions like creating and dispatching shares.
> 4. **Member & Invitation Revocation**: Quick confirmation followed by immediate cancellation with a temporary undo toast/notice (**تأكيد سريع ثم إلغاء فوري مع إشعار تراجع مؤقت**).
> 5. **Notification Precedence**: Toasts elevated to `z-[9999]` so clipboard copy and action alerts in the sidebar or deep modals are never hidden or rendered underneath.

---

### 1. Overview & Core Concept

- **What It Delivers**: A bulletproof, seamless personal finance experience where modals stack in strictly predictable layers, long-running operations provide real-time step progress, background pages never bleed scroll through active dialogs, invitations and 16-digit IDs sync reliably via Firebase RTDB, and public share links open an immediate read-only financial dashboard for any recipient.
- **Target Persona**: Individuals and shared households tracking multi-account finances across mobile browsers and PWA standalone windows who demand fast, transparent, and non-blocking multi-resource workflows.
- **Key Value**: Eradicates UI freezes, hidden toasts, and stacked modal traps while giving complete control over shared members and public links.

---

### 2. User Experience & Visual Design

#### Visual Z-Index Hierarchy Token Contract

```
┌─────────────────────────────────────────────────────────────┐
│ Level 6: Global Notifications & Toasts (z-[9999])           │
│   • ToastContainer (Clipboard copy, undo banners, alerts)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 5: Action Progress & Interactive Dialogs (z-[80])     │
│   • Multi-Step Progress Modal (Step 1/3, 2/3, percentage)  │
│   • Custom Confirm / Prompt Dialogs                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 4: Nested Modals & Action Sheets (z-[70])             │
│   • ShareFolderModal (Create New Share / Add to Existing)  │
│   • Member Invite Modal, Emoji Picker                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 3: Base Modals & Slide-over Drawers (z-[60])          │
│   • SharedAccountsHubModal (Shared by Me / Shared with Me)  │
│   • Sidebar Drawer, UserProfileModal, TransactionModal      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 2: Full-Screen Sub-Pages (z-[50])                     │
│   • AccountDetailsView, ShareDetailView                     │
│   • Public Standalone Read-Only Share Dashboard View        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Level 1: Fixed Navigation Bars (z-30)                       │
│   • Top View Headers (Home, Budget, Insights, Accounts)     │
│   • Bottom Navigation Bar & Floating Action Button (FAB)    │
│   (Smooth cubic-bezier transform & opacity ease-in-out)     │
└─────────────────────────────────────────────────────────────┘
```

#### Key User Flows & Visual Interactions

1. **Standalone Read-Only Public Link Flow (`?share=...`)**:
   - Recipient opens the URL on any device without logging in.
   - App mounts `PublicShareDashboardView` in clean read-only mode (`z-50`).
   - Displays the space title, icon, owner card, net balance summary, grouped accounts list, categories breakdown, and chronologically grouped transactions.
   - No confusing "Add to account" modal gate or registration blockers.

2. **Interactive Action Progress Modal**:
   - User triggers "Create Share" or "Send to 16-Digit ID".
   - The interactive modal displays:
     - Stage 1 (25%): Validating 16-digit ID & checking recipient profile.
     - Stage 2 (65%): Encrypting & packaging accounts, categories, and transactions.
     - Stage 3 (100%): Syncing to Firebase RTDB & delivering to inbox.
   - Clear animated circular/horizontal progress bar and descriptive step labels.

3. **Revoke Member with Temporary Undo**:
   - In `SharedAccountsHubModal` or `ShareDetailView`, tapping the "Remove / Cancel" icon on a member badge or pending request prompts a quick confirmation.
   - On confirm, the member/request is immediately removed from the active view and cloud state.
   - A high-priority toast (`z-[9999]`) displays: `"Invitation revoked. [Undo]"` for 5 seconds. Tapping Undo instantly restores the member.

4. **Smooth Header & Footer Transition**:
   - Replaces asymmetric vanish with synchronized CSS ease:
     `transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);`
   - Both scroll-down hide and scroll-up reveal glide smoothly without sudden popping.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Universal Body Scroll Lock Mechanism**
  - *Chosen Approach*: Track `isAnyModalOpen` and apply body locking with `position: fixed`, negative top offset corresponding to `window.scrollY`, and cleanup that restores scroll position without jumps.
  - *Why*: Eliminates background bleed-through when scrolling inside modals or full-screen sheets.

- **Decision 2: Root-Level Toast Elevation (`z-[9999]`)**
  - *Chosen Approach*: Mount `ToastContainer` outside of nested containers with an absolute top-level `z-[9999]`.
  - *Why*: Guarantees that clipboard copy alerts triggered inside the sidebar or deep dialogs always appear visibly above all interfaces.

- **Decision 3: Dedicated Standalone Read-Only Public View**
  - *Chosen Approach*: Implement `StandaloneShareView` rendered directly when `?share=` is detected in URL parameters.
  - *Why*: Provides recipients with an immediate, frictionless dashboard view without forcing registration or polluting their personal accounts.

- **Decision 4: Multi-Select Cross-Tab Reactivity Guard**
  - *Chosen Approach*: Refactor `AccountsView` click and long-press handlers so selection state changes trigger instant re-renders without blocking event propagation, and remove lingering scroll locks when switching tabs.
  - *Why*: Ensures clicking account cards during active selection immediately toggles checkboxes with 0ms delay.

- **Decision 5: Strict 16-Digit ID Normalization & Real-Time RTDB Handshake**
  - *Chosen Approach*: Use `cleanNumericId` consistently across all sender and recipient lookups, ensuring public profile cards (`shared_accounts/profile_${id}`) and inboxes (`shared_accounts/inbox_${id}`) match identical keys.
  - *Why*: Eliminates delivery failures caused by whitespace, hyphens, or mismatched user profile generation.

---

### 4. Technical Architecture & Implementation Roadmap

#### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                              App State                                 │
│  • isBarsVisible: boolean (Smooth Delta Scroll Engine)                 │
│  • selectedItems: { accounts: [], categories: [], transactions: [] }   │
│  • activeModalStack: string[] (Z-Index Discipline & Scroll Lock)       │
│  • progressState: { isRunning, currentStep, totalSteps, message, pct } │
└────────────────────────────────────────────────────────────────────────┘
          │                                  │
          ▼                                  ▼
┌──────────────────────────────┐   ┌─────────────────────────────────────┐
│  Interactive Progress Modal  │   │     Public Share Dashboard View     │
│  • Step 1: Lookup Recipient  │   │  • Detects ?share= in URL           │
│  • Step 2: Bundle Resources  │   │  • Read-Only Mode (No Login Req)    │
│  • Step 3: Cloud Dispatch    │   │  • Accounts, Categories, Summary    │
└──────────────────────────────┘   └─────────────────────────────────────┘
          │                                  │
          ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Firebase RTDB Live Sync                         │
│  • Profile Broadcast: shared_accounts/profile_{clean16DigitId}         │
│  • Inbound Invites:   shared_accounts/inbox_{clean16DigitId}           │
│  • Share Folders:     shared_accounts/share_{shareId} (onValue stream) │
└────────────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Implementation Roadmap

1. **Step 0: Strict Version Bump to Beta v1.1.11**:
   - Update version string `'1.1.11'` / `'Beta v1.1.11'` across:
     - `package.json`
     - `public/version.json`
     - `version.json`
     - `src/utils/versionChecker.ts`
     - `src/utils/appFeatures.ts` (Arabic & English release notes for v1.1.11)
     - `src/components/Sidebar.tsx`
     - `src/utils/storage.ts`, `src/utils/indexedDB.ts`, `src/utils/autoBackup.ts`

2. **Step 1: Fix Z-Index Elevation & Global Toast Precedence**:
   - Elevate `ToastContainer.tsx` to `z-[9999]`.
   - Update `ShareFolderModal.tsx` to `z-[70]` so it strictly opens on top of `SharedAccountsHubModal` (`z-[60]`).
   - Set `CustomDialogModal.tsx` and progress dialog to `z-[80]`.
   - Ensure the slide-over `Sidebar` has `z-[60]` so toasts at `z-[9999]` render clearly above it.

3. **Step 2: Universal Scroll Lock for Modals**:
   - Consolidate modal scroll locking in `App.tsx` and `AppContext.tsx` so `document.body` cannot scroll while any modal or drawer is active.
   - Clean up scroll lock on unmount and during tab transitions.

4. **Step 3: Fix Cross-Tab Multi-Select & AccountsView Reactivity**:
   - Ensure `AccountsView.tsx` long-press and click handlers immediately react to selection state without hanging.
   - Remove stale touch captures or conflicting event suppressions.

5. **Step 4: Interactive Progress Modal for Operations**:
   - Create `ActionProgressModal.tsx` with animated progress bar, percentage indicator, and multi-step status messages.
   - Wire progress feedback into `ShareFolderModal.tsx` during share creation and recipient dispatch.

6. **Step 5: Sharing System Fixes (ID Mismatch & Live Delivery)**:
   - Audit `src/utils/shareFolders.ts`, `src/utils/userId.ts`, and `src/components/ShareFolderModal.tsx`.
   - Enforce normalized 16-digit IDs (`replace(/\D/g, '')`) everywhere.
   - Ensure profile registration (`shared_accounts/profile_${id}`) executes on login and app open.
   - Ensure recipient inbox listener updates state immediately on incoming shares.

7. **Step 6: Member & Invitation Management with Undo**:
   - Add cancel/revoke buttons to members and pending invitations in `SharedAccountsHubModal.tsx` and `ShareDetailView.tsx`.
   - Implement fast confirmation followed by immediate removal and a temporary 5-second undo toast.

8. **Step 7: Standalone Read-Only Public Web View**:
   - Build `StandaloneShareView.tsx` (or upgrade `SharedAccountLiveView.tsx` to act as an un-gated, read-only dashboard).
   - Display account balances, categories, transactions, and date summaries cleanly with zero login requirements or intrusive import banners.

9. **Step 8: Smooth Header & Navigation Auto-Hide Transitions**:
   - Apply uniform transitions (`transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)`) across `Navigation.tsx` and all view headers.
   - Eliminate abrupt snapping when bars hide on scroll down.

10. **Step 9: Compile & Build Verification**:
    - Execute `compile_applet` to guarantee 0 TypeScript compilation errors and pristine bundle output.
