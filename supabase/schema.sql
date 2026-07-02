-- 競合店チラシチェックアプリ用テーブル
-- Supabaseダッシュボードの SQL Editor で実行してください。

-- 競合店のチラシ情報（店舗・競合店・チラシから読み取った商品情報をまとめて1レコードで管理）
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  store_name text not null, -- 自社店舗名（店舗選択画面で選んだ店舗）
  competitor_name text not null, -- 競合店名
  address text, -- 住所
  flyer_url text, -- チラシ掲載URL
  product_name text, -- 商品名
  origin_or_maker text, -- 産地名もしくはメーカー名
  price numeric, -- 価格（本体価格）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 店舗ごとの一覧表示を高速化するためのインデックス
create index if not exists competitors_store_name_idx
  on public.competitors (store_name);

-- 更新時にupdated_atを自動更新する関数
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_competitors_updated_at on public.competitors;
create trigger set_competitors_updated_at
  before update on public.competitors
  for each row
  execute function public.set_updated_at();

-- RLS（行レベルセキュリティ）を有効化
alter table public.competitors enable row level security;

-- ログイン済みユーザー（チームメンバー）であれば全操作を許可する
drop policy if exists "competitors_select_authenticated" on public.competitors;
create policy "competitors_select_authenticated"
  on public.competitors
  for select
  to authenticated
  using (true);

drop policy if exists "competitors_insert_authenticated" on public.competitors;
create policy "competitors_insert_authenticated"
  on public.competitors
  for insert
  to authenticated
  with check (true);

drop policy if exists "competitors_update_authenticated" on public.competitors;
create policy "competitors_update_authenticated"
  on public.competitors
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "competitors_delete_authenticated" on public.competitors;
create policy "competitors_delete_authenticated"
  on public.competitors
  for delete
  to authenticated
  using (true);
