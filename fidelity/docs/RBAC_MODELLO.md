# Modello RBAC dell'applicazione

Questo documento descrive il modello degli accessi di Fidelity: chi può aprire quali pagine, eseguire
quali azioni e vedere quali voci di menu.

Il modello è per **aree**. Un unico catalogo di permessi, condiviso da server e client, governa sia le
pagine sia le azioni; il menu mostra solo le pagine che l'utente può aprire. Tutte le decisioni passano
da un solo componente, `RisolutoreAccessi`, così API, pagine e menu non possono divergere.

## Sintesi

Il ruolo di un utente è dato da:

- `tipo_utente`: il tipo, preso dalla sessione e verificato al login (`Superadmin`, `Agenzia`, `GDO`,
  `PuntoVendita`, `Category`, `Marketing`, `IT`, `Guest`: enum `TIPO_UTENTI` in `lib/enums.ts`);
- il **sotto-ruolo GDO** (`id_ruolo_utente_gdo`, tabella `ruolo_utente_gdo`) e la **GDO** di appartenenza,
  letti dall'anagrafica `utenti_gdo`; per gli utenti senza associazione vale la GDO della sessione.

I permessi rispondono a due domande con lo stesso catalogo:

> L'utente può aprire questa pagina? Serve il permesso che il catalogo delle pagine associa al percorso,
> di norma l'accesso all'area (`<area>.visualizza`).
>
> L'utente può eseguire questa azione o chiamare questa API? Serve il permesso dell'azione, che vale
> solo se il ruolo ha anche l'accesso alla sua area.

Il Superadmin ha sempre tutti i permessi, compresi quelli dell'area **Sistema**, che non sono
assegnabili a nessun altro ruolo.

## Catalogo dei permessi

`lib/accessi/catalogo.ts` è l'unica definizione dei permessi (`PERMESSI`, `AREE`, tipo `CodicePermesso`).
Ogni area ha di norma:

- un permesso di **accesso**, `<area>.visualizza` (per WhatsApp `whatsapp.visualizza_campagne`, per le API
  `api.visualizza_statistiche`), che governa le pagine dell'area;
- un elenco di **azioni** (`promo.crea`, `file.download`, `kit_runtime.pubblica`...), alcune segnate come
  `pericolosa`.

Fanno eccezione l'area `file` e l'area `ai`, che hanno solo azioni, e l'area `sistema`, i cui permessi
(`sistema.gestisci_accessi`, `sistema.gestisci_metodi_accesso`, `sistema.log`, `sistema.audit`...)
appartengono solo al Superadmin.

Il client usa le stesse costanti: `src/constants/permissions.ts` riesporta `PERMESSI` come `PERMISSIONS`
e `CodicePermesso` come `PermissionCode`. Un codice scritto male è un errore di compilazione.

All'avvio del server `preparaAccessiAllAvvio` (`server/core/accessi/migrazioneAccessi.ts`) allinea la
tabella `permessi` al catalogo. Su un'installazione nuova scrive anche i permessi predefiniti per tipo
(`server/core/accessi/predefiniti.ts`); su un'installazione esistente valgono quelli salvati.

## Catalogo delle pagine

`lib/accessi/pagine.ts` (`PAGINE`) associa ogni percorso del router al permesso che richiede:

- `permesso: null` significa "basta essere autenticati" (dashboard, profilo, hub, documentazione...);
- `sottopagine: true` estende il permesso ai percorsi che iniziano con quello della pagina (dettagli,
  kit, menabò...). Il confronto è per segmenti interi: `/promozioni` non copre `/promozioni-in-corso`;
- la voce più specifica vince (`/promozioni/nuova` richiede `promo.crea`, il resto di `/promozioni`
  richiede `promo.visualizza`);
- **una pagina non censita non è accessibile**, salvo al Superadmin.

Il test `src/router/catalogoPagine.test.tsx` fallisce se una rotta del router non ha la sua voce: chi
aggiunge, rinomina o sposta una pagina deve aggiornare anche `PAGINE`. I percorsi spostati si
riscrivono nei menu salvati con `lib/accessi/gestioneInterna.ts` e
`server/core/inizializzazione/migrazionePercorsi.ts`.

## Modello dati

| Tabella | Contenuto |
| --- | --- |
| `permessi` | Catalogo dei permessi, allineato a `lib/accessi/catalogo.ts` all'avvio. |
| `permessi_ruolo` | Permessi globali per `tipo_utente`, con `id_ruolo_utente_gdo` facoltativo per il sotto-ruolo, e `abilitato`. |
| `permessi_ruolo_gdo` | Override per una singola GDO (`id_gdo`), anche per sotto-ruolo. |
| `menu_items` | Voci di menu per `tipo_utente` e, facoltativo, per sotto-ruolo (`id_ruolo_utente_gdo`). |
| `accessi_stato` | Una riga: versione dei permessi e versione dello schema degli accessi. |

