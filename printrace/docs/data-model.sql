-- Printrace : schéma PostgreSQL cible (comptes, posters, commandes).
-- Aujourd'hui les dépôts sont en mémoire (MemoryOrderRepository, DesignStore) ;
-- ce schéma est celui à implémenter derrière les mêmes interfaces.

create table users (
  id            text primary key,                 -- usr_…
  email         citext unique not null,
  name          text,
  locale        text not null default 'fr',
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Connexion par lien magique (e-mail) : jeton à usage unique, haché
create table login_tokens (
  token_hash  text primary key,
  email       citext not null,
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create table sessions (
  id          text primary key,                   -- valeur du cookie signé
  user_id     text not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Comptes liés (Strava : import d'activités, et connexion « Continuer avec Strava »)
create table oauth_accounts (
  user_id        text not null references users(id) on delete cascade,
  provider       text not null,                   -- 'strava'
  provider_uid   text not null,                   -- id athlète
  access_token   bytea not null,                  -- chiffré (AES-GCM, clé hors base)
  refresh_token  bytea not null,
  expires_at     timestamptz not null,
  primary key (provider, provider_uid)
);

-- Activités importées (trace simplifiée + stats) : réutilisables pour plusieurs posters
create table activities (
  id          text primary key,
  user_id     text references users(id) on delete cascade,  -- null : brouillon anonyme
  source      text not null,                      -- file | strava | sample
  source_ref  text,                               -- id d'activité Strava
  name        text not null,
  sport       text not null,
  stats       jsonb not null,
  coords      bytea not null,                     -- Activity.coords compressé (gzip JSON ou polyline)
  created_at  timestamptz not null default now()
);

-- Posters enregistrés. La spec est versionnée (PosterSpec.version).
create table designs (
  id           text primary key,                  -- dsg_…
  user_id      text references users(id) on delete set null,
  activity_id  text not null references activities(id),
  spec         jsonb not null,
  thumbnail    text,                              -- clé de stockage d'une vignette PNG
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create type order_status as enum (
  'awaiting_payment','paid','rendering','ready','submitted','in_production',
  'shipped','delivered','cancelled','refunded','failed'
);

create table orders (
  id                    text primary key,         -- ord_… (sert aussi de jeton de suivi)
  user_id               text references users(id) on delete set null,
  email                 citext,
  design_id             text not null references designs(id),
  spec                  jsonb not null,           -- figée au moment de la commande
  product_id            text not null,
  product_snapshot      jsonb not null,           -- nom, prix, SKU au moment de l'achat
  quantity              int not null default 1,
  amount_total          int not null,             -- centimes TTC
  currency              char(3) not null,
  status                order_status not null,
  shipping_address      jsonb,
  payment_provider      text,
  payment_session_id    text unique,
  payment_id            text unique,
  fulfillment_provider  text,
  fulfillment_id        text unique,
  tracking_url          text,
  print_file_key        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index orders_user on orders(user_id, created_at desc);
create index orders_status on orders(status) where status in ('paid','rendering','failed');

-- Journal immuable (historique client, support, audit)
create table order_events (
  id        bigserial primary key,
  order_id  text not null references orders(id) on delete cascade,
  status    order_status not null,
  note      text,
  at        timestamptz not null default now()
);

-- Idempotence des webhooks (Stripe et imprimeur rejouent les événements)
create table webhook_events (
  provider     text not null,
  event_id     text not null,
  received_at  timestamptz not null default now(),
  primary key (provider, event_id)
);
