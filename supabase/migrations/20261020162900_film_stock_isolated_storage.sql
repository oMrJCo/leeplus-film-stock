-- Film stock only. No changes to existing LEEPLUS tables or default privileges.
create table public.film_stock_meta(id integer primary key check(id=1),revision bigint not null default 0,data jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now());
insert into public.film_stock_meta(id) values(1);
do $$declare t text;begin
 foreach t in array array['products','lots','boxes','orders','counts','moves','audit','users','sessions','login_attempts'] loop
  execute format('create table public.%I(record_key text primary key,position integer not null,data jsonb not null)', 'film_stock_'||t);
 end loop;
 foreach t in array array['meta','products','lots','boxes','orders','counts','moves','audit','users','sessions','login_attempts'] loop
  execute format('alter table public.%I enable row level security','film_stock_'||t);
  execute format('revoke all on public.%I from public,anon,authenticated','film_stock_'||t);
  execute format('grant select,insert,update,delete on public.%I to service_role','film_stock_'||t);
 end loop;
end $$;
create unique index film_stock_product_code_unique on public.film_stock_products(lower(data->>'code'));
create unique index film_stock_user_phone_unique on public.film_stock_users((data->>'phone')) where data->>'phone' is not null;
create index film_stock_box_lot_idx on public.film_stock_boxes((data->>'lot'));
create index film_stock_order_status_idx on public.film_stock_orders((data->>'status'));
create or replace function public.film_stock_read() returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.film_stock_meta%rowtype; result jsonb; k text; t text; arr jsonb;
begin
 select * into strict m from public.film_stock_meta where id=1 for share;
 result:=m.data;
 for k,t in select * from (values('products','products'),('lots','lots'),('boxes','boxes'),('orders','orders'),('counts','counts'),('moves','moves'),('audit','audit'),('members','users'),('authSessions','sessions'),('authAttempts','login_attempts')) as mapping(k,t) loop
  execute format('select coalesce(jsonb_agg(data order by position),''[]''::jsonb) from public.%I','film_stock_'||t) into arr;
  result:=jsonb_set(result,array[k],arr);
 end loop;
 return jsonb_build_object('revision',m.revision,'data',result);
end $$;
create or replace function public.film_stock_write(p_revision bigint,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_revision bigint;k text;t text;id_field text;arr jsonb;key_list text[];
begin
 select revision into strict current_revision from public.film_stock_meta where id=1 for update;
 if current_revision<>p_revision then return jsonb_build_object('changed',false,'revision',current_revision);end if;
 if jsonb_typeof(p_data)<>'object' or coalesce(p_data->>'owner','')='' then raise exception 'Invalid film stock state';end if;
 for k,t,id_field in select * from (values('products','products','id'),('lots','lots','id'),('boxes','boxes','id'),('orders','orders','id'),('counts','counts','id'),('moves','moves',''),('audit','audit','id'),('members','users','id'),('authSessions','sessions','hash'),('authAttempts','login_attempts','key')) as mapping(k,t,id_field) loop
  arr:=coalesce(p_data->k,'[]'::jsonb);if jsonb_typeof(arr)<>'array' then raise exception 'Invalid resource %',k;end if;
  select coalesce(array_agg(coalesce(nullif(value->>id_field,''),case when k='members' then value->>'email' end,ordinality::text)),'{}') into key_list from jsonb_array_elements(arr) with ordinality;
  execute format('delete from public.%I where not(record_key=any($1))','film_stock_'||t) using key_list;
  execute format('insert into public.%I as dst(record_key,position,data) select coalesce(nullif(value->>$2,''''),case when $3=''members'' then value->>''email'' end,ordinality::text),ordinality::integer,value from jsonb_array_elements($1) with ordinality on conflict(record_key) do update set position=excluded.position,data=excluded.data where dst.data is distinct from excluded.data or dst.position<>excluded.position','film_stock_'||t) using arr,id_field,k;
 end loop;
 update public.film_stock_meta set revision=current_revision+1,data=p_data-array['products','lots','boxes','orders','counts','moves','audit','members','authSessions','authAttempts'],updated_at=now() where id=1;
 return jsonb_build_object('changed',true,'revision',current_revision+1);
end $$;
revoke all on function public.film_stock_read() from public,anon,authenticated;
revoke all on function public.film_stock_write(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.film_stock_read() to service_role;
grant execute on function public.film_stock_write(bigint,jsonb) to service_role;