In `menu_items` restano due campi storici: `ruolo_gdo` (chiave testuale, le letture usano
`id_ruolo_utente_gdo`) e `codice_permesso`, che non decide nulla: il permesso di una voce è quello
della sua pagina nel catalogo.

## Risoluzione dei permessi effettivi

`RisolutoreAccessi` (`server/core/accessi/RisolutoreAccessi.ts`) combina quattro livelli, dal meno al
più specifico:

1. **Tipo utente**: `permessi_ruolo` con `id_ruolo_utente_gdo IS NULL`.
2. **Sotto-ruolo**: `permessi_ruolo` con `id_ruolo_utente_gdo = X`.
3. **GDO**: `permessi_ruolo_gdo` con `id_gdo` e senza sotto-ruolo.
4. **GDO e sotto-ruolo**: `permessi_ruolo_gdo` con `id_gdo` e `id_ruolo_utente_gdo = X`.

Un codice assente in un livello eredita dal precedente; un livello più specifico sovrascrive il
precedente sia per abilitare sia per disabilitare.

Esempio:

```text
GDO base abilita file.download
GDO_ADMIN globale disabilita file.download
GDO specifica riabilita file.download
GDO specifica + GDO_ADMIN disabilita di nuovo file.download
```

Il risultato finale per quell'utente sarà `file.download = false`, perché il livello 4 ha priorità massima.

Al risultato si applicano poi le regole del catalogo (`applicaRegoleArea`): si scartano i permessi di
sistema, le azioni senza l'accesso alla loro area e i codici sconosciuti. Il risolutore non aggiunge
mai permessi.

Il contesto della richiesta (tipo, GDO, sotto-ruolo) lo calcola `leggiContestoAccesso`
(`server/core/accessi/contestoAccesso.ts`). Per le operazioni su una GDO, Superadmin e Agenzia possono
indicare la GDO nella richiesta; per gli altri vale sempre la GDO della sessione o dell'anagrafica
(`gdoOperativa`, `gdoOperativaPerRichiesta`).

## Superadmin

- `RisolutoreAccessi` gli restituisce tutti i codici del catalogo, compresi quelli di sistema;
- `permissionGuard` lo lascia passare su ogni permesso;
- può aprire ogni pagina, anche se non censita, e vede il menu senza filtri;
- nel client `PermissionContext.hasPermission` restituisce `true` quando `/permessi/effettivi` risponde
  `superadmin: true`.

## Funzionamento backend dei permessi

Le route usano `permissionGuard(codice)` (`server/core/middleware/permissionGuard.ts`) dopo
`authMiddleware`:

```ts
authMiddleware,
permissionGuard(PERMESSI.PROMO.MODIFICA),
controllerHandler
```

Il middleware:

1. lascia passare le chiamate di servizio già autenticate da `authMiddleware` (bearer di integrazione o
   richiesta interna firmata), che non hanno sessione né ruolo;
2. legge il contesto; senza utente in sessione risponde `401`;
3. chiede a `RisolutoreAccessi` se il contesto ha il permesso;
4. se manca, scrive un evento `accessDenied` nell'audit log e risponde `403 Forbidden`.

È il controllo di sicurezza delle azioni e delle API: nascondere un pulsante nel client non lo sostituisce.

## Funzionamento frontend dei permessi

All'avvio `PermissionProvider` (`src/context/PermissionContext.tsx`) legge l'utente da `UserContext` e,
se c'è, chiama:

```text
GET /api/permessi/effettivi
```

Il backend risponde con:

```json
{
  "permessi": ["promo.visualizza", "file.download"],
  "superadmin": false
}
```

Il contesto fornisce `hasPermission(codice)`, `usePermission(codice)`, `loading` e `refreshPermessi()`.
Dopo un salvataggio, la gestione accessi emette l'evento `fidelity:permessi-aggiornati`
(`EVENTO_PERMESSI_AGGIORNATI`) e il contesto ricarica i permessi.

### `PermissionGate`

`src/components/PermissionGate/index.tsx` protegge gli elementi dell'interfaccia:

- `hide` (predefinito): se manca il permesso, il contenuto non viene renderizzato (o si mostra `fallback`);
- `disable`: il contenuto resta visibile ma inerte (niente click, focus né tasti), con un tooltip che
  nomina il permesso mancante come appare nella gestione accessi.

Mentre i permessi si caricano non mostra nulla.

