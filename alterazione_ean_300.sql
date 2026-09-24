-- I20-988: l'ean degli articoli passa da 30 a 300 caratteri.
--
-- Serve perche' gli schemi di creazione, pg-ctx1.sql e pg-ctx2.sql, vengono applicati soltanto
-- quando il database viene creato la prima volta: su un'installazione gia' in uso la colonna
-- resta com'e' finche' non la si allarga a mano. Le installazioni nuove non hanno bisogno di
-- questo file, perche' nascono gia' con la misura giusta.
--
-- Va eseguito su OGNI database di Istanta dell'installazione, non su uno solo: un'installazione
-- puo' averne piu' d'uno, e allargarne uno solo lascia gli altri a trenta, dove gli ean
-- continuerebbero ad arrivare tagliati senza che nessuno se ne accorga finche' non li si guarda.
-- Si esegue come utente proprietario delle tabelle. Per esempio:
--
--   psql -h <host> -U <utente> -d <database> -f alterazione_ean_300.sql
--
-- Allargare una colonna di testo non tocca i dati gia' scritti e non richiede di riscrivere la
-- tabella, quindi l'operazione e' rapida anche su archivi grandi. Non e' comunque reversibile
-- senza perdita: tornare a trenta taglierebbe gli ean piu' lunghi, che a quel punto potrebbero
-- gia' esserci.
--
-- Questo file vale per PostgreSQL. Un'installazione su SQL Server ha bisogno dello stesso
-- allargamento, scritto nella sua sintassi, altrimenti il primo ean lungo fara' fallire la
-- scrittura invece di essere tagliato: la misura del taglio, nel programma, e' ora trecento.

ALTER TABLE articoli
    ALTER COLUMN ean TYPE character varying(300);
