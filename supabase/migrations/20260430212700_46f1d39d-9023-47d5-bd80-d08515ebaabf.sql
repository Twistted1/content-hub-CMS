alter table public.posts
  add column if not exists automation_id uuid,
  add column if not exists pipeline_run_id uuid,
  add column if not exists workflow_stage text not null default 'draft',
  add column if not exists review_requested_at timestamp with time zone,
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists publish_attempted_at timestamp with time zone,
  add column if not exists publish_error text;

create index if not exists idx_posts_automation_id on public.posts(automation_id);
create index if not exists idx_posts_pipeline_run_id on public.posts(pipeline_run_id);
create index if not exists idx_posts_workflow_stage on public.posts(workflow_stage);
create index if not exists idx_posts_publish_due on public.posts(status, scheduled_at) where scheduled_at is not null;

create or replace function public.sync_post_workflow_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'generating' then
    new.workflow_stage := 'generating';
  elsif new.status = 'awaiting_review' then
    new.workflow_stage := 'review';
    new.review_requested_at := coalesce(new.review_requested_at, now());
  elsif new.status = 'scheduled' then
    new.workflow_stage := 'scheduled';
    new.reviewed_at := coalesce(new.reviewed_at, now());
  elsif new.status = 'published' then
    new.workflow_stage := 'published';
    new.published_at := coalesce(new.published_at, now());
  elsif new.status = 'failed' then
    new.workflow_stage := 'failed';
  else
    new.workflow_stage := 'draft';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_posts_workflow_stage on public.posts;
create trigger sync_posts_workflow_stage
before insert or update of status on public.posts
for each row
execute function public.sync_post_workflow_stage();

update public.posts
set workflow_stage = case
  when status = 'generating' then 'generating'
  when status = 'awaiting_review' then 'review'
  when status = 'scheduled' then 'scheduled'
  when status = 'published' then 'published'
  when status = 'failed' then 'failed'
  else 'draft'
end,
review_requested_at = case when status = 'awaiting_review' then coalesce(review_requested_at, created_at) else review_requested_at end,
reviewed_at = case when status in ('scheduled', 'published') then coalesce(reviewed_at, updated_at) else reviewed_at end
where workflow_stage is null or workflow_stage in ('Creation', 'Review');