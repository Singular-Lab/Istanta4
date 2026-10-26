# Schema del database

> **Questo documento e generato**, non scritto a mano. Lo produce
> `strumenti/genera-riferimento.sh` interrogando il database configurato in
> `/etc/istanta4-pgtest.env`. Non modificarlo: rilancia lo script.
>
> Generato il 14/09/2026 alle 19:21, su `istanta4_pg`.
>
> **Nessuna credenziale compare in questo file.**

`PostgreSQL 16.4 (Debian 16.4-1.pgdg110+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian `

---

## Le tabelle

| tabella | righe |
|---|---:|
| `Attivita` | 3 |
| `AttivitaLogs` | 1 |
| `addestramento_excel` | 0 |
| `addestramento_excel_relazioni` | 0 |
| `articoli` | 51 |
| `articoli_descrizioni` | 51 |
| `articoli_foto` | 31 |
| `foto_escluse` | 0 |
| `menabo_pagine` | 0 |
| `menabo_ref` | 0 |
| `promo` | 1 |
| `promo_importazioni` | 1 |
| `promo_lavorazioni` | 1 |
| `promo_lavorazioni_records` | 51 |
| `promo_tracciati` | 1 |
| `promo_tracciati_records` | 51 |
| `registro_operazioni` | 51 |
| `registro_propagazioni` | 0 |
| `schema_campi_excel` | 0 |
| `schema_campi_excel_relazioni` | 0 |
| `schema_custom` | 0 |
| `schema_custom_records` | 0 |
| `settings` | 0 |
| `utenti` | 3 |
| `utenti_fico` | 0 |

**25 tabelle.**

> Il database demo e quasi vuoto: i numeri qui sopra non dicono niente sulla produzione.

---

## Le colonne


### `Attivita`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_parent` | bigint | si |  |
| `id_utente` | smallint | si |  |
| `coda` | smallint | **NO** |  |
| `titolo` | character varying | si |  |
| `contract` | character varying | si |  |
| `data_inserimento` | timestamp without time zone | **NO** |  |
| `tipo` | smallint | **NO** | `1` |
| `tipo_processo` | smallint | **NO** | `1` |
| `stato` | smallint | **NO** |  |
| `progress` | smallint | **NO** |  |
| `stato_msg` | character varying | si |  |
| `data_fine` | timestamp without time zone | si |  |
| `data_inizio` | timestamp without time zone | si |  |
| `priorita` | smallint | **NO** |  |

### `AttivitaLogs`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_attivita` | bigint | **NO** |  |
| `data_registrazione` | timestamp without time zone | **NO** |  |
| `tipo` | smallint | **NO** |  |
| `note` | text | si |  |

### `addestramento_excel`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `file_addestramento` | character varying | si |  |
| `titolo` | character varying | si |  |
| `data_caricamento` | timestamp without time zone | **NO** |  |
| `esportaSubito` | boolean | **NO** |  |
| `salvaSuDb` | boolean | **NO** |  |
| `externalCallPerImport` | text | si |  |
| `externalCallPerExport` | text | si |  |
| `externalCallPerExportPoP` | text | si |  |

### `addestramento_excel_relazioni`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `id_campo` | bigint | **NO** |  |
| `nome_relazione` | character varying | si |  |
| `algoritmo` | text | si |  |
| `tipo_compilazione` | smallint | **NO** | `1` |

### `articoli`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `codice` | character varying | **NO** |  |
| `descrizione1` | character varying | **NO** |  |
| `descrizione2` | character varying | **NO** |  |
| `descrizione3` | character varying | **NO** |  |
| `descrizione4` | character varying | **NO** |  |
| `peso` | numeric | si |  |
| `um` | character varying | si |  |
| `ultima_revisione` | timestamp without time zone | si |  |
| `stato_revisione` | smallint | **NO** |  |
| `nota_tecnica` | text | si |  |
| `reparto` | integer | si |  |
| `segmento` | character varying | si |  |
| `ean` | character varying | si |  |
| `data_inserimento` | timestamp without time zone | si |  |
| `data_modifica` | timestamp without time zone | si |  |

