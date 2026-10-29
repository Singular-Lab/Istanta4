# Policy CoopFI dal codice posizione (policy v2)

## Obiettivo e perimetro

Per gli utenti CoopFI, `buildCoopfiPolicyFromCodeV2` trasforma un `codicePosizione` (es. `ALD_OFCAPETDM`) in:
- un albero `tree` compatibile con Olympus (`OlympusUserPolicyRuolo[]`);
- i codici letti: `roleCode`, `areaCode`, `repartoCodes`;
- la lista `finalSettori`, i settori finali dei reparti;
- un errore tipizzato (`error`) quando il codice non si può leggere affatto.

Non esiste un motore generico guidato da regole JSON: l'algoritmo è scritto per CoopFI e usa solo il
catalogo dell'organigramma. La cartella `policy-v2` contiene soltanto i tipi (`types.ts`).

## File coinvolti

### Tipi
- `server/core/agenzia_lib/policy-v2/types.ts`: `AgenziaPolicyCatalog`, `PolicyBuildResultV2`, `PolicyBuildError` e i codici di errore

`types.ts` contiene anche i tipi di un formato di regole (`AgenziaPolicyRules`, `PolicyTreeStrategy`,
`PolicyBuildConfigV2`) che nessun codice usa.

### CoopFI
- `server/core/agenzia_lib/coopfi/utility/data/coopfi-organigramma.json`: catalogo (ruoli, aree, settori, settori finali)
- `server/core/agenzia_lib/coopfi/utility/coopfi-json-catalog.ts`: carica il catalogo e ne verifica la forma minima
- `server/core/agenzia_lib/coopfi/utility/coopfi-policy-v2.ts`: `buildCoopfiPolicyFromCodeV2`
- `server/core/agenzia_lib/coopfi/utility/coopfi-settore-finale-map.ts`: nomi dei reparti per i settori finali (`resolveRepartoNamesForSettoriFinali`)

### Integrazione runtime
- `server/core/agenzia_lib/coopfi/index.ts` (`CoopfiAgenziaLib`)
- `server/core/controllers/HubController.ts` (callback OIDC)
- `server/core/controllers/ScoreboardController.ts` e `server/core/controllers/UserController.ts` (filtri globali)

### Test
- `server/core/agenzia_lib/coopfi/__tests__/coopfi-policy-v2.test.ts`
- `server/core/agenzia_lib/coopfi/__tests__/coopfi-policy-data-integrity.test.ts`

## Flusso runtime end-to-end

1. `HubController.oidcCallback(...)` autentica l'utente OIDC e chiama `agenziaLib.parseUtenteOIDC(email, claims, ...)`.
2. In CoopFI, `CoopfiAgenziaLib.parseUtenteOIDC(...)` recupera il censito AD/API e salva il suo
   `codicePosizione` nel meta dell'utente (`codice_posizione`).
3. Alla creazione del passaporto Olympus, `initOlympusPassport(...)` invia a `/auth/getPassport`
   `codice_posizione` e `ruoli`:
   - `ruoli = []` se l'utente è nei gruppi AD `GA1040_Marketing` o `GA1040_Admin`, che vedono tutto;
   - altrimenti `ruoli = getRuoliPolicyFromUtenteCoop(codice_posizione)`, cioè il `tree` della policy
     (o `[]` se il codice manca o la policy fallisce, con un warning nel log).
4. Per gli utenti di tipo `CATEGORY`, `getGlobalFiltersForUser(...)` usa la policy per restringere i dati
   (Scoreboard e `UserController`): `settoriFinali` da `finalSettori`, `settori` da `repartoCodes`,
   `settoriNomi`, `aree` da `areaCode`, `ruolo` da `roleCode`, con `isRestricted: true`. Se la policy
   fallisce restituisce `isRestricted: true` con liste vuote (fail-closed). Per gli altri tipi
   `isRestricted` è `false`.

Il vecchio `getFiltriFromUtenteCoop` (filtri `reparto equals <settore finale>`) è commentato in
`coopfi/index.ts` e non viene chiamato.

## Contratto

### Input
```ts
buildCoopfiPolicyFromCodeV2(codicePosizione: string | null | undefined): PolicyBuildResultV2
```

