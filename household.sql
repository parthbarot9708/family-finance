-- Run this ONCE in Supabase > SQL Editor (after your first SQL)
create table households (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_by uuid default auth.uid()
);
create table household_members (
  household_id uuid references households on delete cascade,
  user_id uuid references auth.users default auth.uid(),
  display_name text,
  primary key (household_id, user_id)
);
alter table households enable row level security;
alter table household_members enable row level security;

create function my_household_ids() returns setof uuid
language sql security definer stable set search_path = public as
$$ select household_id from household_members where user_id = auth.uid() $$;

create policy h_read on households for select using (id in (select my_household_ids()));
create policy hm_read on household_members for select using (household_id in (select my_household_ids()));
create policy hm_leave on household_members for delete using (user_id = auth.uid());

create function create_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  insert into households(created_by) values (auth.uid()) returning id into hid;
  insert into household_members(household_id, user_id, display_name) values (hid, auth.uid(), p_name);
  return hid;
end $$;

create function join_household(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select id into hid from households where invite_code = lower(p_code);
  if hid is null then raise exception 'Invalid invite code'; end if;
  insert into household_members(household_id, user_id, display_name)
    values (hid, auth.uid(), p_name) on conflict do nothing;
  return hid;
end $$;

-- Totals only: lets household members see each other's overall income and expenses
create function household_summary()
returns table(user_id uuid, display_name text, total_income numeric, total_expense numeric)
language sql security definer stable set search_path = public as $$
  select m.user_id, m.display_name,
    coalesce((select sum(income) from transactions t where t.user_id = m.user_id), 0),
    coalesce((select sum(expense) from transactions t where t.user_id = m.user_id), 0)
  from household_members m
  where m.household_id in (select my_household_ids())
$$;
