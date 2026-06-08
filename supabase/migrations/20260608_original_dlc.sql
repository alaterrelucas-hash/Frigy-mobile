alter table items
  add column if not exists original_dlc       text,
  add column if not exists original_days_left int;