### Output success
```ts
{
  ok: true;
  tree: OlympusUserPolicyRuolo[];   // un solo nodo radice, il ruolo
  roleCode: string;
  areaCode: string | null;
  repartoCodes: string[];
  finalSettori: string[];
  error: null;
}
```

### Output failure
```ts
{
  ok: false;
  tree: [];
  roleCode: null;
  areaCode: null;
  repartoCodes: [];
  finalSettori: [];
  error: {
    code: PolicyBuildErrorCode;
    step: PolicyBuildStep;
    message: string;
    input: string;
  };
}
```

Oggi la funzione produce solo due errori:

| Caso | `code` | `step` |
| --- | --- | --- |
| `codicePosizione` vuoto, `null` o `undefined` | `INVALID_INPUT` | `normalize` |
| Ruolo non presente in `catalog.ruoli` | `ROLE_NOT_FOUND` | `role` |

Gli altri codici di `PolicyBuildErrorCode` (`INVALID_RULES`, `INVALID_INPUT_FORMAT`, `AREA_NOT_FOUND`,
`REPARTO_SEGMENTATION_FAILED`, `AMBIGUOUS_SEGMENTATION`, `CATALOG_INCONSISTENT`) esistono nei tipi ma
non vengono mai restituiti.

## Schema catalogo (`AgenziaPolicyCatalog`)

```json
{
  "version": 1,
  "source": "coopfi-agenzia-lib",
  "generatedAt": "2026-03-30T10:21:49.738Z",
  "ruoli": [{ "code": "ALD", "description": "...", "codificaFico": "ALD" }],
  "aree": [{ "code": "TDM", "description": "...", "codificaFico": "TDM" }],
  "settoriFinali": [{ "code": "ortofrutta", "description": "...", "codificaFico": "ortofrutta" }],
  "settori": [{ "code": "OF", "description": "...", "codificaFico": "OF", "settoriFinali": ["ortofrutta"] }]
}
```

Regole pratiche:
- `codificaFico` è il valore che finisce in `codificaFICO` nei nodi dell'albero: deve essere presente su
  ruoli, aree e settori.
- `settori[].settoriFinali[]` sono i codici dei settori finali di quel reparto; la funzione li copia in
  `finalSettori` senza verificare che esistano in `settoriFinali`.
- `coopfi-json-catalog.ts` controlla solo che `ruoli`, `aree` e `settori` siano array.

## Algoritmo

### 1) Input
- Se `codicePosizione` è vuoto: errore `INVALID_INPUT`.
- Il codice si divide sul carattere `_`: la prima parte è il ruolo, la seconda il corpo. Entrambe
  passano in maiuscolo; non c'è `trim`, e ciò che segue un secondo `_` viene ignorato.

### 2) Ruolo
- Il ruolo si cerca per codice esatto in `catalog.ruoli`; se manca: errore `ROLE_NOT_FOUND`.
- Il ruolo diventa la radice dell'albero (`nodeType: "Settore"`).

### 3) Lettura del corpo (backtracking)
Settori e aree sono ordinati per lunghezza del codice, dal più lungo. A ogni posizione del corpo la
funzione prova, in quest'ordine:
1. ogni **settore** (reparto) il cui codice inizia lì: aggiunge un nodo `Reparto` come figlio della
   radice e lo ricorda come reparto corrente;
2. ogni **area** il cui codice inizia lì: aggiunge un nodo `Area` come figlio del reparto corrente, o
   della radice se non ce n'è ancora uno.

Poi prosegue sul resto del corpo; se il resto non si riesce a leggere torna indietro e prova il
candidato successivo. Vince la **prima** lettura completa trovata in questo ordine (il codice più
lungo prima, i settori prima delle aree): non c'è confronto fra letture alternative né rilevamento
delle ambiguità.

### 4) Metadati
Dall'albero costruito:
- `repartoCodes`: i reparti figli della radice, in ordine;
- `finalSettori`: i `settoriFinali` di ciascun reparto, concatenati, senza togliere i doppioni;
- `areaCode`: la prima area trovata (sotto un reparto o sotto la radice), altrimenti `null`.

