# Exam Shield Design System

This document defines the new frontend visual language introduced in the modern redesign.

## 1) Design Principles
- Focused: reduce visual noise in high-stakes exam flows.
- Legible: strong contrast, clear type scale, minimal ambiguity.
- Consistent: shared spacing, radii, and semantic colors.
- Calm motion: subtle hover/focus transitions only where useful.

## 2) Core Tokens

Primary token source: [`Frontend/src/App.css`](c:\Users\tewod\OneDrive\Desktop\AI-Based-Cheating-Detection-System-for-Online-Exams\Frontend\src\App.css)

### Color tokens
- `--bg-app`: global background
- `--bg-surface`: base card/surface
- `--bg-surface-soft`: elevated surface
- `--bg-glass`: translucent panel layer
- `--text-primary`: high-contrast text
- `--text-secondary`: body text
- `--text-muted`: helper text
- `--border-soft`: shared border tone
- `--brand`, `--brand-strong`: primary accent
- `--success`, `--warning`, `--danger`: semantic feedback

### Radius and shadow tokens
- `--radius-lg`: 18px
- `--radius-md`: 12px
- `--radius-sm`: 8px
- `--shadow-soft`: global surface shadow

### Typography
- Headings: `Sora`
- Body/UI: `Manrope`
- Font imports are declared globally in [`App.css`](c:\Users\tewod\OneDrive\Desktop\AI-Based-Cheating-Detection-System-for-Online-Exams\Frontend\src\App.css)

## 3) Component Language

### Surfaces
- Use translucent dark surfaces with subtle borders.
- Apply `backdrop-filter` for important cards only (login, top-level shells).

### Buttons
- Primary actions: blue gradient, strong contrast.
- Destructive actions: muted red background/border.
- Secondary actions: subdued slate backgrounds.

### Status patterns
- `Granted/Success`: green-tinted badge.
- `Pending/Warning`: amber-tinted badge.
- `Critical/Error`: red-tinted controls only when needed.

### Navigation
- Sidebar uses rounded list tiles and a strong selected state.
- Exam question navigator uses semantic states:
  - Unanswered
  - Answered
  - Flagged
  - Active

## 4) Layout Patterns

### Dashboard shell
- Fixed branded sidebar + floating contextual header.
- Content area inside a bordered rounded shell.

### Exam room
- Two-column desktop layout:
  - Main question stage
  - Persistent control panel (timer, progress, navigator, submit)
- Mobile layout:
  - Question stage full-width
  - Side panel opens through drawer

### Result screen
- Metadata card + quick metrics + detailed answer table.

## 5) Accessibility Notes
- High contrast text/background combinations across core surfaces.
- Larger click targets for option selection and question navigation.
- Explicit textual states for permission and exam progress.

## 6) How to Extend
- Add or adjust global tokens in [`App.css`](c:\Users\tewod\OneDrive\Desktop\AI-Based-Cheating-Detection-System-for-Online-Exams\Frontend\src\App.css) first.
- Keep component-specific styles local (`component.css`) and reference global tokens.
- Avoid hardcoded colors unless it is a deliberate semantic exception.
