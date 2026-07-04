-- ご近所チラシチェックアプリ用テーブル
-- Supabaseダッシュボードの SQL Editor で実行してください（再実行しても安全です）。

-- 登録店（自社店舗ごとに登録するチラシ掲載サイトの情報）
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  store_name text not null, -- 自社店舗名（店舗選択画面で選んだ店舗）
  competitor_name text not null, -- 登録店名
  address text, -- 住所
  flyer_url text, -- チラシ掲載URL
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 登録店のチラシから読み取った商品ごとの価格情報（1登録店に対して複数件持てる）
create table if not exists public.competitor_products (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  product_name text not null, -- 商品名
  origin_or_maker text, -- 産地名もしくはメーカー名
  price numeric, -- 価格（本体価格）
  flyer_image_path text, -- OCRに使用したチラシ画像のStorageパス
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 旧バージョン（competitorsに商品情報を同居させていた頃）からの移行
-- product_name列が残っている場合のみ、データをcompetitor_productsへ移してから列を削除する
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'competitors'
      and column_name = 'product_name'
  ) then
    insert into public.competitor_products
      (competitor_id, product_name, origin_or_maker, price, flyer_image_path, created_at, updated_at)
    select id, product_name, origin_or_maker, price, flyer_image_path, created_at, updated_at
    from public.competitors
    where product_name is not null;

    alter table public.competitors drop column product_name;
    alter table public.competitors drop column if exists origin_or_maker;
    alter table public.competitors drop column if exists price;
    alter table public.competitors drop column if exists flyer_image_path;
  end if;
end $$;

-- 店舗ごとの一覧表示を高速化するためのインデックス
create index if not exists competitors_store_name_idx
  on public.competitors (store_name);

create index if not exists competitor_products_competitor_id_idx
  on public.competitor_products (competitor_id);

create index if not exists competitor_products_product_name_idx
  on public.competitor_products (product_name);

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

drop trigger if exists set_competitor_products_updated_at on public.competitor_products;
create trigger set_competitor_products_updated_at
  before update on public.competitor_products
  for each row
  execute function public.set_updated_at();

-- RLS（行レベルセキュリティ）を有効化
alter table public.competitors enable row level security;
alter table public.competitor_products enable row level security;

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

drop policy if exists "competitor_products_select_authenticated" on public.competitor_products;
create policy "competitor_products_select_authenticated"
  on public.competitor_products
  for select
  to authenticated
  using (true);

drop policy if exists "competitor_products_insert_authenticated" on public.competitor_products;
create policy "competitor_products_insert_authenticated"
  on public.competitor_products
  for insert
  to authenticated
  with check (true);

drop policy if exists "competitor_products_update_authenticated" on public.competitor_products;
create policy "competitor_products_update_authenticated"
  on public.competitor_products
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "competitor_products_delete_authenticated" on public.competitor_products;
create policy "competitor_products_delete_authenticated"
  on public.competitor_products
  for delete
  to authenticated
  using (true);

-- OCR用にアップロードするチラシ画像を保存するStorageバケット（非公開）
insert into storage.buckets (id, name, public)
values ('flyer-images', 'flyer-images', false)
on conflict (id) do nothing;

-- ログイン済みユーザー（チームメンバー）であればアップロード・閲覧・削除を許可する
drop policy if exists "flyer_images_select_authenticated" on storage.objects;
create policy "flyer_images_select_authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'flyer-images');

drop policy if exists "flyer_images_insert_authenticated" on storage.objects;
create policy "flyer_images_insert_authenticated"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'flyer-images');

drop policy if exists "flyer_images_delete_authenticated" on storage.objects;
create policy "flyer_images_delete_authenticated"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'flyer-images');