```tsx
<PermissionGate permission={PERMISSIONS.PROMO.MODIFICA} mode="disable">
  <Button>Modifica</Button>
</PermissionGate>
```

Serve all'esperienza d'uso; la sicurezza resta `permissionGuard` sul server.

## Accesso alle pagine

Ogni pagina protetta passa da `SessionChecker` (`src/components/SessionChecker/index.tsx`), che chiama in
parallelo:

```text
GET /api/session/check
GET /api/policy/check?rp=<pagina-corrente>
```

`/policy/check` (`UserController.checkPolicy`) normalizza il percorso e chiede a
`RisolutoreAccessi.puoAprire` se il contesto può aprirlo secondo `PAGINE`. Risponde
`can_go_to_page = false` se la pagina non è censita o se manca il permesso.

Quando l'accesso è negato il layout mostra `AccessoNegato` (`src/components/AccessoNegato`) al posto
della pagina, lasciando visibile il menu: non c'è logout.

## Funzionamento del menu

Il menu laterale si carica con:

```text
GET /api/menu/me
```

`MenuService.getMenuDiUtente` (`server/core/services/MenuService.ts`):

- prende il menu del sotto-ruolo, se ne ha uno, altrimenti quello del tipo utente;
- per chi non è Superadmin toglie le voci delle pagine che l'utente non può aprire, con lo stesso
  catalogo delle pagine e gli stessi permessi effettivi; una voce senza percorso resta se ha sottovoci
  visibili.

Il client salva il menu nello store Redux (`src/stores/sideMenuSlice_istanta.ts`). `start_page` indica la
pagina preferita di ingresso.

Un'installazione nuova riceve solo il menu del Superadmin
(`server/core/inizializzazione/datiPredefiniti.ts`); i menu degli altri tipi si compongono dalla
gestione menu. Non c'è più il ripiego su `config/menu.json`.

## Gestione amministrativa

La pagina **Gestione accessi** (`/gestione-interna/gestione-permessi`, cartella
`src/pages/GestionePermessi`) richiede `sistema.gestisci_accessi`, quindi è solo del Superadmin. Ha tre
schede, che restano montate: cambiare scheda non perde le modifiche in sospeso.

- **Permessi dei ruoli** (`PermessiRuoli.tsx`): per tipo, sotto-ruolo, GDO e GDO + sotto-ruolo, con
  aree comprimibili, stato ereditato o personalizzato, riepilogo delle modifiche e ripristino degli
  override di una GDO.
- **Confronta ruoli** (`ConfrontoRuoli.tsx`): i permessi effettivi di più ruoli affiancati.
- **Menu** (`MenuTab.tsx`): voci, separatori, sotto-menu, icone, ordine, pagina iniziale e flag
  `disabilitato`, per tipo e per sotto-ruolo; per ogni percorso mostra il permesso che la pagina
  richiede (o "Pagina non censita"). "Ripristina menu predefiniti" riporta il menu del Superadmin.

API (`PermessiController`, `MenuController`), tutte con `sistema.gestisci_accessi` tranne
`/permessi/effettivi` e `/menu/me`, che servono all'utente collegato:

```text
GET    /api/permessi/effettivi
GET    /api/permessi/ruoli
GET    /api/permessi/configurazione
PUT    /api/permessi/configurazione
DELETE /api/permessi/override
GET    /api/permessi/confronto

GET    /api/menu/me
GET    /api/menu/:tipoUtente          (?ruoloGdo=<id sotto-ruolo>)
PUT    /api/menu/:tipoUtente
POST   /api/menu/ripristina-predefiniti
```

## Cache

Il risolutore e `MenuService` tengono una cache per processo, per ruolo, legata alla **versione dei
permessi** (`server/core/accessi/versionePermessi.ts`, tabella `accessi_stato`). Ogni salvataggio di
permessi, override o menu incrementa la versione nella stessa transazione; a ogni richiesta la cache la
confronta e si ricalcola se è cambiata. Una modifica vale quindi dalla richiesta successiva su tutti i
worker del cluster, senza nuovo login. Non c'è una cache dei permessi nella sessione.

Nel client, la scheda che salva ricarica subito i permessi; le altre schede e gli altri utenti tengono
in memoria l'elenco letto da `/permessi/effettivi` fino a `refreshPermessi`, al ricaricamento della
pagina o a un nuovo accesso. Il server, intanto, applica già i permessi nuovi.

## Convenzioni sui codici permesso

```text
<area>.visualizza      accesso all'area e alle sue pagine
<area>.<azione>        azione dell'area
sistema.<funzione>     riservati al Superadmin
```

Esempi:

