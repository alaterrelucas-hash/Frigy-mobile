alter table items
  add column if not exists opened     bool not null default false,
  add column if not exists opened_at  date;
