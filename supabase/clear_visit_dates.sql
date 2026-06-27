alter table public.visits alter column visited_at drop not null;

update public.visits
set visited_at = null;

do $$
declare
  row_data record;
  cleaned_note jsonb;
begin
  for row_data in
    select id, note
    from public.visits
    where note is not null and btrim(note) <> ''
  loop
    begin
      cleaned_note := row_data.note::jsonb;

      if jsonb_typeof(cleaned_note) = 'object' then
        cleaned_note := cleaned_note || '{"dateDisplay":"","datePrecision":"none"}'::jsonb;

        if coalesce(cleaned_note->>'rating', '0') in ('', '0')
          and coalesce(cleaned_note->>'text', '') = ''
        then
          update public.visits
          set note = null
          where id = row_data.id;
        else
          update public.visits
          set note = cleaned_note::text
          where id = row_data.id;
        end if;
      end if;
    exception when others then
      null;
    end;
  end loop;
end $$;
