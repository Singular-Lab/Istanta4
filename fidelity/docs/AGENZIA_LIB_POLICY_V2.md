# Agenzia Lib Policy Engine v2

## Obiettivo e perimetro
Il modulo `policy-v2` serve a trasformare un `codicePosizione` (es. `ALD_OFCAPETDM`) in:
- un albero `ruoli` compatibile con Olympus (`OlympusUserPolicyRuolo[]`);
- una lista di `finalSettori` usata per i filtri applicativi;
- metadati di parsing (`roleCode`, `areaCode`, `repartoCodes`);
- un errore tipizzato in caso di failure (`strict_fail`, senza output parziale).

L’engine e` generico e JSON-driven:
- il **catalogo** descrive dati organizzativi (ruoli, aree, reparti, settori finali);
- le **rules** descrivono regex, normalizzazione, tokenizzazione e strategia tree.

## File coinvolti

### Core engine
- `server/core/agenzia_lib/policy-v2/types.ts`
- `server/core/agenzia_lib/policy-v2/engine.ts`
- `server/core/agenzia_lib/policy-v2/index.ts`

### CoopFI
- `server/core/agenzia_lib/coopfi/utility/data/coopfi-organigramma.json`
- `server/core/agenzia_lib/coopfi/utility/data/coopfi-policy-rules.json`
- `server/core/agenzia_lib/coopfi/utility/coopfi-json-catalog.ts`
- `server/core/agenzia_lib/coopfi/utility/coopfi-policy-rules.ts`
- `server/core/agenzia_lib/coopfi/utility/coopfi-policy-v2.ts`

### Integrazione runtime
- `server/core/agenzia_lib/coopfi/index.ts`
- `server/core/controllers/HubController.ts`

### Test
- `server/core/agenzia_lib/__tests__/policy-v2.engine.test.ts`
- `server/core/agenzia_lib/coopfi/__tests__/coopfi-policy-v2.test.ts`
- `server/core/agenzia_lib/coopfi/__tests__/coopfi-policy-data-integrity.test.ts`

## Flusso runtime end-to-end
1. `HubController.oidcCallback(...)` autentica OIDC e chiama `agenziaLib.parseUtenteOIDC(email, claims)`.
2. In CoopFI, `CoopfiAgenziaLib.parseUtenteOIDC(...)` recupera il censito AD/API e il suo `codicePosizione`.
3. Il `codicePosizione` viene passato a `buildCoopfiPolicyFromCodeV2(...)`.
4. Se parsing policy e` `ok`:
- `getRuoliPolicyFromUtenteCoop(...)` restituisce `tree` per Olympus (`campi_aggiuntivi.ruoli` in `initOlympusPassport`).
- `getFiltriFromUtenteCoop(...)` converte `finalSettori` in filtri `[{ field: "reparto", operator: "equals", value: <settoreFinale> }]`.
5. Se parsing policy fallisce:
- viene loggato warning con `result.error`;
- runtime CoopFI ritorna array vuoti (`ruoli = []`, `filtri = []`) e continua il flusso utente.

## Contratti TypeScript (formali)

### Input engine
```ts
buildPolicyFromCodeV2(
  input: string | null | undefined,
  config: {
    catalog: AgenziaPolicyCatalog;
    rules: AgenziaPolicyRules;
  }
): PolicyBuildResultV2
```

### Output success
```ts
{
  ok: true;
  tree: OlympusUserPolicyRuolo[];
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
    details?: Record<string, unknown>;
  };
}
```

## Schema catalogo (`AgenziaPolicyCatalog`)
Struttura:
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
- `codificaFico` deve essere presente su tutti i record usati nel tree.
- `settori[].settoriFinali[]` deve puntare a codici presenti in `settoriFinali`.
- codici duplicati sono ammessi per compatibilita` storica: durante l’indicizzazione vince l’**ultimo** record incontrato.

## Schema rules (`AgenziaPolicyRules`)
Esempio CoopFI attuale:
```json
{
  "version": 1,
  "errorPolicy": "strict_fail",
  "expressions": {
    "inputRegex": "^(?<role>[^_]+)_(?<body>[^_]+)$",
    "groups": { "role": "role", "body": "body" }
  },
  "parsing": {
    "normalize": { "trim": true, "toUpper": true },
    "areaExtraction": { "mode": "suffix_longest_match", "required": false },
    "settoreTokenization": { "mode": "deterministic_longest_match", "allowEmpty": false }
  },
  "tree": {
    "strategy": "role_reparto_chain_area_leaf",
    "nodeTypes": { "role": "Settore", "reparto": "Reparto", "area": "Area" }
  }
}
```

Nota importante:
- oggi il motore implementa concretamente `suffix_longest_match` e `deterministic_longest_match`;
- se nelle rules viene messo un valore non supportato, il tipo TS lo impedisce a compile-time, ma a runtime non c’e` un dispatcher di mode alternativi.

