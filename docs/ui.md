# UI Style Guide (Admin Pattern Reuse)

## Purpose
This document captures the exact UI pattern currently used in the Admin pages so the same design language can be reused for Examiner and Examinee pages without visual drift.

## Source of Truth
- Global tokens and shared popup styles: `Frontend/src/App.css`
- Admin page system styles: `Frontend/src/components/admin/admin-modern.css`
- Shared modal shell: `Frontend/src/components/common/AppModal.js`
- Shared modal styles: `Frontend/src/components/common/app-modal.css`
- Admin page implementations:
  - `Frontend/src/components/admin/allTrainer/alltrainer.js`
  - `Frontend/src/components/admin/allTopics/alltopics.js`
  - `Frontend/src/components/admin/newTrainer/newtrainer.js`
  - `Frontend/src/components/admin/newTopics/newtopics.js`

## Design Foundations
Use the existing design tokens from `:root` in `App.css`.

Core tokens:
- `--bg-app`, `--bg-surface`, `--bg-surface-soft`, `--bg-glass`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--border-soft`
- `--brand`, `--brand-strong`
- `--success`, `--danger`, `--warning`
- `--shadow-soft`
- `--radius-lg`, `--radius-md`, `--radius-sm`

Typography:
- Base UI: `Manrope`
- Headings: `Sora`

## Admin Layout Contract
Every management page follows this structure:

1. `admin-modern-shell`
- Vertical stack container for sections.
- `display: flex`, `flex-direction: column`, `gap: 18px`.

2. `admin-modern-headline`
- Top hero/header card.
- Title + description on left.
- Count chip + primary action on right.
- Glass/dark gradient background with soft border and blur.

3. `admin-modern-table-wrap`
- Main data area card.
- Contains toolbar, data grid shell, and footer pagination.

## Reusable Building Blocks
### Header/hero
- `admin-modern-headline`
- `admin-modern-title-group`
- `admin-modern-headline-right`
- `admin-modern-chip`
- `admin-modern-primary-btn`

### Toolbar and search
- `admin-table-toolbar`
- `admin-table-search`
- `admin-table-meta`

Rules:
- Search uses dark input fill + soft border.
- Placeholder is high-contrast muted blue-gray.
- Prefix icon uses `var(--text-muted)`.

### Data grid (custom table, not Ant Table)
- `admin-data-grid-shell`
- `admin-data-grid-scroll`
- `admin-data-grid`
- `admin-data-row`
- `admin-row-title`
- `admin-row-subtext`
- `admin-empty-row`
- `admin-row-actions`
- `admin-icon-btn`
- `admin-icon-btn-danger`

Rules:
- Use semantic `<table>`.
- Header cells are uppercase, muted, and compact.
- Row hover uses subtle brand tint.
- Empty/loading states render as full-width row.
- Keep action buttons in a horizontal inline-flex group.

### Footer and pagination
- `admin-table-footer`
- `admin-table-footer-meta`

Rules:
- Left side: "Showing X - Y of N"
- Right side: Ant Pagination with themed item backgrounds.

### Forms inside modals
- `admin-form-shell`
- `admin-form-caption`
- `admin-field-label`
- `admin-submit-btn`

Rules:
- Use custom labels via `.admin-field-label` (not Ant default label text line).
- Required asterisks are suppressed visually.
- Inputs are dark, compact, and border-highlight on focus.
- Keep vertical rhythm tight (`~10px` between form items).

## Modal Pattern
Use `AppModal` for create/edit flows:
- Backdrop blur and click-outside close.
- Esc key close.
- Header contains title, subtitle, close button.
- Body scrolls if content exceeds height.

Key classes:
- `app-modal-backdrop`
- `app-modal-panel`
- `app-modal-header`
- `app-modal-title-wrap`
- `app-modal-close`
- `app-modal-body`

## Feedback Pattern (Success/Warning/Error)
Use centralized helper:
- `Frontend/src/components/common/alert.js`

Rules:
- Call `Alert('success' | 'warning' | 'error', title, message)`.
- Modal alert style is single-layer dark glass (no duplicate status text).
- Use short actionable messages.

## Interaction and State Behavior
Observed standard pattern on Admin pages:
- Fetch table data on `componentDidMount`.
- Keep local state for paging (`page`, `pageSize`).
- Keep search text in Redux state for consistency across page interactions.
- Reset modal mode/id on close.
- After create/edit/delete success, refresh table data.
- Show spinner row during loading.

## Responsiveness Contract
Current breakpoints:
- `@media (max-width: 840px)` in `admin-modern.css`:
  - Headline becomes column layout.
  - Right-side controls realign for narrow width.

Expected behavior on small screens:
- Header stacks cleanly.
- Search expands to available width.
- Table remains horizontally scrollable via `admin-data-grid-scroll`.

## Implementation Template (For Examiner/Examinee Pages)
1. Create page component with structure:
- `admin-modern-shell`
- `admin-modern-headline`
- `admin-modern-table-wrap`
- `AppModal` for create/edit

2. Import style file that only includes:
- `@import '../admin-modern.css';`

3. Use custom table markup (`<table className="admin-data-grid">`) for consistent visual control.

4. Use these conventions:
- Primary action button class: `admin-modern-primary-btn`
- Search input class: `admin-table-search`
- Action buttons: `admin-icon-btn`, `admin-icon-btn-danger`
- Form labels: `admin-field-label`

5. Keep copy style consistent:
- Header title: noun + management context.
- Header subtitle: one sentence describing user goal.
- Empty table state: plain-language statement.

## Do / Do Not
Do:
- Reuse existing classes before creating new ones.
- Use tokenized colors from `App.css`.
- Keep rounded corners + soft borders + subtle blur.
- Keep form heights compact.

Do not:
- Reintroduce default Ant Table look for these management pages.
- Add unscoped global `.ant-*` overrides inside feature css files.
- Use black label text or white input backgrounds in dark shells.
- Duplicate success/warning/error text in popup headers.

## Acceptance Checklist For New Pages
- Uses `admin-modern.css` and `AppModal`.
- Header, toolbar, table, footer, and modal match existing spacing/radius.
- Search input and placeholders are readable.
- Table actions and pagination match admin style.
- Form labels are visible and asterisks are not manually shown.
- Success/warning/error popups match modern single-layer style.
