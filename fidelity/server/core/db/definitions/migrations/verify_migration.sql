-- Script di verifica per controllare che la migrazione sia andata a buon fine
-- Esegui questo script dopo la migrazione per verificare l'integrità dei dati

-- Verifica che tutte le tabelle abbiano le colonne lowercase
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    CASE
        WHEN c.column_name = LOWER(c.column_name) THEN 'OK'
        ELSE 'PROBLEMA: Ancora camelCase'
    END as status
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
AND t.table_name NOT LIKE '%_old'
AND t.table_name NOT LIKE '%_new'
AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.column_name;

-- Verifica che non ci siano tabelle _old rimaste
SELECT
    table_name,
    'TABELLA OLD RIMASTA' as warning
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%_old'
ORDER BY table_name;

-- Verifica che non ci siano tabelle _new rimaste
SELECT
    table_name,
    'TABELLA NEW RIMASTA' as warning
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%_new'
ORDER BY table_name;

-- Conta i record nelle tabelle principali per verificare l'integrità
SELECT
    'utenti' as table_name,
    COUNT(*) as record_count
FROM utenti
UNION ALL
SELECT
    'gdo' as table_name,
    COUNT(*) as record_count
FROM gdo
UNION ALL
SELECT
    'aree' as table_name,
    COUNT(*) as record_count
FROM aree
UNION ALL
SELECT
    'canali' as table_name,
    COUNT(*) as record_count
FROM canali
UNION ALL
SELECT
    'punti_vendita' as table_name,
    COUNT(*) as record_count
FROM punti_vendita
UNION ALL
SELECT
    'ordini_stampa' as table_name,
    COUNT(*) as record_count
FROM ordini_stampa
UNION ALL
SELECT
    'attivita' as table_name,
    COUNT(*) as record_count
FROM attivita
UNION ALL
SELECT
    'webhooks' as table_name,
    COUNT(*) as record_count
FROM webhooks
ORDER BY table_name;

-- Verifica che gli indici siano stati ricreati correttamente
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename NOT LIKE '%_old'
AND tablename NOT LIKE '%_new'
ORDER BY tablename, indexname;

-- Verifica che le foreign key siano ancora presenti
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Verifica specifica per le colonne più importanti
SELECT 
    'utenti' as table_name,
    'id_utenti' as expected_column,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'utenti' AND column_name = 'id_utenti'
    ) THEN 'PRESENTE' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'utenti' as table_name,
    'nome_utenti' as expected_column,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'utenti' AND column_name = 'nome_utenti'
    ) THEN 'PRESENTE' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'utenti' as table_name,
    'email_utenti' as expected_column,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'utenti' AND column_name = 'email_utenti'
    ) THEN 'PRESENTE' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'punti_vendita' as table_name,
    'id_puntivendita' as expected_column,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'punti_vendita' AND column_name = 'id_puntivendita'
    ) THEN 'PRESENTE' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'punti_vendita' as table_name,
    'nome_puntivendita' as expected_column,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'punti_vendita' AND column_name = 'nome_puntivendita'
    ) THEN 'PRESENTE' ELSE 'MISSING' END as status
ORDER BY table_name, expected_column; 