## Pipeline interna (dettaglio completo)

### 1) Validazione config
Se `catalog` o `rules` mancano:
- ritorna `INVALID_RULES` (`step: "config"`).

### 2) Normalizzazione input
`createNormalizer(rules)` applica in ordine:
- `trim()`
- `toUpperCase()`

Se l’input normalizzato e` vuoto:
- `INVALID_INPUT` (`step: "normalize"`).

### 3) Split ruolo/body via regex
`extractRoleAndBody(...)`:
- compila `new RegExp(rules.expressions.inputRegex, flags?)`;
- legge i gruppi nominati secondo `rules.expressions.groups.role/body`.

Failure:
- regex invalida -> `INVALID_RULES` (`step: "split"`);
- mismatch formato -> `INVALID_INPUT_FORMAT` (`step: "split"`).

### 4) Costruzione indici catalogo
`buildIndexes(...)` crea mappe `byCode` normalizzate:
- `ruoliByCode`
- `areeByCode`
- `settoriByCode`
- `settoriFinaliByCode`

Ogni indice mantiene anche i codici ordinati:
- prima per lunghezza decrescente;
- a parita` di lunghezza, ordine lessicografico.

Questo ordine e` fondamentale per match deterministici e longest-first.

### 5) Validazione ruolo
Se `roleCode` non e` in `ruoliByCode`:
- `ROLE_NOT_FOUND` (`step: "role"`), con supporto template `{{roleCode}}`.

### 6) Estrazione area (`suffix_longest_match`)
`extractAreaFromBody(body, sortedAreaCodes)`:
- scandisce i codici area gia` ordinati per lunghezza decrescente;
- prende il primo che soddisfa `body.endsWith(areaCode)`;
- ritorna:
  - `areaCode` (o `null`);
  - `repartoBody` (body meno il suffisso area).

Se `rules.parsing.areaExtraction.required === true` e area mancante:
- `AREA_NOT_FOUND` (`step: "area"`).

### 7) Tokenizzazione repartoBody (`deterministic_longest_match`)
Funzione centrale: `findBestSegmentations(input, sortedSettoreCodes)`.

Algoritmo:
- DFS ricorsiva con memoization per posizione (`solve(position)`).
- Per ogni codice reparto che matcha `startsWith` alla posizione corrente:
  - risolve la coda;
  - produce candidati segmentazione.
- Sceglie solo i candidati "migliori" usando `compareSegmentations(...)`.

Criteri di "migliore":
1. meno segmenti (`left.length - right.length`): meno split = migliore;
2. a parita` di numero segmenti, segmenti piu` lunghi prima;
3. a parita` totale, ordine lessicografico (`join("|")`) per stabilita`.

Se non esiste segmentazione completa:
- `REPARTO_SEGMENTATION_FAILED` (`step: "reparto"`).

Se esistono piu` segmentazioni equivalenti "migliori":
- `AMBIGUOUS_SEGMENTATION` (`step: "reparto"`, con `details.candidates`).

### 8) Calcolo `finalSettori`
Per ogni `repartoCode` risolto:
- prende il settore da `settoriByCode`;
- itera `settore.settoriFinali[]`;
- verifica che ogni codice finale esista in `settoriFinaliByCode`.

Failure:
- reparto non presente in catalogo -> `CATALOG_INCONSISTENT` (`step: "final_settori"`);
- settore finale referenziato ma assente -> `CATALOG_INCONSISTENT` (`step: "final_settori"`).

Dedup `finalSettori`:
- ordine preservato dalla prima occorrenza;
- canonicalizzazione sul codice presente in catalogo.

### 9) Costruzione tree
`buildTreeByStrategy(...)` supporta 2 strategie.

Se strategy non riconosciuta:
- `INVALID_RULES` (`step: "tree"`).

## Strategie tree supportate

### `role_area_reparti_siblings`
Forma:
- root = ruolo
- figlio = area (se presente)
- figli dell’area = reparti sibling

### `role_reparto_chain_area_leaf`
Forma:
- root = ruolo
- catena lineare reparti (primo -> secondo -> ... )
- foglia finale = area (se presente)

Questa e` la strategia usata da CoopFI oggi.

## Esempio reale CoopFI (`ALD_OFCAPETDM`)
Parsing:
- `roleCode = "ALD"`
- `body = "OFCAPETDM"`
- area suffix longest match: `areaCode = "TDM"`
- `repartoBody = "OFCAPE"`
- tokenizzazione reparti: `["OF", "CAPE"]`
- `finalSettori = ["ortofrutta", "macelleria", "pescheria"]`

Tree finale CoopFI (`role_reparto_chain_area_leaf`):
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
        "children": [
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
  }
]
```

