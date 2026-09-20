-- Vint AR — schema inicial (Supabase / Postgres)
-- Basado en la sección 4 del spec de migración. Pensado para correr una sola
-- vez sobre un proyecto Supabase nuevo (SQL editor o `supabase db push`).

-- ---------------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text check (char_length(name) <= 60),
  avatar_url text,
  location text check (location is null or char_length(location) <= 120),
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  price numeric not null check (price >= 0 and price < 100000000),
  category text not null check (category in ('Ropa', 'Calzado', 'Accesorios', 'Hogar vintage')),
  condition text not null check (condition in ('Nuevo con etiqueta', 'Muy bueno', 'Bueno', 'Con detalles')),
  size text check (size is null or char_length(size) <= 20),
  description text check (description is null or char_length(description) <= 3000),
  location text check (location is null or char_length(location) <= 120),
  photo_urls text[] check (photo_urls is null or array_length(photo_urls, 1) <= 6),
  status text not null default 'activo' check (status in ('activo', 'vendido')),
  sold_to uuid references profiles(id),
  sold_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists listings_seller_id_idx on listings(seller_id);
create index if not exists listings_status_idx on listings(status);
create index if not exists listings_category_idx on listings(category);
create index if not exists listings_created_at_idx on listings(created_at desc);

create table if not exists favorites (
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  last_message text,
  last_at timestamptz,
  buyer_unread boolean not null default false,
  seller_unread boolean not null default false,
  buyer_last_read_at timestamptz,
  seller_last_read_at timestamptz,
  unique (listing_id, buyer_id)
);

create index if not exists conversations_buyer_id_idx on conversations(buyer_id);
create index if not exists conversations_seller_id_idx on conversations(seller_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  from_id uuid not null references profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on messages(conversation_id, created_at);

create table if not exists ratings (
  seller_id uuid not null references profiles(id) on delete cascade,
  rater_id uuid not null references profiles(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  primary key (seller_id, rater_id)
);

-- ---------------------------------------------------------------------------
-- profiles: se crea automáticamente al registrarse
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- messages: al insertar, actualiza el resumen de la conversación
-- (reemplaza la lógica que en el prototipo vivía en el cliente)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv conversations%rowtype;
begin
  select * into conv from conversations where id = new.conversation_id;

  update conversations
  set
    last_message = new.text,
    last_at = new.created_at,
    buyer_unread = case when new.from_id = conv.seller_id then true else buyer_unread end,
    seller_unread = case when new.from_id = conv.buyer_id then true else seller_unread end
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists on_message_created on messages;
create trigger on_message_created
  after insert on messages
  for each row execute procedure public.handle_new_message();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table listings enable row level security;
alter table favorites enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table ratings enable row level security;

-- profiles: perfiles visibles para todos (nombre, avatar, ubicación en
-- publicaciones y calificaciones), pero cada usuario solo edita el suyo.
create policy "profiles are viewable by everyone"
  on profiles for select using (true);

create policy "users can update own profile"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- listings: cualquiera ve publicaciones; solo el dueño crea/edita/borra.
create policy "listings are viewable by everyone"
  on listings for select using (true);

create policy "users can insert own listings"
  on listings for insert with check (auth.uid() = seller_id);

-- Marcar como "vendido" solo vale si sold_to es alguien que de verdad
-- inició una conversación por esta publicación con este vendedor — si no,
-- cualquiera podría fabricar una "venta" a una cuenta cómplice y esa cuenta
-- podría calificarse a sí misma con 5 estrellas (la política de ratings
-- exige sold_to = rater_id, pero confiaba en que este UPDATE fuera honesto).
create policy "users can update own listings"
  on listings for update
  using (auth.uid() = seller_id)
  with check (
    auth.uid() = seller_id
    and (
      status = 'activo'
      or (
        status = 'vendido'
        and sold_to is not null
        and exists (
          select 1 from conversations c
          where c.listing_id = listings.id
            and c.seller_id = auth.uid()
            and c.buyer_id = listings.sold_to
        )
      )
    )
  );

create policy "users can delete own listings"
  on listings for delete using (auth.uid() = seller_id);

-- favorites: cada usuario administra solo sus propios favoritos.
create policy "users can view own favorites"
  on favorites for select using (auth.uid() = user_id);

create policy "users can add own favorites"
  on favorites for insert with check (auth.uid() = user_id);

create policy "users can remove own favorites"
  on favorites for delete using (auth.uid() = user_id);

-- conversations: solo comprador y vendedor de esa conversación la ven.
-- Esto es lo que el prototipo no podía garantizar y acá se resuelve en la
-- base de datos, no en el cliente.
create policy "participants can view conversation"
  on conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "buyers can start a conversation"
  on conversations for insert
  with check (auth.uid() = buyer_id);

create policy "participants can update conversation"
  on conversations for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- messages: solo comprador y vendedor de la conversación asociada.
create policy "participants can view messages"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

create policy "participants can send messages"
  on messages for insert
  with check (
    auth.uid() = from_id
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

-- ratings: visibles para todos (se muestran en el perfil del vendedor);
-- solo se puede calificar tras una venta confirmada a ese comprador.
create policy "ratings are viewable by everyone"
  on ratings for select using (true);

create policy "buyers can rate after a confirmed sale"
  on ratings for insert
  with check (
    auth.uid() = rater_id
    and exists (
      select 1 from listings l
      where l.seller_id = ratings.seller_id
        and l.sold_to = ratings.rater_id
        and l.status = 'vendido'
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: bucket para fotos de publicaciones
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  8388608, -- 8 MB por archivo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "listing photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

-- Antes cualquier usuario logueado podía subir a la carpeta de CUALQUIER
-- otro usuario (el bucket solo chequeaba el nombre, no la ruta). Ahora cada
-- quien solo puede subir dentro de su propia carpeta ("<su_user_id>/...",
-- que es como la app ya sube las fotos).
create policy "authenticated users can upload listing photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners can update their listing photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and owner = auth.uid());

create policy "owners can delete their listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- reports: reportar publicaciones o vendedores (moderación)
-- ---------------------------------------------------------------------------

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'user')),
  target_id uuid not null,
  reason text not null check (char_length(reason) <= 200),
  comment text check (comment is null or char_length(comment) <= 1000),
  status text not null default 'pendiente' check (status in ('pendiente', 'revisado')),
  created_at timestamptz not null default now()
);

create index if not exists reports_target_idx on reports(target_type, target_id);

alter table reports enable row level security;

-- cualquier usuario logueado puede crear un reporte a nombre propio.
create policy "users can create reports"
  on reports for insert
  with check (auth.uid() = reporter_id);

-- cada usuario puede ver únicamente los reportes que hizo (no los ajenos).
-- La revisión de reportes por un moderador se hace directo en Supabase con
-- la service_role key, que no está sujeta a RLS.
create policy "reporters can view their own reports"
  on reports for select
  using (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- Permisos base (por debajo de RLS). Sin esto, aunque las políticas de
-- arriba sean correctas, Postgres igual devuelve "permission denied".
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- ---------------------------------------------------------------------------
-- Eliminar cuenta propia (requisito de Apple App Store guideline 5.1.1(v):
-- toda app que permite crear una cuenta tiene que permitir borrarla desde
-- adentro). Borra la fila de auth.users; profiles/listings/favorites/
-- conversations/messages/ratings/reports del usuario se van en cascada por
-- las FKs "on delete cascade" ya definidas arriba.
-- ---------------------------------------------------------------------------

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
