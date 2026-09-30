# TNPDS Add Family Member Automation (குடும்ப உறுப்பினர் சேர்க்கை சேவை)

## Status: 🚀 ACTIVE ISOLATED SERVICE (தனித்துவமான சேவை கோப்பு)

This module contains the complete 12-step gated Playwright automation engine for adding a new family member (Child or Adult) to an existing Smart Ration Card on the official TNPDS portal (`https://www.tnpds.gov.in/pages/service-request`).

### Key Guarantees:
- **Angular Material Datepicker Reactive Cascade (Case-15 & Case-16)**: Interacts with `selectDateInMatCalendar` using real JavaScript Date objects and full event cascade to trigger Angular Ivy age calculation.
- **Direct Supporting Documents Dropdown & Hydration Gate (Case-16)**: Direct targeting of `select#supportingDocuments` / `formcontrolname="supportingDocuments"` with dynamic hydration polling, preventing mis-selection of disability category dropdown.
- **Mandatory Document Upload Gate (Case-16)**: Strict `DOC_UPLOAD_GATE_HALT` ensures member proof is attached before advancing.
- **Mandatory Table Addition Verification Gate (Case-16)**: Strict `ADD_MEMBER_TABLE_GATE_HALT` checks `table tbody tr` contains the new member name before any declaration or dry-run completion.
- **Relationship Precision**: Disambiguates `Son (மகன்)` vs `Grand Son (பேரன்)` and `Aunt (அத்தை)`.
- **Dry-Run Safety Lock**: Never presses final government submit button in test mode.