### 5) Corpo non leggibile
Se il corpo contiene parti che non corrispondono a nessun settore o area, il backtracking non trova una
lettura completa e la radice resta senza figli. Il risultato è comunque `ok: true`, con il solo nodo
del ruolo, `repartoCodes` e `finalSettori` vuoti e `areaCode: null`; la funzione scrive un warning nel log
e un evento `COOPFI_POLICY_BUILD_FAILED` nell'audit log. Per un utente `CATEGORY` questo equivale a
nessun settore visibile.

## Esempio reale CoopFI (`ALD_OFCAPETDM`)

Lettura:
- `roleCode = "ALD"`, corpo `OFCAPETDM`
- reparti `OF` e `CAPE`, poi l'area `TDM` sotto l'ultimo reparto
- `repartoCodes = ["OF", "CAPE"]`
- `areaCode = "TDM"`
- `finalSettori = ["ortofrutta", "macelleria", "pescheria"]`

Albero (i reparti sono fratelli sotto il ruolo; l'area è figlia dell'ultimo reparto letto):
```json
[
  {
    "nodeType": "Settore",
    "nodeValue": "ALD",
    "codificaFICO": "ALD",
    "children": [
      {
        "nodeType": "Reparto",
        "nodeValue": "OF",
        "codificaFICO": "OF",
        "children": []
      },
      {
        "nodeType": "Reparto",
        "nodeValue": "CAPE",
        "codificaFICO": "CAPE",
        "children": [
          {
            "nodeType": "Area",
            "nodeValue": "TDM",
            "codificaFICO": "TDM",
            "children": []
          }
        ]
      }
    ]
  }
]
```

## CodificaFICO: fonte e garanzie

`codificaFICO` nei nodi non viene derivata dal codice letto:
- ruolo → `catalog.ruoli[].codificaFico`
- area → `catalog.aree[].codificaFico`
- reparto → `catalog.settori[].codificaFico`

I test d'integrità garantiscono che tutti i record del catalogo abbiano `codificaFico` valorizzata.

## Stato dati CoopFI

I conteggi e le impronte del catalogo sono fissati in `coopfi-policy-data-integrity.test.ts`: aggiungere
o togliere record, o cambiarne codici, `codificaFico` o settori finali, fa fallire il test finché non si
aggiornano anche quei valori.

Duplicati noti di `settori.code`, voluti per compatibilità con i dati storici: `SWSC` (3 occorrenze),
`POS` e `SWA` (2 ciascuno). Le occorrenze hanno oggi gli stessi valori; in caso di differenze varrebbe
la prima nel file, perché la funzione prova i settori nell'ordine del file a parità di lunghezza e cerca
i settori finali con `find`.

## Test e garanzie attuali

### `coopfi-policy-v2.test.ts`
Copre:
- caso reale `ALD_OFCAPETDM` (ruolo, area, reparti, settori finali, forma dell'albero);
- `codificaFICO` allineata al catalogo su tutti i nodi;
- errore `ROLE_NOT_FOUND` su ruolo non censito.

### `coopfi-policy-data-integrity.test.ts`
Copre:
- numero di record per sezione del catalogo;
- digest SHA-256 delle mappature di ruoli, aree e settori;
- duplicati noti e mappature critiche (`OF`, `CAPE`, `TDM`);
- `codificaFico` valorizzata su tutte le sezioni.

## Limiti noti e punti di attenzione

- Un corpo non leggibile non è un errore (`ok: true` con albero vuoto sotto il ruolo): chi usa il
  risultato deve controllare `repartoCodes`/`finalSettori`, non solo `ok`.
- Con più letture possibili vince la prima trovata (codici più lunghi prima, settori prima delle aree).
- Nessuna normalizzazione oltre al maiuscolo: spazi iniziali o finali rendono il ruolo non trovato.
- `finalSettori` può contenere doppioni se due reparti condividono un settore finale.

## Per una nuova agenzia

Non c'è un motore riusabile. Per una nuova agenzia serve:
1. un catalogo nel formato `AgenziaPolicyCatalog`, completo di `codificaFico`;
2. una funzione propria, sul modello di `buildCoopfiPolicyFromCodeV2`, che restituisca `PolicyBuildResultV2`;
3. l'integrazione nella sua `agenzia_lib` (`<agenzia>/index.ts`) per ruoli Olympus e filtri;
4. test sui casi reali e d'integrità del catalogo (conteggi, impronte, duplicati noti).
