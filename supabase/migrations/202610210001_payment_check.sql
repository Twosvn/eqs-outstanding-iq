begin;
create table public.payment_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.payment_submissions (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  kind text not null check (kind in ('review','response','source')),
  company_number text not null check (company_number ~ '^[A-Z0-9]{8}$'),
  company_name text not null check (length(company_name) between 2 and 160),
  business_name text not null default '',
  contact_email text not null,
  payload jsonb not null,
  evidence_path text,
  fingerprint text not null,
  parent_id uuid references public.payment_submissions(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn','reviewed')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  reviewed_by uuid references auth.users(id),
  moderation_note text not null default '',
  version integer not null default 1,
  last_changed_by uuid references auth.users(id),
  verification jsonb not null default '{}'::jsonb,
  check (kind <> 'source' or status <> 'approved')
);
create index payment_owner_created on public.payment_submissions(owner_id, created_at desc);
create index payment_public_company on public.payment_submissions(company_number, published_at desc) where kind='review' and status='approved';
create index payment_moderation on public.payment_submissions(status, created_at);
alter table public.payment_admins enable row level security;
alter table public.payment_submissions enable row level security;
revoke all on public.payment_admins, public.payment_submissions from anon, authenticated;
grant all on public.payment_admins, public.payment_submissions to service_role;
-- Serialise submissions for an account so concurrent requests cannot bypass the limit.
create function public.payment_submission_limit() returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
  if (select count(*) from public.payment_submissions where owner_id=new.owner_id and created_at > now()-interval '24 hours') >= 20 then
    raise exception 'Daily submission limit reached' using errcode='P0001';
  end if;
  return new;
end;
$$;
create trigger payment_submission_limit before insert on public.payment_submissions for each row execute function public.payment_submission_limit();
create view public.payment_public_reviews with (security_barrier=true) as
select r.id, r.company_name as "companyName", r.company_number as "companyNumber",
  r.business_name as "reviewerBusiness", r.payload->>'title' as title,
  r.payload->>'experience' as experience, r.payload->>'outcome' as outcome,
  r.payload->>'paymentTerms' as "paymentTerms", r.payload->>'dueDate' as "dueDate",
  r.payload->>'paidDate' as "paidDate", to_char(r.published_at at time zone 'UTC','YYYY-MM-DD') as "publishedAt",
  (select jsonb_build_object('text',s.payload->>'response','publishedAt',to_char(s.published_at at time zone 'UTC','YYYY-MM-DD'))
   from public.payment_submissions s where s.parent_id=r.id and s.kind='response' and s.status='approved' and s.payload->>'requestType'='response'
   order by s.published_at desc limit 1) as response
from public.payment_submissions r where r.kind='review' and r.status='approved' and r.reviewed_by is not null;
revoke all on public.payment_public_reviews from public;
grant select on public.payment_public_reviews to anon, authenticated, service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('payment-evidence','payment-evidence',false,3145728,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table public.payment_moderation_events (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.payment_submissions(id),
  actor_id uuid references auth.users(id),
  status text not null,
  note text not null,
  outcome text,
  created_at timestamptz not null default now()
);
alter table public.payment_moderation_events enable row level security;
revoke all on public.payment_moderation_events from anon, authenticated;
grant select,insert on public.payment_moderation_events to service_role;
grant usage on sequence public.payment_moderation_events_id_seq to service_role;
create function public.payment_record_moderation() returns trigger language plpgsql set search_path=public as $$
begin
  insert into public.payment_moderation_events(submission_id,actor_id,status,note,outcome)
  values(new.id,new.last_changed_by,new.status,new.moderation_note,new.payload->>'outcome');
  return new;
end;
$$;
create trigger payment_record_moderation after update on public.payment_submissions for each row execute function public.payment_record_moderation();
-- No public Storage policies: the backend checks ownership/admin status before downloads.
commit;