```text
promo.visualizza
promo.crea
file.download
whatsapp.invia_campagna
sistema.gestisci_accessi
```

I vecchi codici `pagina.*` e `permessi.gestisci` non esistono più: la migrazione degli accessi (schema 1)
li ha sostituiti con l'accesso alle aree e con `sistema.gestisci_accessi`.

## Come aggiungere una nuova pagina protetta

1. Aggiungere la rotta in `src/router/index.tsx`.
2. Aggiungere la voce in `PAGINE` (`lib/accessi/pagine.ts`) con il permesso d'area che la governa
   (o `null` se basta essere autenticati); `catalogoPagine.test.tsx` lo verifica.
3. Se serve un'area nuova, aggiungerla in `AREE` (`lib/accessi/catalogo.ts`) con il suo accesso: il
   catalogo nel database si allinea al prossimo avvio.
4. Concedere l'accesso ai ruoli dalla Gestione accessi (o nei predefiniti, per le installazioni nuove).
5. Aggiungere la voce di menu dalla scheda Menu.
6. Proteggere le API della pagina con `permissionGuard` e, per l'esperienza d'uso, i comandi con
   `PermissionGate`.

## Come aggiungere una nuova azione protetta

1. Aggiungere il codice in `PERMESSI` e l'azione nella sua area in `AREE` (`lib/accessi/catalogo.ts`).
2. Decidere se va nei permessi predefiniti (`server/core/accessi/predefiniti.ts`, solo installazioni nuove).
3. Concederla ai ruoli dalla Gestione accessi.
4. Applicare `permissionGuard(PERMESSI.<AREA>.<AZIONE>)` sulle route coinvolte.
5. Usare `PermissionGate` o `usePermission` nel client.
6. Testare sia l'interfaccia sia la chiamata API diretta senza permesso.

## Punti di attenzione

- Un'azione senza l'accesso alla sua area non vale, anche se è abilitata.
- Una pagina non censita in `PAGINE` è negata a tutti tranne il Superadmin.
- Aggiungere una voce di menu non dà accesso alla pagina: decide il permesso della pagina.
- Nascondere un pulsante nel client non sostituisce `permissionGuard`.
- I permessi di sistema non si assegnano: il Superadmin li ha, gli altri no.
- I predefiniti valgono solo per le installazioni nuove; su quelle esistenti decidono i permessi salvati.

## File principali

- `lib/accessi/catalogo.ts`: catalogo di aree, accessi e azioni.
- `lib/accessi/pagine.ts`: catalogo delle pagine e confronto dei percorsi.
- `src/constants/permissions.ts`: costanti del catalogo per il client.
- `src/context/PermissionContext.tsx`: caricamento e verifica dei permessi nel client (`usePermission`).
- `src/components/PermissionGate/index.tsx`: gate UI per nascondere o disattivare comandi.
- `src/components/AccessoNegato/index.tsx`: schermata di accesso negato.
- `server/core/accessi/RisolutoreAccessi.ts`: permessi effettivi e accesso alle pagine.
- `server/core/accessi/contestoAccesso.ts`: tipo, GDO e sotto-ruolo della richiesta.
- `server/core/accessi/versionePermessi.ts`: versione dei permessi per l'invalidazione delle cache.
- `server/core/accessi/predefiniti.ts`: permessi delle installazioni nuove.
- `server/core/accessi/migrazioneAccessi.ts`: allineamento del catalogo e migrazione al modello per aree.
- `server/core/services/PermessiService.ts`: configurazione, override e confronto dei ruoli.
- `server/core/repositories/PermessiRepository.ts`: query e upsert dei permessi.
- `server/core/middleware/permissionGuard.ts`: enforcement backend dei permessi.
- `server/core/controllers/PermessiController.ts`: API di gestione dei permessi.
- `server/core/models/permessi.ts`, `permessi_ruolo.ts`, `permessi_ruolo_gdo.ts`, `menu_item.ts`: modelli.
- `server/core/services/MenuService.ts`: menu configurato e menu filtrato dell'utente.
- `server/core/controllers/MenuController.ts`: API del menu.
- `server/core/controllers/UserController.ts`: endpoint `/policy/check`.
- `server/core/inizializzazione/datiPredefiniti.ts`: menu predefinito del Superadmin.
- `src/stores/sideMenuSlice_istanta.ts`: caricamento del menu nel client.
- `src/components/SessionChecker/index.tsx`: controllo di sessione e pagina.
- `src/pages/GestionePermessi/`: pagina Gestione accessi (`index.tsx`, `PermessiRuoli.tsx`,
  `ConfrontoRuoli.tsx`, `MenuTab.tsx`).
