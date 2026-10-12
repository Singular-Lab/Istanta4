# Coop: la configurazione del repo allineata a quella di produzione

Il 12 ottobre 2026 (issue **I20-1086**) i tre json di Coop in
`Istanta/wwwroot/external_source/Coopfi/` sono stati confrontati con quelli che girano in
produzione, e allineati. Il repo è nato il 10 settembre 2026 con una copia della configurazione già
diversa da quella del server: in produzione le regole erano state cambiate dalla pagina Etichette e
dall'editor del FrameworkCss, e quelle modifiche non erano mai arrivate in git.

Il difetto che l'ha fatto emergere: in locale due ref uscivano con un box diverso da quello di
produzione.

- La ref **1121207**, forzata a linea con il cambio strutturale "Forza meccanica LINEA"
  (`is_linea = "xForced"`), usciva **BOX_STD** invece di BOX_LINEA. Il repo dava l'etichetta
  IS_LINEA solo a `is_linea == "x"`.
- La ref **4860195**, tema "PIU VALORE SOCI (OS20B)…", usciva **BOX_STD** senza bruciature invece
  di BOX_doppio_SCONTO. Il repo dava DOPPIOSCONTO solo ai temi con "NEW CLIENTI" o "NEW SOCI".

## Da dove vengono i file

I file di produzione li ha estratti Marco Trentacosti il 12/10/2026, e sono allegati alla issue
I20-1086:

| file | allegato | cosa |
|---|---|---|
| `SourceEtichetteRef.json` | `EtichetteCoop.txt` (20927) | le regole delle etichette |
| `SourceCustomPlugin.json` | `NiceLeg … 16_06_13 ….txt` (20926) | il plugin agenzia |
| `SourceFrameworkCss.json` | `NiceLeg … 16_20_02 ….txt` (20924) | il framework CSS |

Il formato del repo non cambia: json su una riga, senza BOM, CRLF in fondo.

## Cosa è stato deciso, file per file

### `SourceEtichetteRef.json`: come in produzione, più un caso

| Id | etichetta | regola adesso | prima nel repo |
|---|---|---|---|
| 4 | DOPPIOSCONTO | il tema contiene `VALORE CLIENTI`, oppure `VALORE SOCI`, oppure `NEW SOCI` | `NEW CLIENTI` oppure `NEW SOCI` |
| 5 | IS_LINEA | `is_linea == "x"` oppure `is_linea == "xForced"` | solo `x` |
| 7 | ESCLUSIVA_SOCI | il tema contiene `PROMO SOCI ESCL` oppure `SOCI ESCLUSIVA` | solo `soci esclusiva` |
| 9 | JOLLY_EVIDENZA | il tema contiene `VENDITE PROPOSIT`; Visual null | `VENDITE PROPOSITIVE`; Visual "" |

`IN` ignora maiuscole e minuscole e cerca il testo dentro il campo: i valori più corti di
produzione prendono anche i temi troncati del tracciato.

**NEW SOCI è il caso in più.** Il cambio strutturale 12 "Cambia meccanica in DoppioSconto"
imposta il tema a `NEW SOCI`. Con la sola regola di produzione quel tema non darebbe più il doppio
sconto, quindi il caso è stato aggiunto qui e, lo stesso giorno, anche in produzione dalla pagina
Etichette. Le etichette 1, 2, 3, 6 e 8 erano già uguali.

### `SourceCustomPlugin.json`: le voci di produzione, le aggiunte locali restano

Entrate da produzione:

- `infoRapide`: Prezzo Promo, Prezzo Promo kgl, Prezzo Continuo, Sconto, Prestazione;
- `policyImpaginazioneMechanism`: la voce per `tipo_utente: 0`;
- `etichetteCommands`, primo comando (PIU_PREZZI_PROMO): l'etichetta si dà solo se il box non è
  BOX_doppio_SCONTO_LINEA, BOX_JOLLY o BOX_SPRINT;
- `schemiDescrizioni`: lo schema linea con `MAX_PEZZI` in coda. È stato messo subito prima dello
  schema linea senza MAX_PEZZI, come in produzione, così una linea con le bruciature trova prima il
  suo;
- `listaCampiEditabiliPrioritari: ["tema"]`;
- `campiExtraEditPrimarieSecondarie`: Prezzo promo (`prezzo_promo`), Peso (`Descrizioni.Peso`).