### `articoli_descrizioni`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_articolo` | bigint | si |  |
| `codice_gruppo` | text | si |  |
| `area` | character varying | si |  |
| `canale` | character varying | si |  |
| `custom` | character varying | si |  |
| `descrizione_1` | character varying | si |  |
| `descrizione_2` | character varying | si |  |
| `descrizione_3` | character varying | si |  |
| `descrizione_4` | character varying | si |  |
| `descrizione_indd` | character varying | si |  |
| `extra` | text | si |  |
| `peso` | numeric | si |  |
| `um` | text | si |  |
| `data_ultima_ricezione` | timestamp without time zone | **NO** |  |
| `approvata` | boolean | **NO** |  |
| `attiva` | boolean | **NO** |  |
| `firma_tracciato` | text | si |  |
| `meta` | text | si |  |

### `articoli_foto`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `id_articolo` | bigint | **NO** |  |
| `path_foto` | character varying | **NO** |  |
| `nome_reale` | character varying | **NO** |  |
| `guid_id` | character varying | **NO** |  |
| `data_inserimento` | timestamp without time zone | **NO** |  |
| `stato_selezione` | smallint | si | `1` |
| `attiva` | boolean | **NO** | `true` |
| `hash` | character varying | si |  |
| `data_modifica` | timestamp without time zone | si |  |
| `tipo` | smallint | si |  |
| `area` | character varying | si |  |
| `canale` | character varying | si |  |
| `puntatore` | boolean | **NO** | `false` |

### `foto_escluse`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `idArticolo` | bigint | **NO** |  |
| `nome_reale` | character varying | si |  |
| `data_inserimento` | timestamp without time zone | **NO** |  |
| `Filtro` | text | si |  |

### `menabo_pagine`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_tracciato` | integer | **NO** |  |
| `numero` | smallint | **NO** |  |
| `formato` | character varying | si |  |
| `id_mastro` | smallint | **NO** |  |

### `menabo_ref`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_record` | bigint | si |  |
| `codice_gruppo` | character varying | si |  |
| `id_pagina` | bigint | **NO** |  |
| `indice` | smallint | **NO** |  |
| `selezione` | smallint | **NO** |  |
| `formato` | character varying | si |  |
| `meccanica` | text | si |  |

### `promo`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `nome_promo` | character varying | si |  |
| `data_registrazione` | timestamp without time zone | **NO** |  |
| `validita_dal` | timestamp without time zone | si |  |
| `validita_al` | timestamp without time zone | si |  |
| `data_scadenza` | timestamp without time zone | si |  |
| `stato` | smallint | **NO** | `1` |
| `guidId` | character varying | si |  |
| `context` | text | si |  |

### `promo_importazioni`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `id_addestramento` | integer | **NO** |  |
| `id_promo` | integer | **NO** |  |
| `nome_file` | character varying | si |  |
| `tipo_materiale` | character varying | si |  |
| `data_caricamento` | timestamp without time zone | **NO** |  |
| `paramsRequest` | text | si |  |
| `guidId` | character varying | si |  |
| `id_attivita` | bigint | si |  |

### `promo_lavorazioni`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `guidId` | text | si |  |
| `guidPromo` | text | si |  |
| `guidCanale` | text | si |  |
| `guidArea` | text | si |  |
| `guidRaccoglitore` | text | si |  |
| `guidFormato` | text | si |  |
| `id_autore` | smallint | **NO** |  |
| `register_date` | timestamp without time zone | **NO** |  |
| `meta` | text | si |  |
| `stato` | smallint | **NO** |  |

### `promo_lavorazioni_records`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_lavorazione` | integer | **NO** |  |
| `id_record_tracciato` | bigint | **NO** |  |
| `codice` | text | si |  |
| `codice_gruppo` | character varying | si |  |
| `id_autore` | smallint | **NO** |  |
| `register_date` | timestamp without time zone | si |  |
| `indice` | smallint | **NO** |  |
| `pagina` | smallint | **NO** |  |
| `meta` | text | si |  |

### `promo_tracciati`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `id_importazione` | integer | **NO** |  |
| `id_promo` | integer | **NO** |  |
| `versione` | smallint | **NO** |  |
| `sigla` | character varying | si |  |
| `guidArea` | character varying | si |  |
| `guidCanale` | character varying | si |  |
| `guidPV` | character varying | si |  |
| `area` | text | si |  |
| `canale` | text | si |  |
| `ordine_lista` | text | si |  |
| `meta` | text | si |  |
| `context` | text | si |  |

