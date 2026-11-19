-- the tickets bucket only takes pdfs and photos up to 20 mb, and the membership functions are for people signed in
update storage.buckets set file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/bmp']
  where id = 'files';
revoke execute on function public.is_member(), public.claim_member() from public, anon;
grant execute on function public.is_member(), public.claim_member() to authenticated;
