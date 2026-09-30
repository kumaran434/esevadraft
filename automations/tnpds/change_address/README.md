# TNPDS Change of Address Automation (குடும்ப அட்டை முகவரி மாற்றம்)

## Status: 🚀 ACTIVE ISOLATED SERVICE (தனித்துவமான சேவை கோப்பு)

This module contains the complete 12-step gated Playwright automation engine for modifying the address on an existing Smart Ration Card on the official TNPDS portal (`https://www.tnpds.gov.in/pages/service-request`).

### Key Guarantees:
- **One-Time Login & Session Cookie Reuse**: Automatically saves and restores authenticated session cookies (`data/tnpds_cookies.json`), eliminating repeated OTP logins.
- **Sequential Field Automation**: Door No, Street (Tamil & English), District, Taluk, Village cascades, and Pincode verification.
- **Mandatory Document Upload Gate**: Strict verification of supporting address proof (EB Bill, Gas Bill, Aadhaar, Rental Agreement, Property Tax) auto-compressed to < 100KB compliant format.
- **Self-Declaration & Dry-Run Safety Lock**: Ticks declaration checkbox, safely halts before final submission during test/dry-run mode without modifying citizen card on live government servers.
- **Live Submission Mode**: Supports complete official submission with Application Reference Number (`N...`) and PDF receipt generation.
