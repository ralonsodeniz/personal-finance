# Observability, Security, Backups, and Data Export Baseline

- Date checked: 2026-08-15
- Repository: `ralonsodeniz/personal-finance`
- Related issue: [GitHub issue 13](https://github.com/ralonsodeniz/personal-finance/issues/13), “Observability, Security, Backups, and Data Export Baseline”
- Research status: recommendation for the Wayfinder/personal-finance baseline; no application implementation is assumed
- Confidence: high for the control principles; medium for the proposed defaults because the repository does not yet expose a stack, deployment model, data model, or jurisdiction

## Question

What is the smallest credible, stack-neutral baseline that should be agreed before Wayfinder/personal-finance stores or serves personal financial data, covering:

1. operational observability and security monitoring;
2. application and data security;
3. backups and recovery; and
4. user-controlled data export and portability?

The baseline should be testable, preserve the option to change infrastructure vendors, avoid putting financial records into telemetry, and distinguish a user export from an operational backup.

## Repository and issue context

The repository was inspected on 2026-08-15. `README.md` is the only tracked file and contains only the project name. There are no local research notes, architecture documents, application code, deployment manifests, data models, or contribution conventions to inherit.

The connected GitHub integration returned `404 Not Found` for issue 13, but authenticated local `gh` access confirmed the private repository and retrieved the issue body. The issue asks for a practical v1 baseline covering error tracking, performance monitoring, logs, traces, OpenTelemetry, PII and financial-payload redaction, audit events, secrets, authorization-failure visibility, database backups and restore drills, retention/deletion, user data export, and incident response, while comparing managed services with vendor-neutral boundaries. The Wayfinder map issue 1 was not modified.

This document is consequently a decision baseline, not an implementation review. The recommendation must be narrowed after the issue body, architecture, and data flows are available.

## Assumptions

These are working assumptions, not findings about the current system:

- The product will eventually be a hosted application or service rather than only a local, single-user file. If it is local-only, the hosted-service controls should be re-scoped rather than silently omitted.
- Financial records, account metadata, transaction descriptions, income and spending information, and identifiers are treated as high-confidentiality personal data. The product should not collect bank credentials, payment-card data, or money-movement authority unless a separate threat model and compliance review approves it.
- The project is early-stage and cost-sensitive, with a small team. It needs a practical control profile and evidence of operation, not a certification program as a prerequisite.
- The technology and provider are not selected. Recommendations therefore specify interfaces and control properties rather than a cloud, database, identity provider, logging vendor, or backup product.
- EU/EEA exposure is possible because of the repository context, but the controller/processor role, user geography, legal bases, and whether the service is operated only for personal or household activity are unknown. GDPR observations below are conditional and are not legal advice.
- A user-facing export is intended to be reusable by the user or another service. An internal disaster-recovery copy is a separate artifact with a different purpose, access policy, and retention policy.

## Executive recommendation

Adopt the following baseline as the issue’s target outcome:

1. **Security target:** create a version-pinned, risk-tailored profile of [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0), targeting Level 2 for the application paths that handle financial data. Use [NIST CSF 2.0](https://csrc.nist.gov/pubs/cswp/29/the-nist-cybersecurity-framework-csf-20/final) as the lifecycle language for Govern, Identify, Protect, Detect, Respond, and Recover, not as a substitute for application requirements. Level 2 is a defensible starting target for sensitive data, but it must be confirmed against the actual threat model; ASVS explicitly leaves the final level to the organization’s risk and user expectations.
2. **Identity and authorization:** use a mature identity component or managed identity provider rather than inventing password, session, recovery, and MFA behavior. Require server-side, object-level authorization for every financial record and step-up reauthentication for exports, credential changes, recovery, and administrative actions. Log authentication outcomes and authorization failures without recording credentials or financial payloads.
3. **Cryptography and secrets:** enforce TLS for network paths, encryption at rest where the provider supports it, encrypted backups, least-privilege service identities, and a secrets/key-management system. Do not commit secrets or keys to source control or place them in ordinary logs. Document key ownership, rotation, recovery, and the separation between key material and encrypted data.
4. **Observability:** instrument application and infrastructure boundaries with [OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/) APIs/SDKs and export to a controlled backend. Use structured, schema-versioned logs, metrics, and traces; keep the backend replaceable. The initial useful signals are request rate, error rate, latency, dependency/database health, job failures, backup status, export status, authentication anomalies, and authorization denials. Keep security/audit events distinct from high-volume debug telemetry.
5. **Privacy-safe monitoring:** define a telemetry allowlist before enabling instrumentation. Never put passwords, access tokens, session cookies, bank credentials, full transaction descriptions, raw financial amounts, or export contents into logs, traces, or metric labels. Use opaque internal identifiers only where necessary, protect telemetry with access control and encrypted transport/storage, and retain it for the shortest period that supports operations, security investigation, and documented obligations.
6. **Recovery:** automate encrypted backups of the authoritative data and the information required to rebuild the service. Keep at least one copy logically separate from production and protected against accidental or attacker-initiated deletion; where feasible, use immutable/offline or otherwise isolated storage. Define RPO and RTO before selecting a provider, monitor backup success, and exercise an isolated restore on a regular schedule. A backup is not considered useful merely because a snapshot exists.
7. **Export:** provide a user-initiated, authenticated, consistent export package with a versioned canonical JSON representation plus CSV views and a manifest. Include schema/version metadata, timestamps and timezone rules, currency/precision rules, stable IDs and relationships, source/provenance where relevant, file sizes, and integrity hashes. Exclude secrets, sessions, provider credentials, telemetry, and other users’ data. Generate the package asynchronously, make the download short-lived and non-public, record the export event without recording its contents, and delete temporary copies on expiry.
8. **Evidence:** the issue should not be considered complete until the team has a data inventory/threat model, pinned control profile, telemetry field policy, backup/restore runbook with measured RPO/RTO, export schema contract, and evidence from at least one restore and one export/redaction test.

This recommendation uses OpenTelemetry and JSON/CSV as portable boundaries, but it does not require a self-hosted observability backend, a particular database, or a specific backup product. A provider-native backend or backup service is acceptable when it meets the controls and does not make the application’s instrumentation, export, or recovery contract provider-specific.

## Compared options

### Observability

| Option | Advantages | Costs and risks | Assessment |
| --- | --- | --- | --- |
| Logs only, emitted directly to the hosting provider | Lowest initial implementation effort; useful for a small monolith | Weak correlation across services and jobs; easy to mix sensitive payloads into logs; migration and retention controls depend on the provider; no consistent metrics/traces contract | Acceptable only as a temporary bootstrap while the event schema and redaction policy are being written |
| Provider-native metrics, logs, and tracing APIs | Fast dashboards and alerting; one integrated support path | Creates instrumentation and query coupling to the provider; portability and third-party data-transfer review become harder; changing providers can require application changes | Use as a backend capability if desired, not as the application’s only telemetry contract |
| OpenTelemetry instrumentation plus a managed or self-hosted backend | Vendor/tool neutral; common context across logs, metrics, and traces; can add or replace a backend; supports future service boundaries | Requires instrumentation discipline, schema/redaction rules, backend access controls, and some operational ownership; OpenTelemetry itself is not a storage or visualization backend | **Recommended.** Start with the signals that answer user-impact and security questions; add a Collector only when it simplifies routing, redaction, sampling, or backend changes |

OpenTelemetry’s own documentation describes it as a framework for generating, exporting, and collecting telemetry rather than a backend, and its observability primer identifies traces, metrics, and logs as the core signals. [W3C Trace Context](https://www.w3.org/TR/trace-context/) provides a vendor-neutral propagation format for correlating requests across service boundaries.

### Named managed observability candidates (provisional)

The repository has no provider decision, so these are candidates for a short spike rather than a final selection. The application must still emit the portable contract above and redact sensitive fields before data leaves the service. A managed backend is an operational destination, not the authority for financial records, security/audit history, backups, or user exports.

| Candidate | Officially documented capability | Fit and limitation | Provisional use |
| --- | --- | --- | --- |
| **Sentry** | Error and performance monitoring with organization-level privacy controls, server-side scrubbing, sensitive-field rules, IP scrubbing, and regional API domains ([organization API](https://docs.sentry.io/api/organizations/update-an-organization/), [API reference](https://docs.sentry.io/api/)) | Fast application-error workflow and useful privacy controls, but it should not be treated as the complete logs/metrics/audit/backup platform. Scrubbing is defense in depth, not permission to send financial payloads. | Optional error/performance complement when its regional processing, retention, access, and contract terms fit. |
| **Datadog** | Managed analysis of OpenTelemetry metrics, traces, and logs, with either full OTel instrumentation or Datadog collection paths ([OTel integration](https://docs.datadoghq.com/opentelemetry/)); Sensitive Data Scanner can redact telemetry ([telemetry setup](https://docs.datadoghq.com/security/sensitive_data_scanner/setup/telemetry_data/)) | Broad integrated observability/security surface and mature alerting, but feature-rich ingestion can increase cost and coupling. Datadog documents that cloud scanning/redaction happens after telemetry reaches its backend; use an in-environment Collector/pipeline or application redaction for financial data. | Candidate when one integrated platform and budget justify it; keep OTel SDK/API and Collector configuration portable. |
| **Grafana Cloud** | Managed metrics, logs, traces, and profiles, with OTLP ingestion; Grafana documents Alloy or an upstream Collector for production routing, sampling, and redaction ([introduction](https://grafana.com/docs/grafana-cloud/introduction/), [OTLP endpoint](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/)) | Strong fit for an OTel-first, multi-signal baseline and a replaceable Collector boundary. It still introduces SaaS retention, access, region, and cost decisions, and the Collector becomes an operational component. | Provisional default for a full-signal managed backend if a provider spike confirms region, retention, deletion, access-control, and cost requirements; Sentry can remain optional for error triage. |

**Decision rule:** run one representative, fully synthetic workload through Grafana Cloud and Datadog, and optionally Sentry for the error workflow. Compare redaction before ingress, trace/log correlation, alerting, export/deletion APIs, retention controls, regional processing, access audit, recovery of configuration, and total cost. Choose one primary backend for v1; do not send the same sensitive signal set to multiple vendors by default.

### Application security

| Option | Advantages | Costs and risks | Assessment |
| --- | --- | --- | --- |
| Ad hoc “HTTPS plus secrets” checklist | Smallest apparent scope | Omits authorization, session, input, logging, dependency, recovery, and evidence requirements; difficult to test consistently | Insufficient for financial records |
| OWASP ASVS Level 1 only | Low barrier; covers critical starting controls | ASVS describes Level 1 as the minimum starting point, not the normal end state; sensitive-data paths may need stronger controls | Useful as an emergency first gate, but not the target for this product |
| Version-pinned ASVS 5.0.0 Level 2 profile, tailored by risk | Concrete, testable application requirements; tracks authentication, authorization, validation, browser/API, cryptography, logging, and error-handling concerns | More implementation and test effort; the profile must be maintained when the standard changes; not every chapter is relevant to every architecture | **Recommended.** Start at Level 2 for financial-data paths and explicitly justify any exclusions or higher-risk exceptions |
| Certification-first program such as a full external assurance exercise | May become valuable for enterprise customers or regulated operations | Expensive and organizationally heavy; does not replace correct product-level authorization, export, or restore behavior; premature without a system to assess | Defer. Build evidence-ready controls first and decide later whether a certification or assurance program is needed |

OWASP’s current project page identifies 5.0.0 as the stable release. The ASVS level guidance says Level 1 is the minimum starting point, most applications should strive for Level 2, and the final level should be selected from the application’s sensitivity, risk, maturity, and user expectations. This is why Level 2 is a recommendation here rather than a claim that the standard mandates it.

### Backups and recovery

| Option | Advantages | Costs and risks | Assessment |
| --- | --- | --- | --- |
| Provider-managed snapshots only | Simple, inexpensive, usually integrated with the database | May be accessible from the same administrative plane as production; may not cover configuration, object storage, schemas, or recovery keys; snapshot existence does not prove a successful restore; portability may be poor | Minimum building block, not a complete baseline |
| Application export used as the backup | User-readable and portable; can be stored outside the primary provider | Usually omits service configuration, schema history, audit/operational state, and atomic recovery semantics; export jobs can fail or produce inconsistent data; restoring a service from it can be slow | Required as a user feature, but never the only disaster-recovery mechanism |
| Layered encrypted backups with separate/immutable copy, monitored jobs, documented RPO/RTO, and restore drills | Addresses accidental deletion, provider failure, ransomware, corruption, and operator error; produces evidence of recoverability | More storage, key-management, access-control, and testing work; isolated recovery environments need careful data handling | **Recommended.** Use provider-native snapshots/PITR where useful, then add independent isolation and tested restore procedures |

NIST defines RPO as the point in time to which data must be recovered and RTO as the maximum recovery-phase duration before mission or business processes are negatively affected. Those are service decisions, not universal numbers. For planning only, a small non-critical first release could propose an RPO of at most 24 hours and an RTO of at most 8 hours; the product owner must approve or tighten those values before implementation. If users treat the service as the authoritative daily ledger, an hourly or point-in-time target may be more appropriate.

### Data export

| Option | Advantages | Costs and risks | Assessment |
| --- | --- | --- | --- |
| No export | Lowest implementation cost | Creates lock-in and makes account migration, recovery from application defects, and user control poor; may conflict with applicable portability duties | Reject |
| Raw database dump | Potentially complete for the current schema; easy for operators to produce | Exposes internal schema, secrets, tenant boundaries, and implementation details; not usable by ordinary users; likely to contain unrelated users or operational data; migration becomes coupled to database technology | Reject as the user-facing format; may exist only as a separately protected operator recovery artifact |
| CSV only | Familiar and easy to inspect in spreadsheets | Weak representation for nested relationships, identifiers, nulls, timezone/precision rules, and schema evolution; spreadsheet formula injection must be addressed; not a complete restore contract | Offer as a view, not the canonical representation |
| Live API endpoint only | Can be machine-readable and incremental | Pagination and concurrent writes can create an inconsistent snapshot; consumers need API knowledge; long-lived credentials and rate limits complicate user-controlled downloads; historical schema compatibility is easy to neglect | Useful later for integrations, not sufficient as the first export artifact |
| Versioned JSON package plus CSV views and manifest | Portable and machine-readable; preserves relationships and metadata while remaining usable by people; supports integrity checks and future import | Requires schema/version governance, consistency rules, secure temporary storage, and test fixtures; derived or provider-specific fields need explicit documentation | **Recommended.** Make JSON canonical, CSV ergonomic, and import/direct-transfer a later separately specified capability |

The EDPB’s small-business guidance describes structured, commonly used, machine-readable export as the relevant portability shape, names JSON and CSV as common examples, and says metadata is needed for reuse. [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) defines JSON as a portable structured data-interchange format. [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) documents common CSV field and quoting behavior but also notes that CSV has implementation differences; the export contract must therefore define its encoding, delimiter, header, line-ending, null, date, and decimal rules.

## Baseline controls and evidence

The following is the proposed minimum control set. “Evidence” is intentionally included: a control that cannot be observed or tested will be hard to operate and hard to trust.

### 1. Data, threat, and ownership baseline

- Inventory every data store, queue, object bucket, export artifact, backup, log sink, trace backend, third-party integration, and administrator path.
- Classify each field as operational, personal, financial, secret, security/audit, or derived. Record whether it is user-provided, observed/imported, or calculated by the product.
- Draw the data-flow boundaries: browser/device, API, database, background jobs, backups, telemetry, export delivery, support tooling, and third parties.
- Name an owner for data protection, security decisions, backup recovery, export schema, and incident response. A single person may hold several roles in a small project, but the ownership must be explicit.
- Write a short threat model covering account takeover, broken object-level authorization, malicious or compromised administrator, provider compromise/outage, accidental deletion, database corruption, ransomware, export-link disclosure, telemetry leakage, and key loss.

**Evidence:** a versioned data inventory, data-flow diagram, threat model, retention table, and exception log.

### 2. Security baseline

#### Application requirements

- Pin the control profile to **OWASP ASVS 5.0.0** and record requirement IDs with the version prefix `v5.0.0-...`; do not cite unversioned “latest” requirements in acceptance criteria.
- Target ASVS Level 2 for authenticated financial-data paths. Tailor out architecture-specific chapters only with a written reason; promote a requirement to a higher level when the threat model warrants it.
- Enforce authentication at the server boundary and authorization at function, object, and field level as appropriate. Never rely on a client-supplied account, household, portfolio, or record identifier to establish access.
- Use secure session handling, bounded login/recovery attempts, session invalidation, and MFA or equivalent step-up protection for high-risk actions. The precise identity technology remains unresolved until the architecture is known.
- Validate and encode untrusted input, use parameterized data access, protect state-changing browser/API operations, and return errors that do not disclose secrets, stack traces, or internal data.
- Keep dependencies and runtime components on a patching path, and make security checks part of code review and release verification. The exact scanners are an implementation choice.

#### Secrets, cryptography, and access

- Keep credentials, signing keys, encryption keys, database URLs, export-signing material, and provider tokens out of source control, test fixtures, client bundles, and ordinary telemetry.
- Use a dedicated secret/key-management facility where available. Apply least privilege, access auditing, expiry/rotation, revocation, and documented recovery. Do not put the only copy of a recovery key beside the encrypted backup it unlocks.
- Protect data in transit with current TLS configurations and protect production data, backup data, and export artifacts at rest. The precise algorithm and provider must be selected from the actual threat model and supported cryptographic libraries rather than copied into this repository-independent note.
- Separate production and non-production data. Do not use live financial records in development or tests unless they have been minimized and irreversibly sanitized for the purpose.
- Review service accounts and administrator access periodically. Production access should be narrow, attributable, time-bounded where practical, and auditable.

OWASP’s [Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) recommends minimizing sensitive storage, using appropriate encryption layers, and managing keys through their lifecycle. Its [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) emphasizes centralized lifecycle management, least privilege, automation, rotation, revocation, and never logging plaintext secrets.

#### Incident and audit readiness

- Maintain two deliberately separated classes of records:
  - **Operational telemetry:** high-volume request, dependency, performance, and job signals with short, purpose-based retention.
  - **Security/audit records:** authentication, authorization failures, export requests/downloads, privilege changes, configuration changes, backup actions, and incident evidence, with stricter access and integrity controls.
- Record the minimum investigative context: UTC timestamp or explicit offset, service/version, event type, outcome, opaque actor identifier where available, target type, correlation ID, and error class. Do not record the underlying financial content merely to prove that an event occurred.
- Protect logs from unauthorized reading, modification, deletion, and injection. Restrict access, encrypt transport/storage, detect collection failure, and include logging failure modes in tests.
- Maintain an incident response contact and a short runbook for account compromise, data exposure, ransomware/corruption, provider outage, key compromise, and export-link disclosure. The runbook should say who can disable sessions, revoke keys, freeze exports, restore data, preserve evidence, and assess notification duties.

[NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) connects incident response with the NIST CSF 2.0 risk-management lifecycle. [NIST SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final) provides log-management guidance. The [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) specifically calls out authentication and authorization events, export/audit trails, sanitization, access protection, secure transmission, monitoring, and retention/disposal. These sources support the control shape; they do not prescribe the project’s exact retention period.

### 3. Observability baseline

#### Instrumentation boundary

- Use OpenTelemetry APIs/SDKs or an adapter that can emit the same portable signals. Keep application instrumentation independent from the chosen backend.
- Propagate a request/trace correlation context across HTTP/API, database, queue, and background-job boundaries. Use W3C Trace Context where the protocol supports it.
- Prefer automatic instrumentation for framework/runtime signals, then add a small allowlisted set of domain events. Do not automatically capture request/response bodies or arbitrary database values.
- If a Collector is introduced, use it for routing, redaction, sampling, batching, and backend failover; do not make it a single point whose outage stops the product.

#### Minimum signals and alerts

| Signal | Minimum fields or measures | Initial alert examples |
| --- | --- | --- |
| Metrics | request rate, error rate, latency percentiles, saturation/quotas, database/dependency health, background-job age/failure, backup success/failure, export job success/failure | sustained 5xx/error spike; latency or queue age beyond the agreed user-impact threshold; dependency or database unavailable; backup or export job failed |
| Structured logs | UTC timestamp, service/version, event name, severity, outcome, correlation ID, opaque actor/tenant identifier when needed, target type, error class | log pipeline stopped; repeated authentication failures; authorization-denial burst; export failures; unexpected privilege/configuration changes |
| Traces | trace/span IDs, service boundaries, duration, status, safe operation names, dependency timing | high-latency path, repeated dependency timeout, job retry storm, anomalous export or backup path |
| Security/audit events | authentication success/failure, session/recovery changes, authorization failures, sensitive-action approvals, exports, privilege changes, backup administration, key-management actions | immediate notification for high-confidence account takeover, export abuse, key compromise, or backup deletion attempts |

The exact thresholds must come from the product’s SLOs and threat model. Avoid metric labels with user IDs, email addresses, transaction IDs, descriptions, amounts, or unbounded error text because high-cardinality or sensitive labels can turn metrics into an accidental data store.

#### Telemetry privacy and operations

- Create a field-level allowlist and redaction tests before enabling production collection. The default should be “do not collect” for financial payloads and credentials.
- Use structured records with a documented schema and UTC timestamps. Sanitize untrusted strings for log injection and bound lengths.
- Encrypt telemetry in transit and at rest, separate access from application-data access where practical, and audit access to security/audit logs.
- Define retention per purpose. Operational logs may be shorter-lived than security/audit evidence, but neither should be kept indefinitely by default. Check legal, contractual, incident-response, and user-rights constraints before setting a final number.
- Test telemetry under backend outage, network loss, malformed input, high volume, and disk/quota exhaustion. Logging failure must not leak data or take the application down.

**Evidence:** instrumentation inventory, event/metric schema, sensitive-field denylist, redaction test fixtures, dashboard/alert definitions, backend access policy, retention/deletion configuration, and a synthetic incident walkthrough.

### 4. Backup and recovery baseline

#### What to back up

Back up the authoritative financial data and the minimum rebuild set, not just a database snapshot:

- primary database and any transaction/event store;
- user-uploaded documents or other object storage;
- schema/migration history and versioned export schema;
- infrastructure/configuration needed to recreate the service, excluding live secrets;
- backup configuration and job metadata;
- audit records needed to investigate recovery or destructive actions; and
- the key-management recovery/escrow material needed to decrypt long-lived backups, protected separately and with explicit authorization.

Do not treat logs, caches, queues, derived dashboards, or temporary exports as authoritative financial records unless the data model explicitly says they are. Document what can be rebuilt and what must be restored.

#### Backup controls

- Automate backups at a frequency consistent with the approved RPO. Use point-in-time recovery when the service’s write frequency or user expectations make snapshots alone inadequate.
- Encrypt backups and restrict backup read/delete/restore permissions. Protect deletion with immutability, retention locks, a separate administrative plane, or an equivalent control appropriate to the provider.
- Keep at least one logically separate copy, preferably in a separate account/project and failure domain. For ransomware and destructive-admin scenarios, maintain an offline or otherwise inaccessible/immutable copy where feasible.
- Monitor backup job completion, age of last good backup, storage/quota failures, encryption/key availability, and deletion/retention-policy changes. Alert on failed or stale backups rather than discovering them during an outage.
- Restore into an isolated environment without exposing restored personal data to the public or to non-production users. Verify row/object counts, checksums or other integrity signals, schema compatibility, application startup, authentication, authorization, export, and representative financial calculations.
- Test recovery on an explicit schedule and after major schema, provider, encryption, or backup-policy changes. Record start/end time, recovered backup point, data-loss window, defects, and corrective action.
- Maintain a human-readable recovery runbook and a break-glass path for the case where the primary identity provider, deployment system, or key-management service is unavailable.

CISA’s [#StopRansomware Guide](https://www.cisa.gov/stopransomware/ransomware-guide) recommends offline, encrypted backups and regular testing of availability and integrity. CISA’s [ransomware advisory](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-352a) also recommends encrypted, immutable backups covering the organization’s data infrastructure. NIST’s [SP 800-34 Rev. 1 contingency-planning guide](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-34r1.pdf) says backup frequency and scope should be based on data criticality and the rate at which new information is introduced, and emphasizes off-site storage and testing. These are control principles; the project still has to choose its own RPO, RTO, retention, and cadence.

**Evidence:** backup inventory, provider configuration, last-good-backup dashboard, encryption/key-recovery record, restore runbook, restore-test report, measured RPO/RTO, and an exception record for anything not covered.

### 5. User export and portability baseline

#### Export contract

Make the export a consistent snapshot, not a collection of ad hoc API responses. The first contract should specify:

- a top-level manifest containing export version, schema version, generated-at time in UTC, data interval or snapshot point, subject/account scope, timezone and currency defaults, file list, byte sizes, and cryptographic integrity hashes;
- canonical JSON for records and relationships, using stable field names and explicit null/unknown semantics;
- CSV views for the common tables or reports, with documented UTF-8 encoding, delimiter, header, line endings, quoting, date/time, decimal, and empty-value rules;
- stable IDs and relationship references so accounts, categories, transactions, recurring items, and adjustments can be re-associated;
- monetary representation that does not rely on locale-formatted strings. Prefer an explicit currency code and a documented exact decimal or minor-unit representation;
- status and provenance fields where they matter, such as imported/source record, pending/voided/reconciled state, user-entered versus calculated value, and the source timestamp;
- an explicit list of omitted fields and why they are omitted; and
- a schema changelog and a small, versioned fixture that can be validated by an independent reader.

Illustrative package layout (names are not yet a product decision):

```text
export/
  manifest.json
  schema.json
  accounts.json
  transactions.json
  categories.json
  balances.json
  accounts.csv
  transactions.csv
  categories.csv
```

The JSON package is the canonical interchange representation. CSV is a convenience view and must not be allowed to become an accidental source of truth.

#### Export security and privacy

- Require the authenticated user to reauthenticate or complete step-up authentication immediately before creating or downloading an export, according to the threat model.
- Generate asynchronously from a consistent read/snapshot. Avoid holding a long request open or assembling a package from independently paginated live queries.
- Store the temporary artifact encrypted, with access restricted to the requesting subject and export worker. Use a short expiry, one-time or short-lived download authorization, and no public object URL.
- Record `export.requested`, `export.started`, `export.completed`, `export.downloaded`, `export.expired`, and `export.failed` events with outcome and correlation ID, but never record the package contents or secrets in logs.
- Delete expired temporary artifacts and any worker scratch files. The user’s downloaded copy is outside the service’s control and should be acknowledged in the product’s privacy/security design.
- Include only data the requester is authorized to receive. Exclude passwords, session tokens, refresh tokens, encryption keys, provider credentials, internal support notes, raw telemetry, backup metadata, and other users’ records. If a household/shared account exists, define whose data can be exported and how the rights of other people are protected.
- Escape or neutralize spreadsheet formula injection in CSV exports. OWASP ASVS 5.0.0 explicitly includes CSV/formula-injection verification requirements; RFC 4180 quoting alone does not address spreadsheet formula execution.
- Decide separately whether the product will support importing its own export or directly transferring data to another controller. An export that is readable and reusable does not automatically make a safe import format.

If GDPR applies, [Article 20 of Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) describes a right to receive certain personal data provided to a controller in a structured, commonly used, machine-readable format and, where technically feasible, to transmit it directly to another controller. The EDPB’s [small-business rights guidance](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en) explains that the right is conditional on the legal basis, automated processing, and the data having been provided by the data subject; it names JSON and CSV as common examples and says metadata is needed for reuse. Therefore:

- the product export should be broader and more useful than a narrow legal-portability subset where the product owner wants user control;
- the legal portability scope should not be inferred to include every derived score, internal risk label, security event, or other person’s data; and
- the final scope, response procedure, identity verification, retention, and deletion interactions require a jurisdiction/controller review.

**Evidence:** versioned schema and changelog, generated fixture, JSON/CSV parser tests, snapshot-consistency test, authorization test, reauthentication test, CSV-injection test, expiry/deletion test, download audit event, and a user-readable export guide.

## Cross-cutting tradeoffs

- **Portability versus convenience:** OpenTelemetry and versioned JSON reduce lock-in but require schema ownership. Provider-native features are faster initially and make migration harder later.
- **Security versus data availability:** Encryption and isolation reduce breach and ransomware impact, but key loss can make a backup unrecoverable. Key recovery and restore testing are therefore part of the backup feature, not an afterthought.
- **Telemetry usefulness versus privacy:** More payload and identity context can shorten debugging time but increases the impact of a telemetry compromise and retention burden. Allowlisted metadata and correlation IDs provide a better default than full request capture.
- **Export usefulness versus disclosure risk:** A rich export helps migration and user trust but becomes a high-value artifact. Reauthentication, consistent snapshots, short-lived delivery, scoped data, and expiry add friction but are proportionate to the data.
- **Operational cost versus recovery confidence:** Daily snapshots are cheap; independent immutable copies, restore environments, and drills cost time and storage. The proposed baseline spends that effort on evidence of recovery rather than on an untested “backup enabled” checkbox.
- **Control coverage versus delivery speed:** ASVS Level 2, tested recovery, and a real export contract add work before launch. They also prevent the most expensive forms of retrofitting: tenant-isolation fixes, unrecoverable encryption, incompatible schema exports, and telemetry scrubbing after sensitive data has already spread.
- **Privacy retention versus incident investigation:** Short retention reduces exposure, while longer audit evidence can improve investigation and accountability. Retention must be purpose-specific, access-controlled, and reviewed against legal and contractual requirements rather than copied from a vendor default.

## Proposed acceptance checklist for issue 13

Issue 13 can move from research to implementation planning when the following decisions are recorded:

- [ ] Data inventory, data-flow diagram, threat model, and ownership are approved.
- [ ] ASVS 5.0.0 profile is pinned, Level 2 is accepted or a documented alternative is approved, and exclusions/exceptions are listed.
- [ ] Identity provider/authentication, MFA or step-up points, session/recovery behavior, and object-level authorization model are selected.
- [ ] Secrets/key-management approach, encryption boundaries, key rotation, and key-recovery procedure are documented.
- [ ] Telemetry field allowlist, redaction rules, structured event schema, dashboards, alerts, access controls, and retention are defined.
- [ ] Backup scope, encryption, isolation/immutability, RPO, RTO, retention, monitoring, and restore cadence are approved.
- [ ] At least one restore test succeeds in an isolated environment and produces measured RPO/RTO evidence.
- [ ] Export schema, JSON/CSV rules, monetary/time semantics, authorization scope, temporary storage/expiry, and omission list are versioned.
- [ ] Export tests cover authorization, snapshot consistency, parser compatibility, CSV formula injection, expiry, deletion, and audit events.
- [ ] Incident contacts and runbooks cover account compromise, data exposure, ransomware/corruption, provider outage, key compromise, and export disclosure.
- [ ] The product/legal owner confirms whether GDPR or other jurisdiction-specific rights, breach timelines, retention rules, or sector obligations apply.

## Unresolved follow-ups

1. **Recover the issue body and Wayfinder context.** Confirm the acceptance criteria, dependencies, and intended scope of issue 13 and issue 1. The current research could only verify the title provided in the task.
2. **Choose the deployment shape.** Hosted web service, local-first app, single-user installation, multi-tenant SaaS, and mobile client change the identity, telemetry, backup, and export design materially.
3. **Inventory actual financial data.** Identify whether the product stores only manually entered records, imported bank transactions, documents, account numbers, payment credentials, or money-movement instructions. The latter cases need a substantially stronger review.
4. **Resolve jurisdiction and roles.** Determine user locations, establishment/targeting, controller/processor roles, third-party processors, data-transfer locations, retention duties, and whether the household-activity exception is relevant. Obtain legal review before treating the GDPR discussion as a compliance conclusion.
5. **Approve the threat model and security level.** Validate the proposed ASVS Level 2 target; decide whether any financial, administrator, or money-movement path requires Level 3 controls or additional sector standards.
6. **Set recovery objectives.** Agree RPO, RTO, retention duration, backup cadence, acceptable data loss, restore-test cadence, and recovery budget. The 24-hour/8-hour values in this note are planning proposals only.
7. **Select providers and review contracts.** Compare identity, database, object storage, telemetry, backup, key-management, and email/download providers for encryption, access logs, regional processing, exportability, retention, deletion, outage behavior, and incident notification.
8. **Define the domain export schema.** Resolve entities, relationship rules, exact money representation, timezone handling, imported/derived fields, shared-account rights, deleted records, attachments, and forward/backward compatibility.
9. **Decide import and direct transfer separately.** A user export is not automatically a safe import or a controller-to-controller transfer. Define validation, deduplication, conflict handling, and authorization before promising either.
10. **Exercise the system.** Run a redacted telemetry test, account/authorization test, export abuse test, backup restore, key-recovery drill, provider-outage drill, and incident tabletop. Feed findings back into the profile and runbooks.

## Direct sources checked

All external sources used for the findings are official documentation, standards, primary legal text, or first-party project guidance. Checked on 2026-08-15.

### Security and risk management

- [NIST Cybersecurity Framework 2.0, CSWP 29](https://csrc.nist.gov/pubs/cswp/29/the-nist-cybersecurity-framework-csf-20/final)
- [NIST Cybersecurity Framework resource center](https://www.nist.gov/cyberframework)
- [NIST SP 800-53 Rev. 5: Security and Privacy Controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [NIST SP 800-61 Rev. 3: Incident Response Recommendations](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
- [OWASP Application Security Verification Standard project](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP ASVS 5.0.0 source tree](https://github.com/OWASP/ASVS/tree/v5.0.0)
- [OWASP ASVS 5.0.0 verification levels](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x03-What-is-the-ASVS.md)
- [OWASP ASVS 5.0.0 machine-readable requirements](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

### Observability and telemetry

- [OpenTelemetry: What is OpenTelemetry?](https://opentelemetry.io/docs/what-is-opentelemetry/)
- [OpenTelemetry observability primer](https://opentelemetry.io/docs/concepts/observability-primer/)
- [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/)
- [OpenTelemetry specification principles](https://opentelemetry.io/docs/specs/otel/specification-principles/)
- [W3C Trace Context Recommendation](https://www.w3.org/TR/trace-context/)
- [Sentry organization privacy and data-scrubbing API](https://docs.sentry.io/api/organizations/update-an-organization/)
- [Sentry API reference and regional API domains](https://docs.sentry.io/api/)
- [Datadog OpenTelemetry integration](https://docs.datadoghq.com/opentelemetry/)
- [Datadog Sensitive Data Scanner for telemetry](https://docs.datadoghq.com/security/sensitive_data_scanner/setup/telemetry_data/)
- [Grafana Cloud introduction](https://grafana.com/docs/grafana-cloud/introduction/)
- [Grafana Cloud OTLP endpoint](https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/)

### Backups and recovery

- [CISA #StopRansomware Guide](https://www.cisa.gov/stopransomware/ransomware-guide)
- [CISA #StopRansomware advisory on backup and restoration](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-352a)
- [NIST SP 800-34 Rev. 1: Contingency Planning Guide](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-34r1.pdf)
- [NIST Recovery Point Objective glossary entry](https://csrc.nist.gov/glossary/term/recovery_point_objective)
- [NIST Recovery Time Objective glossary entry](https://csrc.nist.gov/glossary/term/recovery_time_objective)

### Export, portability, and interchange

- [Regulation (EU) 2016/679, consolidated English text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
- [European Data Protection Board: Respect individuals’ rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en)
- [RFC 8259: The JavaScript Object Notation Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259)
- [RFC 4180: Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180)

## Uncertainty note

The recommendation is deliberately stack-agnostic because the repository currently contains no implementation context, even though the issue body is available through authenticated local GitHub access. The control baseline, source interpretations, and proposed 24-hour RPO/8-hour RTO planning values should be revisited as soon as the Wayfinder decisions, architecture, data inventory, provider choices, and legal scope are known.