### `promo_tracciati_records`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_tracciato` | integer | **NO** |  |
| `versione` | smallint | **NO** |  |
| `indice_lettura` | integer | **NO** |  |
| `indice_esportazione` | integer | **NO** | `'-1'::integer` |
| `label` | character varying | si |  |
| `scatto` | character varying | si |  |
| `codice` | character varying | si |  |
| `codice_gruppo` | character varying | si |  |
| `dato` | text | si |  |
| `da_esportare` | boolean | si |  |
| `id_addestramento` | integer | si |  |
| `data_registrazione` | timestamp without time zone | si |  |
| `modalita_inserimento` | smallint | **NO** |  |
| `stato` | smallint | **NO** |  |

### `registro_operazioni`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `tipo_operazione` | smallint | **NO** |  |
| `codice_associato` | character varying | si |  |
| `idTracciato` | integer | si |  |
| `idPromoLavorazione` | integer | si |  |
| `idPromoLavorazioniRecord` | bigint | si |  |
| `area` | character varying | si |  |
| `canale` | character varying | si |  |
| `url` | text | si |  |
| `formData` | text | si |  |
| `data_registrazione` | timestamp without time zone | **NO** |  |
| `data_esecuzione` | timestamp without time zone | si |  |
| `data_elaborazione_propagazioni` | timestamp without time zone | si |  |
| `stato` | smallint | **NO** |  |
| `autore` | integer | **NO** |  |
| `esecutore` | integer | si |  |

### `registro_propagazioni`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `idRegistro` | bigint | **NO** |  |
| `idPromoLavorazioneRecord` | bigint | **NO** |  |
| `data_registrazione` | timestamp without time zone | **NO** |  |
| `data_elaborazione` | timestamp without time zone | si |  |
| `autore_elaborazione` | smallint | si |  |
| `priorita` | smallint | **NO** |  |
| `stato` | smallint | **NO** |  |

### `schema_campi_excel`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_addestramento` | integer | **NO** |  |
| `nome_colonna_originale` | character varying | si |  |
| `indice` | smallint | **NO** |  |
| `nome_colonna` | character varying | si |  |
| `nome_visualizzato` | character varying | si |  |
| `note` | character varying | si |  |
| `tipo_dato` | smallint | si |  |
| `ruolo` | character varying | si |  |
| `ordinamento` | smallint | si | `0` |

### `schema_campi_excel_relazioni`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_relazione` | integer | **NO** |  |
| `id_campo` | bigint | **NO** |  |
| `condizione` | character varying | si |  |

### `schema_custom`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | smallint | **NO** |  |
| `titolo` | character varying | si |  |
| `data_registrazione` | timestamp without time zone | **NO** |  |

### `schema_custom_records`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | bigint | **NO** |  |
| `id_schema` | smallint | **NO** |  |
| `dato` | text | si |  |

### `settings`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `codice` | character varying | si |  |
| `valore` | text | si |  |

### `utenti`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | smallint | **NO** |  |
| `nomeUtente` | character varying | si |  |
| `nome` | character varying | si |  |
| `cognome` | character varying | si |  |
| `email` | character varying | si |  |
| `password` | character varying | si |  |
| `stato` | smallint | **NO** |  |
| `ruolo` | smallint | **NO** |  |
| `data_registrazione` | timestamp without time zone | **NO** |  |
| `data_update` | timestamp without time zone | si |  |
| `privateKey` | character varying | si |  |
| `ad_token` | text | si |  |
| `scadenza_token_ad` | timestamp without time zone | si |  |
| `policyGroups` | text | si |  |

### `utenti_fico`

| colonna | tipo | null | default |
|---|---|---|---|
| `id` | integer | **NO** |  |
| `id_utente` | smallint | si |  |
| `token` | character varying | si |  |
| `origin` | character varying | si |  |
| `username` | character varying | si |  |
| `tipo_utente` | smallint | **NO** |  |
| `user_data` | text | si |  |
| `last_access` | timestamp without time zone | **NO** |  |

---

## Chiavi primarie e chiavi esterne

