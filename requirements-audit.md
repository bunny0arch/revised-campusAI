# CampusFix Requirements Coverage Audit

## Scope and conflict resolution

CampusFix currently prioritizes the user's later instruction to provide a **public, no-login first-level IT support experience**. This deliberately supersedes the original credential-login, personalized dashboard, and protected administrator-route requirements for the present prototype. The retained architecture remains modular enough to reintroduce SSO-compatible authentication and role-based operations later without rewriting the public diagnostic flow.

## Coverage against the original brief

| Requirement area | Current status | Evidence and next boundary |
|---|---|---|
| 4.1 Theme / 4.2 product identity | **Complete** | CampusFix is presented as an autonomous IT troubleshooting and support agent with a warm service-console visual system. |
| 4.3 problem coverage | **Mostly complete** | Intent categories cover Wi-Fi, login/account access, passwords, software, connectivity, printing, safe configuration, and general IT issues. Email, VPN, campus portals, and account-lockout flows are currently routed through the safe general/account boundary rather than dedicated modules. |
| 4.4 autonomous first-level role | **Complete** | The public flow clarifies, retrieves, guides, verifies outcome, and conditionally escalates. |
| 4.5.1 conversational diagnosis | **Complete** | The orchestrator creates a stage plan and asks one high-signal question where information is missing. |
| 4.5.2 knowledge retrieval | **Partial** | Verified knowledge records are retrieved and cited. Semantic embeddings, document ingestion, relevance scoring, and vector search remain a clearly isolated future RAG upgrade. |
| 4.5.3 safe troubleshooting | **Complete** | Prompts and application guardrails limit recommendations to reversible user-level steps and exclude unsafe network/system operations. |
| 4.5.4 ticket creation and escalation | **Mostly complete** | An unresolved outcome or explicit escalation recommendation is required before a structured ticket is persisted. Assignment, status-tracking UI, and technician workflow remain outside the current public prototype. |
| 4.6 sources and tools | **Partial** | A database-backed knowledge base and ticket store are active. Network-status, true vector storage, institutional document ingestion, and third-party operational tools are not claimed as active. |
| 4.7 expected flow | **Mostly complete** | Public text flow works end-to-end; browser-native voice works with text continuation. High-quality ElevenLabs STT/TTS is intentionally disabled until a provider credential validates. |
| 4.8 safety challenges | **Complete** | Sensitive inputs are redacted, unverified campus facts are not invented, and unsafe operations are excluded from the support agent. |

## Broader original requirements

| Capability | Current state | Responsible implementation path |
|---|---|---|
| Multi-model latency control | **Gap being addressed** | Add a server-side OpenRouter fast-model gateway with controlled fallback, timeouts, and the existing safety prompts. |
| Voice experience | **Partial** | Browser STT/TTS and fallback UI work today. ElevenLabs server voice remains disabled because its credential did not validate; no invalid provider key will be used. |
| Student assistance and CV workflow | **Deferred** | A modular capability boundary is required before enabling this secondary scope; it must not dilute the IT workflow. |
| Ticket tracking / IT operations | **Deferred** | Existing data structures support later reintroduction of roles and an operations surface, but no public admin dashboard is exposed. |
| Authentication | **Intentionally deferred** | The current no-login public brief takes precedence. Future student/faculty/IT access can be added through the existing server-side identity model. |
| Supabase migration | **Not selected** | The working MySQL/Drizzle data store remains the single source of truth. Migrating or duplicating active support records to Supabase would add risk without improving the current support workflow. |
| Flux imagery | **Not selected** | AI imagery is not necessary for a minimal technical support interface; using it would not improve agent speed or diagnostic reliability. |

## Integration policy

CampusFix uses integrations only where they improve a verified requirement. OpenRouter is available and validated for a controlled fast-model path. ElevenLabs remains opt-in and disabled until an active credential passes its lightweight server validation. Gemini may remain a future multimodal evaluation option, but it will not be added as redundant runtime orchestration. Supabase and Flux are intentionally not integrated into the active path because the existing database and product-specific interface do not need them.
