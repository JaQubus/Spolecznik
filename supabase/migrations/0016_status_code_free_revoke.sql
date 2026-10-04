-- status_code_free (0015) odpala wyłącznie trigger; jako security definer nie powinien być wywoływalny wprost.
revoke execute on function status_code_free() from public, anon, authenticated;
