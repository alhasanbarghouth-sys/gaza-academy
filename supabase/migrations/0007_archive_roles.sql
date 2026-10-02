-- ============================================================================
-- Archive roles (المخطط التصنيفي — الباب 8، مصفوفة الأدوار).
--
-- The permission matrix names four roles the system did not have yet.
-- Postgres only lets a new enum value be used after the statement that adds
-- it has been committed, so these live in their own file: run this one
-- first, on its own, then 0008_archive.sql.
--
--   board_member : مجلس الإدارة
--   archivist    : مسؤول الأرشيف (metadata & classification, not S3 content)
--   volunteer    : متطوع
--   auditor      : مدقق خارجي (sees nothing until given a time-limited grant)
-- ============================================================================

alter type public.user_role add value if not exists 'board_member';
alter type public.user_role add value if not exists 'archivist';
alter type public.user_role add value if not exists 'volunteer';
alter type public.user_role add value if not exists 'auditor';