Restano le aggiunte del repo, che produzione non ha:

- `chiediAmbitoDecisioniLavorazione: true`;
- `disattivazioneRefRules: []`, il nome nuovo di `editSchedaRefRules`, che produzione ha ancora e
  il server converte da sé: vuote tutte e due, si equivalgono;
- lo schema linea con `DESCRIZIONE_PREZZO_LINEAP` in coda.

I 27 cambi strutturali erano già uguali.

### `SourceFrameworkCss.json`: copia fedele di produzione

Il file è identico a quello di produzione. Le definizioni dei box (`livelli`) e `defaultBox`
erano già uguali: cambia solo `dbRidimensionamentiAllineamenti`. Qui sotto c'è tutto quello che
la copia fedele ha tolto o sostituito, con i valori che il repo aveva.

## Cosa è stato tolto dal framework CSS del repo

### Come si recupera

Il file com'era sta nel commit da cui è partito il task:

```bash
git show 0666a74:Istanta/wwwroot/external_source/Coopfi/SourceFrameworkCss.json > css-repo.json
```

I kit sono distinti dal loro filtro (`kit`): tipo di lavorazione 1 è il volantino, 2 il POP. Il
kit con `areeValide: []` vale per tutte le aree. Dentro ogni kit, i box si trovano per `nomiBox`
(vuoto = tutti i box) e i gruppi per `nomeGruppo`.

Non sono differenze, e non sono elencate: `ordine` al valore di default 999999,
`evitaTracciaAllineamento` al default (false, true, 0), `0` scritto `0.0`.

### Kit volantino, tutte le aree

**Le misure dei loghi** (`postRidimensionamenti` di tutti i box). Il repo le dava a gruppi:

| gruppo del repo | loghi | misura | fit |
|---|---|---|---|
| `loghi` | 42 loghi | 21 × 21 | 2 |
| `logo_toscana1` | logo_toscana1 | 16 × 20 | 2 |
| `Logo_BancodelGusto` | Logo_BancodelGusto | 22.184 × 10.342 | 1 |
| `Logo_Cerealia` | Logo_Cerealia | 21.714 × 15.12 | 2 |
| `Logo_OrigineItalia` | Logo_OrigineItalia, Origine_Italia-logo.psd | 24.748 × 7.054 | 2 |
| `Logo_FiorFiore` | Logo_FiorFiore, fiorfiore.psd | 29.201 × 10.5 | 3 |

Produzione dà una misura a ogni logo, in 40 gruppi chiamati `loghi_<larghezza>x<altezza>`
(per esempio AIS 30.175 × 12.778, FiorFiore 23.1 × 23.1 fit 2, Cerealia 20.025 × 20.025,
BancodelGusto 22.184 × 10.342 fit 2, OrigineItalia 22.85 × 6). Solo 13 loghi restano nel gruppo
`loghi` a 21 × 21, toscana1 compreso: 41 gruppi in tutto.

**L'allineamento `Loghi`.**

| | repo | produzione |
|---|---|---|
| ordine | default (999999) | 9999999, dopo tutti gli altri |
| spaziatura fra livelli | 0 | 4.8 |
| segue `base*` in x | −2, sul blocco | −2, sui singoli livelli |
| segue `descrizione` in y | 0 | 2.439 |
| ordine dei livelli | antibioticfree, svezzamento, dop, igp, … | bollo_oltre20mesi, advance, AIS, … |

**Loghi usciti dagli elenchi** di questo kit (produzione non li ha qui): Bollino_Bresaolazero-GioPorro,
Bollino_Senza Antibiotici_uova, Logo Vivi Verde Bio.ai, logo_piuScelta. Nel kit POP ci sono ancora.

**Entrati da produzione**, per completezza: undici loghi (Chiringuito, COOP_STELLLINE_x_VINI_ASSIEME,
daytech, dosa, Fru_Swing_Nero, Officina_dei_fiori, Phiaba, revision_cosmecos_18aprile23,
GLI_SPESOTTI, origine_outline_blu_Punti_Tracciabilita, SQ_logo_trac_bianco) e un box
`BOX_SuperprezziOF` con il suo allineamento dei loghi.

### Kit volantino, aree B e B1

