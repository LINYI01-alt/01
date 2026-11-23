# Unified visitor identity rollout

This branch contains an additive database migration and a shared browser identity helper.

## Safety status
- Production database has NOT been migrated.
- The live Edge Function has NOT been replaced.
- The GitHub Pages default branch has NOT been changed.
- Existing records are retained. Legacy random browser keys are not force-linked to auth UUIDs.

## Deployment order
1. Review and apply `supabase/migrations/202611230001_unified_visitor_identity.sql` in a controlled database migration.
2. Load `js/visitor-identity.js` from the site shell.
3. Update AI Edge Function so it verifies the bearer token with Supabase Auth, derives visitor_id only from the verified user, and stores/loads conversation history server-side.
4. Update human chat to use the same shared client/session helper.
5. Replace direct REST analytics inserts with `linyiRecordPageView`.
6. Extend the admin UI to list visitor profiles and show a unified chronological timeline.
7. Test both entry orders (AI→human and human→AI), reload/return behavior, RLS and admin access before release.

## Initial classification thresholds
- new: first observed visit
- casual: second visit
- returning: 3–9 visits
- regular: 10+ visits
A visit is counted once per 30-minute inactivity window, not once per page view. These labels describe a browser identity, not a verified real-world person.

## Legacy data
Existing `ai_qa_logs` rows keep their existing visitor UUID values and are not automatically reassigned. Existing `site_page_views.visitor_key` strings are preserved; the new nullable `visitor_id` column is populated only by new authenticated page-view writes.
