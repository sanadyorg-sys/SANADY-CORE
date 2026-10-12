-- ════════════════════════════════════════════════════════════════════════════
-- Fix: the retention purge reads the storage paths of the documents to delete
-- with the service role (server only), but tables created since 11/10/2026
-- carry no privilege for service_role on this project. The read failed
-- silently, so expired applications were purged while their PDF files stayed
-- in storage. Grant exactly what the server needs: reading document paths.
-- ════════════════════════════════════════════════════════════════════════════

grant select on public.partnership_documents, public.enterprise_documents to service_role;
