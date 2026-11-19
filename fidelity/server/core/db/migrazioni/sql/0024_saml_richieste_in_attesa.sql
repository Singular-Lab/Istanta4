-- schema-dopo: 438f2df3b7e3b07424794ba57c2d8c2f4fd96625126b92a8e52c5630cc2b11db
-- Le richieste di accesso SAML in attesa della risposta dell'identity provider (spec
-- gestione-metodi-accesso, "Accesso tramite fornitore SAML").
--
-- Prima stavano nella memoria del processo: con due worker la risposta dell'IdP arrivava spesso
-- al worker che non aveva avviato l'accesso, che la rifiutava ("InResponseTo is not valid") e
-- l'utente tornava alla pagina di login. Ora le leggono tutti i worker. Una riga per richiesta
-- (chiave = ID della AuthnRequest), tolta alla prima risposta; quelle scadute (10 minuti) le
-- toglie SamlService alla richiesta successiva.
--
-- Rieseguibile: la tabella si crea solo se manca. La tabella e' nuova, non contiene dati.
CREATE TABLE IF NOT EXISTS public.saml_richieste_in_attesa (
  chiave VARCHAR(255) NOT NULL PRIMARY KEY,
  valore TEXT NOT NULL,
  creata_il TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
