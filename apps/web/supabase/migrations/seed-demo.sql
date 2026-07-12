-- seed-demo.sql — provision & reset the public demo account. Idempotent.
-- Prereq: demo auth user exists with email = DEMO_USER_EMAIL below.
do $$
declare
  v_demo_email text := 'demo@claimdesk.app';   -- <<< must match DEMO_USER_EMAIL
  v_demo uuid;
  v_src  uuid;
  r_case record;
  r_doc  record;
  new_case_id uuid;
  new_doc_id  uuid;
begin
  select id into v_demo from auth.users where email = v_demo_email;
  if v_demo is null then
    raise exception 'Demo user % not found — create it in Auth first.', v_demo_email;
  end if;

  -- Source = whoever currently owns the seeded flood case (your dev account).
  select created_by into v_src
    from cases
   where title like 'Alvarez v. Shield Mutual%' and created_by <> v_demo
   order by created_at limit 1;
  if v_src is null then
    raise exception 'Source seed data not found (Alvarez flood case).';
  end if;

  -- Reset: wipe demo-owned data (cascades handle children, explicit for clarity).
  delete from letters   where created_by = v_demo;
  delete from chunks    where created_by = v_demo;
  delete from documents where created_by = v_demo;
  delete from cases     where created_by = v_demo;

  -- Copy cases → documents → chunks, remapping ids, embeddings carried over as-is.
  for r_case in select * from cases where created_by = v_src loop
    new_case_id := gen_random_uuid();
    insert into cases (id, created_by, title, client_name, claim_type, insurer,
                       policy_number, state, date_of_loss, amount_offered,
                       amount_claimed, status, is_nfip, created_at)
    values (new_case_id, v_demo, r_case.title, r_case.client_name, r_case.claim_type,
            r_case.insurer, r_case.policy_number, r_case.state, r_case.date_of_loss,
            r_case.amount_offered, r_case.amount_claimed, r_case.status,
            r_case.is_nfip, r_case.created_at);

    for r_doc in select * from documents where case_id = r_case.id loop
      new_doc_id := gen_random_uuid();
      insert into documents (id, case_id, created_by, storage_path, doc_type, title,
                             page_count, ingest_status, toc_tree, ingest_stats, created_at)
      values (new_doc_id, new_case_id, v_demo, r_doc.storage_path, r_doc.doc_type,
              r_doc.title, r_doc.page_count, r_doc.ingest_status, r_doc.toc_tree,
              r_doc.ingest_stats, r_doc.created_at);

      insert into chunks (document_id, created_by, section_label, page_start, page_end,
                          content, embedding, created_at)
      select new_doc_id, v_demo, section_label, page_start, page_end,
             content, embedding, created_at
        from chunks where document_id = r_doc.id;
    end loop;
  end loop;

  raise notice 'Demo data provisioned for % from source %.', v_demo, v_src;
end $$;