| tabella | vincolo | colonna | riferisce |
|---|---|---|---|
| `Attivita` | FOREIGN KEY | `id_parent` | `Attivita.id` |
| `Attivita` | PRIMARY KEY | `id` | `Attivita.id` |
| `AttivitaLogs` | FOREIGN KEY | `id_attivita` | `Attivita.id` |
| `AttivitaLogs` | PRIMARY KEY | `id` | `AttivitaLogs.id` |
| `addestramento_excel` | PRIMARY KEY | `id` | `addestramento_excel.id` |
| `addestramento_excel_relazioni` | FOREIGN KEY | `id_campo` | `schema_campi_excel.id` |
| `addestramento_excel_relazioni` | PRIMARY KEY | `id` | `addestramento_excel_relazioni.id` |
| `articoli` | PRIMARY KEY | `id` | `articoli.id` |
| `articoli_descrizioni` | FOREIGN KEY | `id_articolo` | `articoli.id` |
| `articoli_descrizioni` | PRIMARY KEY | `id` | `articoli_descrizioni.id` |
| `articoli_foto` | FOREIGN KEY | `id_articolo` | `articoli.id` |
| `articoli_foto` | PRIMARY KEY | `id` | `articoli_foto.id` |
| `foto_escluse` | FOREIGN KEY | `idArticolo` | `articoli.id` |
| `foto_escluse` | PRIMARY KEY | `id` | `foto_escluse.id` |
| `menabo_pagine` | FOREIGN KEY | `id_tracciato` | `promo_tracciati.id` |
| `menabo_pagine` | PRIMARY KEY | `id` | `menabo_pagine.id` |
| `menabo_ref` | FOREIGN KEY | `id_pagina` | `menabo_pagine.id` |
| `menabo_ref` | FOREIGN KEY | `id_record` | `promo_tracciati_records.id` |
| `menabo_ref` | PRIMARY KEY | `id` | `menabo_ref.id` |
| `promo` | PRIMARY KEY | `id` | `promo.id` |
| `promo_importazioni` | FOREIGN KEY | `id_attivita` | `Attivita.id` |
| `promo_importazioni` | FOREIGN KEY | `id_addestramento` | `addestramento_excel.id` |
| `promo_importazioni` | FOREIGN KEY | `id_promo` | `promo.id` |
| `promo_importazioni` | PRIMARY KEY | `id` | `promo_importazioni.id` |
| `promo_lavorazioni` | PRIMARY KEY | `id` | `promo_lavorazioni.id` |
| `promo_lavorazioni_records` | FOREIGN KEY | `id_lavorazione` | `promo_lavorazioni.id` |
| `promo_lavorazioni_records` | FOREIGN KEY | `id_record_tracciato` | `promo_tracciati_records.id` |
| `promo_lavorazioni_records` | PRIMARY KEY | `id` | `promo_lavorazioni_records.id` |
| `promo_tracciati` | FOREIGN KEY | `id_promo` | `promo.id` |
| `promo_tracciati` | FOREIGN KEY | `id_importazione` | `promo_importazioni.id` |
| `promo_tracciati` | PRIMARY KEY | `id` | `promo_tracciati.id` |
| `promo_tracciati_records` | FOREIGN KEY | `id_addestramento` | `addestramento_excel.id` |
| `promo_tracciati_records` | FOREIGN KEY | `id_tracciato` | `promo_tracciati.id` |
| `promo_tracciati_records` | PRIMARY KEY | `id` | `promo_tracciati_records.id` |
| `registro_operazioni` | PRIMARY KEY | `id` | `registro_operazioni.id` |
| `registro_propagazioni` | FOREIGN KEY | `autore_elaborazione` | `utenti.id` |
| `registro_propagazioni` | FOREIGN KEY | `idRegistro` | `registro_operazioni.id` |
| `registro_propagazioni` | PRIMARY KEY | `id` | `registro_propagazioni.id` |
| `schema_campi_excel` | FOREIGN KEY | `id_addestramento` | `addestramento_excel.id` |
| `schema_campi_excel` | PRIMARY KEY | `id` | `schema_campi_excel.id` |
| `schema_campi_excel_relazioni` | FOREIGN KEY | `id_campo` | `schema_campi_excel.id` |
| `schema_campi_excel_relazioni` | FOREIGN KEY | `id_relazione` | `addestramento_excel_relazioni.id` |
| `schema_campi_excel_relazioni` | PRIMARY KEY | `id` | `schema_campi_excel_relazioni.id` |
| `schema_custom` | PRIMARY KEY | `id` | `schema_custom.id` |
| `schema_custom_records` | FOREIGN KEY | `id_schema` | `schema_custom.id` |
| `schema_custom_records` | PRIMARY KEY | `id` | `schema_custom_records.id` |
| `settings` | PRIMARY KEY | `id` | `settings.id` |
| `utenti` | PRIMARY KEY | `id` | `utenti.id` |
| `utenti_fico` | FOREIGN KEY | `id_utente` | `utenti.id` |
| `utenti_fico` | PRIMARY KEY | `id` | `utenti_fico.id` |

