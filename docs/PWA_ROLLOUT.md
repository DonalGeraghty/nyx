# PWA rollout and rollback

The implementation is split into three independently verifiable layers even
though they live on the same feature branch.

## Phase 1: installable shell

- Generated manifest and install icons
- Custom Workbox service worker
- Offline navigation for the app shell
- Network-only handling for every authenticated Janus Gate API request
- User-controlled update prompt
- Cloud Run/Nginx cache headers for HTML, manifest, and service worker files

Verification: build the production bundle, serve it over HTTPS (or localhost),
install it, open each route once, then reload a route with the network disabled.

Rollback boundary: remove the PWA plugin/provider and service-worker source.
No server or user-data migration is involved.

## Phase 2: private offline data

- Immutable `account_id` in authentication responses
- IndexedDB history snapshots, drafts, metadata, and outbox partitioned by that ID
- Raw offline meal text saved only as a draft
- Explicit analysis after reconnection
- Reviewed nutrition creates queued without storing the JWT
- Stable `client_request_id` and idempotent server creation
- Local data cleared on logout and account deletion

Verification: cache two account generations using the same email and confirm
that neither can read the other's rows; retry one request ID and confirm one
server entry; verify that an offline raw description never invokes analysis.

Rollback boundary: disable the offline UI/sync manager first. The optional
`client_request_id` remains backward compatible on Janus Gate and can safely
stay deployed while the frontend rolls back.

## Phase 3: opt-in reminders

- Browser capability and permission checks
- Per-user reminder time and IANA timezone
- Account-scoped Push subscriptions
- Generic notification payloads
- VAPID configuration
- Five-minute scheduler dispatch with a per-user delivery claim
- Expired subscription cleanup and account-deletion cleanup

Verification: enable a test device, run the protected dispatch endpoint, check
one notification, run it again on the same local date, and confirm no duplicate
delivery. Disable the reminder and confirm the subscription is removed.

Rollback boundary: disable/delete the Cloud Scheduler job first, then roll back
the reminder UI or backend. Existing subscriptions are inert while settings
are disabled or no scheduler invokes dispatch.
