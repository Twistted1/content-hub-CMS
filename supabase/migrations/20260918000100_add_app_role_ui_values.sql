-- `app_role` was created with three values (`admin`, `moderator`, `user`) but
-- the Users page offers four (`admin`, `editor`, `viewer`, `member`) and writes
-- the selected label straight into `user_roles.role`. Selecting Editor, Viewer
-- or Member therefore failed with `invalid input value for enum app_role` -
-- three of the four roles in the RBAC UI were unusable.
--
-- The UI vocabulary is the one users see and the one the i18n catalog is
-- written against, so the enum is extended to match rather than renaming the
-- UI. `moderator` is retained: `useUserRole` still resolves it.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'editor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'member';
