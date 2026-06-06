alter table profiles
  add column if not exists streak       int  not null default 0,
  add column if not exists last_opened  date;
