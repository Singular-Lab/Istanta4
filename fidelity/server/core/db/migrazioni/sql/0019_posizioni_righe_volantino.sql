-- schema-dopo: dfe006dc7a3e16f8a96721d87606fafc1be767eaaa7f7bf6bfa5c2f86a6dd077
-- La posizione delle righe stampate nelle liste dei volantini, per verificare a quale punto vendita
-- sono collegate e per suggerire i PV vicini nella gestione dei punti vendita.
--
-- Una riga per GDO e chiave della posizione ("ind:<localita'>|<indirizzo>" o "loc:<localita'>"):
-- ogni indirizzo si cerca in Nominatim una volta sola, anche se e' stampato in molti volantini e
-- anche quando un kit si risincronizza (riscrive le sue righe in punti_vendita_volantino). La
-- posizione corretta a mano (fonte 'manuale', coordinate di Google Maps) non si sovrascrive.
-- L'anagrafica dei punti vendita non si tocca.
--
-- La chiave primaria (id_gdo, chiave) serve anche le letture per GDO. Rieseguibile: la tabella si
-- crea solo se manca. Niente CONCURRENTLY: la tabella e' nuova.
CREATE TABLE IF NOT EXISTS public.posizioni_righe_volantino (
  id_gdo UUID NOT NULL,
  chiave TEXT NOT NULL,
  ricerca TEXT,
  lat NUMERIC(10,8),
  lon NUMERIC(11,8),
  precisione TEXT NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'nominatim',
  errore TEXT,
  aggiornata_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  aggiornata_da VARCHAR(255),
  PRIMARY KEY (id_gdo, chiave)
);
