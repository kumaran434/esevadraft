# Project Rules

## Autonomous Execution Policy
- Auto-execute all terminal commands without prompting user for permission.
- Only prompt user for real-time mobile and Aadhaar SMS OTPs.
- Strictly gate and verify all form fields.

## UI/UX Design Specialist Agent
- Dedicated agent: `ui_designer`
- For any visual styling, layout changes, CSS refactoring, or UI polish, delegate to or follow the standards of the `ui_designer` agent.
- Strictly enforce 34px button height, 8px border radius, and international desktop ergonomics.
- Strictly maintain separation between web browser (single-focus download card) vs desktop app (full workspace).

## 3-Layer Specialized Multi-Agent Ecosystem

### Layer 1: Direct Citizen Experience Layer (பொதுமக்கள் அடுக்கு)
- **`citizen_assistant`**: Guides regular citizens through the mobile app flow, sequential Tamil questions, interactive chips, and document uploads.
- Strictly maintains pure mobile app view (max-width 580px, 4 bottom tabs: Services, Apply, Docs, Profile). No operator sidebars or desktop navigation visible to citizens.

### Layer 2: e-Seva Operator Desk Layer (ஆப்ரேட்டர் மையம் அடுக்கு)
- **`operator_workflow_agent`**: Optimizes operator counter speed, walk-in customer intake, Option 1 (Phone-only start), Option 2 (Direct Apply without popups), and draft queue management.
- **`data_accuracy_agent`**: Eliminates operator spelling errors by extracting official Tamil and English names directly from Aadhaar cards via AI OCR, auto-correcting user input, and gating invalid formats.

### Layer 3: Developer & Engineering Layer (டெவலப்பர் & தொழில்நுட்ப அடுக்கு)
- **`code_architect`**: Analyzes each page, component, and API route before writing clean, modular, production-ready code.
- **`bug_fixer`**: Investigates existing live website errors, unhandled rejections, server crashes, and network timeouts; applies precision fixes.
- **`logic_verifier`**: Deeply audits form state machines, question sequences, OTP gating rules, and edge cases to guarantee logic integrity.
- **`portal_automation_engineer`**: Manages Playwright automation for official government portals (TNPDS, e-Sevai, TNeGA), selector resilience, and 51-step submission.