## Error policy (`strict_fail`)
In qualunque failure:
- `ok = false`
- `tree = []`
- `repartoCodes = []`
- `finalSettori = []`
- `error` popolato con codice, step, messaggio e dettagli opzionali.

Codici errore supportati:
- `INVALID_INPUT`
- `INVALID_RULES`
- `INVALID_INPUT_FORMAT`
- `ROLE_NOT_FOUND`
- `AREA_NOT_FOUND`
- `REPARTO_SEGMENTATION_FAILED`
- `AMBIGUOUS_SEGMENTATION`
- `CATALOG_INCONSISTENT`

Template messaggi:
- se `rules.messageTemplates[errorCode]` esiste, viene renderizzato con placeholder `{{key}}`.
- fallback al `defaultMessage` interno engine.

## CodificaFICO: fonte e garanzie
`codificaFICO` nei nodi tree non viene derivata da stringhe:
- ruolo -> `catalog.ruoli[].codificaFico`
- area -> `catalog.aree[].codificaFico`
- reparto -> `catalog.settori[].codificaFico`

Se un codice non e` indicizzabile, la codifica puo` risultare vuota (`""`) in fase di node-build.
Per CoopFI, i test integrita` garantiscono che i record censiti hanno `codificaFico` valorizzata.

## Stato dati CoopFI (snapshot attuale)
Dal catalogo `coopfi-organigramma.json`:
- `ruoli`: 52
- `aree`: 37
- `settori`: 335
- `settoriFinali`: 14

Duplicati noti `settori.code` (voluti per compatibilita` legacy):
- `SWSC` (3 occorrenze)
- `POS` (2 occorrenze)
- `SWA` (2 occorrenze)

Con la logica corrente di indicizzazione (`Map.set`), in presenza di duplicati conta l’ultimo record nel file.

## Integrazione applicativa CoopFI

### `getRuoliPolicyFromUtenteCoop(codicePosizione)`
- chiama `buildCoopfiPolicyFromCodeV2`.
- se `ok`: ritorna `result.tree`.
- se failure: log warning e ritorna `[]`.

### `getFiltriFromUtenteCoop(codicePosizione)`
- chiama `buildCoopfiPolicyFromCodeV2`.
- se `ok` e `finalSettori` non vuoto:
  - converte in `Array<FilterCondition[]>`, un filtro per ogni settore finale.
- se failure o lista vuota:
  - warning e ritorno `[]`.

### Uso nel provisioning passport Olympus
`initOlympusPassport(...)` invia a `/auth/getPassport`:
- `codice_posizione` (dal meta utente);
- `ruoli` (albero policy generato da `getRuoliPolicyFromUtenteCoop`).

## Test e garanzie attuali

### `policy-v2.engine.test.ts`
Copre:
- parsing base e complesso;
- scelta area con suffisso piu` lungo;
- tokenizzazione deterministic longest;
- failure ambiguita` segmentazione.

### `coopfi-policy-v2.test.ts`
Copre:
- caso reale `ALD_OFCAPETDM`;
- forma tree coerente con strategy CoopFI (catena reparti + area foglia);
- `codificaFICO` allineata a catalogo;
- errore su ruolo non censito.

### `coopfi-policy-data-integrity.test.ts`
Copre:
- cardinalita` legacy del catalogo;
- digest SHA-256 di mapping critici (ruoli/aree/settori);
- duplicati noti preservati;
- `codificaFico` valorizzata su tutte le sezioni.

## Limiti noti e punti di attenzione
- `assertCatalogShape` e `assertRulesShape` validano solo la struttura minima, non tutti i vincoli semantici.
- la `errorPolicy` oggi e` solo `strict_fail`.
- i campi `mode` nelle rules sono tipizzati ma il runtime implementa solo i mode correnti.
- con codici duplicati nel catalogo, la risoluzione e` deterministica ma dipende dall’ordine nel JSON.

## Checklist per nuova agenzia
1. Definire `data/<agenzia>-organigramma.json` completo di `codificaFico`.
2. Definire `data/<agenzia>-policy-rules.json` (regex, normalizzazione, strategy tree).
3. Creare loader tipizzati `*-json-catalog.ts` e `*-policy-rules.ts`.
4. Esporre wrapper `build<Agenzia>PolicyFromCodeV2(...)`.
5. Integrare in `<agenzia>/index.ts` per `ruoli` e `filtri`.
6. Aggiungere test:
- behavior engine con fixture minima;
- fixture agenzia su casi reali;
- data integrity (count/hash/duplicati noti).
