SELECT 
  id,
  public_key,
  private_key,
  meta_utente,
  tipo_utente,
  origine,
  email,
  expires_at,
  (expires_at > now()) AS is_valid
FROM auth