- **Il blocco dei loghi**, per tutti i box. Il repo aveva i sei `postRidimensionamenti` della
  tabella sopra, con BancodelGusto qui a 25.234 × 13 fit 2, e un suo allineamento `Loghi` uguale a
  quello del kit di tutte le aree. In produzione questo kit non ha loghi: li gestisce solo il kit
  di tutte le aree.
- **`fix_alKg`**: nel repo `prezzo_info_pack` segue `prezzo_promo` a x −3.2. In produzione è
  `prezzo_info_pack*` che segue `prezzo_promo*` a x −1.28.
- **BOX_SPRINT**: l'allineamento `Loghi`, uguale a quello del kit di tutte le aree.
- **Doppio sconto** (BOX_doppio_SCONTO, BOX_doppio_SCONTO_LINEA). Nel repo i prezzi seguivano la
  descrizione; in produzione la descrizione segue i prezzi.

  | gruppo | repo | produzione |
  |---|---|---|
  | PrezziNonSoci | segue `descrizione` a y −2 | ancora fissa a y 2 |
  | PrezziSoci | segue PrezziNonSoci a x −4 (singoli livelli) e `descrizione` a y −2 | ancora fissa a y 2, segue PrezziNonSoci a x −4 (singoli livelli) |
  | Campi_Principali | ancora fissa a x 1.37, y 1.37 | ancora a y 1.37, segue PrezziSoci a x −13 |
  | fix_SOCI_DOPPIA | `prezzo_info_pack_SOCI_DOPPIA` segue `prezzo_promo_SOCI_DOPPIA` a x −3.4 | non c'è |
  | ScontiSoci | ancora a x 8.26, segue ScontiNonSoci a y 13.25, fit 1 su `carta` | non c'è |

  ScontiNonSoci era già uguale (segue PrezziNonSoci a y −2.5).

### Kit volantino, area A

- **`fix_alKg`**: nel repo `prezzo_info_pack` segue `prezzo_promo` a x −3.2. In produzione è
  `prezzo_info_pack*` che segue `prezzo_promo*` a x −0.78.
- **BOX_SPRINT**: l'allineamento `Loghi`.
- **Doppio sconto**: ScontiNonSoci seguiva PrezziNonSoci a y −2.5 (produzione −0.6). ScontiSoci
  aveva l'ancora fissa a x 8.26 e seguiva ScontiNonSoci a y 13.25; in produzione non ha ancora e
  segue a y 23.5. Il resto del box era già uguale.
- **BOX_SuperprezziOF**, che produzione non ha in questo kit: ridimensionava `descrizione` (1, 2)
  e `gruppo_prezzo` (–, 2), con un allineamento Campi_Principali (descrizione, gruppo_prezzo,
  spaziatura 0.7).

### Kit volantino, area A-

- **BOX_STD, allineamento `STD`**: nel repo l'ancora era a y 2.483 e c'era un fit finale. In
  produzione l'ancora è a y 0 e non c'è fit.
- **BOX_SPRINT**: l'allineamento `Loghi`.
- **Doppio sconto**: lo stesso schema di B e B1, cioè PrezziNonSoci e PrezziSoci che seguivano la
  descrizione, Campi_Principali con ancora fissa x 1.37 y 1.37, `fix_SOCI_DOPPIA` e `ScontiSoci`.
  In più il repo ridimensionava `descrizione` (1, 2).

### Kit POP

Niente di tolto. Da produzione sono entrati gli undici loghi del volantino (senza Fru_Swing_Nero,
con BOLLO_Senza_Antibiotici_con_uova_da_galline_allevate_a_terra) negli elenchi dei loghi del kit e
del doppio sconto, e l'ordine 9999999 dell'allineamento `Loghi`.

## Cosa resta da sapere

- **I file del repo valgono per gli ambienti montati dal repo.** La produzione legge i suoi dalla
  cartella `external_source` del server, che questo allineamento non tocca.
- **Le due copie possono divergere di nuovo.** La pagina Etichette e l'editor del FrameworkCss
  scrivono nella cartella dell'istanza su cui si lavora. Una modifica fatta in produzione va
  riportata nel repo, e viceversa.
- **La scelta della primaria in AgenziaLib** ([Coopfi.cs](../../AgenziaLib/Coopfi.cs), riga 132)
  considera linea solo `is_linea == "x"`, non `xForced`. È fuori da questo allineamento.
