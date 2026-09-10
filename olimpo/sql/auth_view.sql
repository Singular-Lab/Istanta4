-- Funzione per rigenerare la public_key
CREATE OR REPLACE FUNCTION renew_public_key(p_id UUID)
  RETURNS TEXT AS $$
DECLARE
  new_key TEXT;
BEGIN
  UPDATE auth
    SET public_key = gen_random_uuid()::TEXT
    WHERE id = p_id
    RETURNING public_key INTO new_key;
  RETURN new_key;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Creazione dinamica della VIEW auth_view che include tutte le colonne di auth
DO $$
DECLARE
  cols TEXT;
BEGIN
  -- Aggrega i nomi delle colonne tranne public_key, ordinati per posizione
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'auth'
    AND column_name <> 'public_key';

  -- Costruisci e crea la view sostituendo public_key con il valore rigenerato
  EXECUTE format(
    'CREATE OR REPLACE VIEW auth_view AS SELECT %s, renew_public_key(id) AS public_key FROM auth',
    cols
  );
END;
$$ LANGUAGE plpgsql;
