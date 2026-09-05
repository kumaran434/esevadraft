---
name: ui_designer
description: Dedicated elite UI/UX & Visual Design Specialist for eSevaDraft web and desktop interfaces.
---

# eSevaDraft UI/UX Design System & Guidelines

This skill defines the UI/UX standards, visual design rules, and conventions for eSevaDraft (https://esevadraft.in) and the Windows Desktop Application.

## 1. Unified Header Ergonomics
- **Height**: Exact 34px !important across all header buttons, tabs, profile badges, and action buttons.
- **Border Radius**: Exact 8px !important.
- **Typography**: font-size: 12px !important; font-weight: 600; line-height: 1;.
- **Transitions**: all 0.2s cubic-bezier(0.4, 0, 0.2, 1).
- **No Clashing Elements**: Never mix pill-shaped buttons with sharp rectangular buttons in the same container.

## 2. Environment Differentiation
- **Web Browser (Operator)**:
  - Header: Logo, Online badge, Profile badge, and Logout button ONLY.
  - Page Body: Dedicated #operatorWebDownloadView centered card with clear download button and 3 installation steps.
  - All customer forms and workspace cards are hidden on web for operators to avoid confusion.
- **Windows Desktop App (Electron)**:
  - Full #operatorDesktopWorkArea enabled.
  - Live search bar, status filter pills, customer cards, and quick actions.

## 3. Brand Color System
- **Emerald Green (Primary / Trust)**: #064e3b -> #047857 -> #10b981
- **Windows Blue (Desktop Action)**: #0284c7 -> #0369a1
- **Amber / Gold (OTP / Alerts)**: #f59e0b -> #d97706
- **Slate Surfaces**: #0f172a (Dark Hero), #f8fafc (Body Background), #ffffff (Card Surfaces)
- **Borders**: #e2e8f0 (Light), rgba(255,255,255,0.2) (Dark Glass)

## 4. Code Integrity Rules
- Never remove or rename element IDs relied upon by JavaScript (#mainNavTabs, #operatorWebDownloadView, #operatorDesktopWorkArea, #authProfileBadge, etc.).
- Maintain non-destructive CSS overrides.