---

## Indici

| tabella | indice | definizione |
|---|---|---|
| `Attivita` | `IX_Attivita_id_parent` | `CREATE INDEX "IX_Attivita_id_parent" ON public."Attivita" USING btree (id_parent)` |
| `Attivita` | `PK_Attivita` | `CREATE UNIQUE INDEX "PK_Attivita" ON public."Attivita" USING btree (id)` |
| `Attivita` | `ix_attivita_coda` | `CREATE INDEX ix_attivita_coda ON public."Attivita" USING btree (stato, data_inserimento)` |
| `AttivitaLogs` | `IX_AttivitaLogs_id_attivita` | `CREATE INDEX "IX_AttivitaLogs_id_attivita" ON public."AttivitaLogs" USING btree (id_attivita)` |
| `AttivitaLogs` | `PK_AttivitaLogs` | `CREATE UNIQUE INDEX "PK_AttivitaLogs" ON public."AttivitaLogs" USING btree (id)` |
| `addestramento_excel` | `PK_addestramento_excel` | `CREATE UNIQUE INDEX "PK_addestramento_excel" ON public.addestramento_excel USING btree (id)` |
| `addestramento_excel_relazioni` | `IX_addestramento_excel_relazioni_id_campo` | `CREATE INDEX "IX_addestramento_excel_relazioni_id_campo" ON public.addestramento_excel_relazioni USING btree (id_campo)` |
| `addestramento_excel_relazioni` | `PK_addestramento_excel_relazioni` | `CREATE UNIQUE INDEX "PK_addestramento_excel_relazioni" ON public.addestramento_excel_relazioni USING btree (id)` |
| `articoli` | `PK_articoli` | `CREATE UNIQUE INDEX "PK_articoli" ON public.articoli USING btree (id)` |
| `articoli` | `ix_articoli_codice` | `CREATE INDEX ix_articoli_codice ON public.articoli USING btree (codice)` |
| `articoli` | `ix_articoli_codice_trgm` | `CREATE INDEX ix_articoli_codice_trgm ON public.articoli USING gin (codice gin_trgm_ops)` |
| `articoli` | `ix_articoli_ean` | `CREATE INDEX ix_articoli_ean ON public.articoli USING btree (ean)` |
| `articoli` | `ix_articoli_recenti` | `CREATE INDEX ix_articoli_recenti ON public.articoli USING btree (COALESCE(data_modifica, data_inserimento) DESC)` |
| `articoli_descrizioni` | `IX_articoli_descrizioni_id_articolo` | `CREATE INDEX "IX_articoli_descrizioni_id_articolo" ON public.articoli_descrizioni USING btree (id_articolo)` |
| `articoli_descrizioni` | `PK_articoli_descrizioni` | `CREATE UNIQUE INDEX "PK_articoli_descrizioni" ON public.articoli_descrizioni USING btree (id)` |
| `articoli_descrizioni` | `ix_ad_base` | `CREATE INDEX ix_ad_base ON public.articoli_descrizioni USING btree (id_articolo, descrizione_1) WHERE ((area IS NULL) AN` |
| `articoli_descrizioni` | `ix_ad_desc1_trgm` | `CREATE INDEX ix_ad_desc1_trgm ON public.articoli_descrizioni USING gin (descrizione_1 gin_trgm_ops)` |
| `articoli_descrizioni` | `ix_ad_desc2_trgm` | `CREATE INDEX ix_ad_desc2_trgm ON public.articoli_descrizioni USING gin (descrizione_2 gin_trgm_ops)` |
| `articoli_descrizioni` | `ix_ad_desc3_trgm` | `CREATE INDEX ix_ad_desc3_trgm ON public.articoli_descrizioni USING gin (descrizione_3 gin_trgm_ops)` |
| `articoli_descrizioni` | `ix_ad_desc4_trgm` | `CREATE INDEX ix_ad_desc4_trgm ON public.articoli_descrizioni USING gin (descrizione_4 gin_trgm_ops)` |
| `articoli_descrizioni` | `ix_ad_ordine` | `CREATE INDEX ix_ad_ordine ON public.articoli_descrizioni USING btree (descrizione_1, id_articolo) WHERE ((area IS NULL) ` |
| `articoli_foto` | `IX_articoli_foto_id_articolo` | `CREATE INDEX "IX_articoli_foto_id_articolo" ON public.articoli_foto USING btree (id_articolo)` |
| `articoli_foto` | `PK_articoli_foto` | `CREATE UNIQUE INDEX "PK_articoli_foto" ON public.articoli_foto USING btree (id)` |
| `foto_escluse` | `IX_foto_escluse_idArticolo` | `CREATE INDEX "IX_foto_escluse_idArticolo" ON public.foto_escluse USING btree ("idArticolo")` |
| `foto_escluse` | `PK_foto_escluse` | `CREATE UNIQUE INDEX "PK_foto_escluse" ON public.foto_escluse USING btree (id)` |
| `menabo_pagine` | `IX_menabo_pagine_id_tracciato` | `CREATE INDEX "IX_menabo_pagine_id_tracciato" ON public.menabo_pagine USING btree (id_tracciato)` |
| `menabo_pagine` | `PK_menabo_pagine` | `CREATE UNIQUE INDEX "PK_menabo_pagine" ON public.menabo_pagine USING btree (id)` |
| `menabo_ref` | `IX_menabo_ref_id_pagina` | `CREATE INDEX "IX_menabo_ref_id_pagina" ON public.menabo_ref USING btree (id_pagina)` |
| `menabo_ref` | `IX_menabo_ref_id_record` | `CREATE INDEX "IX_menabo_ref_id_record" ON public.menabo_ref USING btree (id_record)` |
| `menabo_ref` | `PK_menabo_ref` | `CREATE UNIQUE INDEX "PK_menabo_ref" ON public.menabo_ref USING btree (id)` |
| `promo` | `PK_promo` | `CREATE UNIQUE INDEX "PK_promo" ON public.promo USING btree (id)` |
| `promo_importazioni` | `IX_promo_importazioni_id_addestramento` | `CREATE INDEX "IX_promo_importazioni_id_addestramento" ON public.promo_importazioni USING btree (id_addestramento)` |
| `promo_importazioni` | `IX_promo_importazioni_id_attivita` | `CREATE INDEX "IX_promo_importazioni_id_attivita" ON public.promo_importazioni USING btree (id_attivita)` |
| `promo_importazioni` | `IX_promo_importazioni_id_promo` | `CREATE INDEX "IX_promo_importazioni_id_promo" ON public.promo_importazioni USING btree (id_promo)` |
| `promo_importazioni` | `PK_promo_importazioni` | `CREATE UNIQUE INDEX "PK_promo_importazioni" ON public.promo_importazioni USING btree (id)` |
| `promo_lavorazioni` | `PK_promo_lavorazioni` | `CREATE UNIQUE INDEX "PK_promo_lavorazioni" ON public.promo_lavorazioni USING btree (id)` |
| `promo_lavorazioni_records` | `IX_promo_lavorazioni_records_id_lavorazione` | `CREATE INDEX "IX_promo_lavorazioni_records_id_lavorazione" ON public.promo_lavorazioni_records USING btree (id_lavorazio` |
| `promo_lavorazioni_records` | `IX_promo_lavorazioni_records_id_record_tracciato` | `CREATE INDEX "IX_promo_lavorazioni_records_id_record_tracciato" ON public.promo_lavorazioni_records USING btree (id_reco` |
| `promo_lavorazioni_records` | `PK_promo_lavorazioni_records` | `CREATE UNIQUE INDEX "PK_promo_lavorazioni_records" ON public.promo_lavorazioni_records USING btree (id)` |
| `promo_tracciati` | `IX_promo_tracciati_id_importazione` | `CREATE INDEX "IX_promo_tracciati_id_importazione" ON public.promo_tracciati USING btree (id_importazione)` |
| `promo_tracciati` | `IX_promo_tracciati_id_promo` | `CREATE INDEX "IX_promo_tracciati_id_promo" ON public.promo_tracciati USING btree (id_promo)` |
| `promo_tracciati` | `PK_promo_tracciati` | `CREATE UNIQUE INDEX "PK_promo_tracciati" ON public.promo_tracciati USING btree (id)` |
| `promo_tracciati_records` | `IX_promo_tracciati_records_id_addestramento` | `CREATE INDEX "IX_promo_tracciati_records_id_addestramento" ON public.promo_tracciati_records USING btree (id_addestramen` |
| `promo_tracciati_records` | `IX_promo_tracciati_records_id_tracciato` | `CREATE INDEX "IX_promo_tracciati_records_id_tracciato" ON public.promo_tracciati_records USING btree (id_tracciato)` |
| `promo_tracciati_records` | `PK_promo_tracciati_records` | `CREATE UNIQUE INDEX "PK_promo_tracciati_records" ON public.promo_tracciati_records USING btree (id)` |
| `registro_operazioni` | `PK_registro_operazioni` | `CREATE UNIQUE INDEX "PK_registro_operazioni" ON public.registro_operazioni USING btree (id)` |
| `registro_propagazioni` | `IX_registro_propagazioni_autore_elaborazione` | `CREATE INDEX "IX_registro_propagazioni_autore_elaborazione" ON public.registro_propagazioni USING btree (autore_elaboraz` |
| `registro_propagazioni` | `IX_registro_propagazioni_idRegistro` | `CREATE INDEX "IX_registro_propagazioni_idRegistro" ON public.registro_propagazioni USING btree ("idRegistro")` |
| `registro_propagazioni` | `PK_registro_propagazioni` | `CREATE UNIQUE INDEX "PK_registro_propagazioni" ON public.registro_propagazioni USING btree (id)` |
| `schema_campi_excel` | `IX_schema_campi_excel_id_addestramento` | `CREATE INDEX "IX_schema_campi_excel_id_addestramento" ON public.schema_campi_excel USING btree (id_addestramento)` |
| `schema_campi_excel` | `PK_schema_campi_excel` | `CREATE UNIQUE INDEX "PK_schema_campi_excel" ON public.schema_campi_excel USING btree (id)` |
| `schema_campi_excel_relazioni` | `IX_schema_campi_excel_relazioni_id_campo` | `CREATE INDEX "IX_schema_campi_excel_relazioni_id_campo" ON public.schema_campi_excel_relazioni USING btree (id_campo)` |
| `schema_campi_excel_relazioni` | `IX_schema_campi_excel_relazioni_id_relazione` | `CREATE INDEX "IX_schema_campi_excel_relazioni_id_relazione" ON public.schema_campi_excel_relazioni USING btree (id_relaz` |
| `schema_campi_excel_relazioni` | `PK_schema_campi_excel_relazioni` | `CREATE UNIQUE INDEX "PK_schema_campi_excel_relazioni" ON public.schema_campi_excel_relazioni USING btree (id)` |
| `schema_custom` | `PK_schema_custom` | `CREATE UNIQUE INDEX "PK_schema_custom" ON public.schema_custom USING btree (id)` |
| `schema_custom_records` | `IX_schema_custom_records_id_schema` | `CREATE INDEX "IX_schema_custom_records_id_schema" ON public.schema_custom_records USING btree (id_schema)` |
| `schema_custom_records` | `PK_schema_custom_records` | `CREATE UNIQUE INDEX "PK_schema_custom_records" ON public.schema_custom_records USING btree (id)` |
| `settings` | `PK_settings` | `CREATE UNIQUE INDEX "PK_settings" ON public.settings USING btree (id)` |
| `utenti` | `PK_utenti` | `CREATE UNIQUE INDEX "PK_utenti" ON public.utenti USING btree (id)` |
| `utenti_fico` | `IX_utenti_fico_id_utente` | `CREATE INDEX "IX_utenti_fico_id_utente" ON public.utenti_fico USING btree (id_utente)` |
| `utenti_fico` | `PK_utenti_fico` | `CREATE UNIQUE INDEX "PK_utenti_fico" ON public.utenti_fico USING btree (id)` |
