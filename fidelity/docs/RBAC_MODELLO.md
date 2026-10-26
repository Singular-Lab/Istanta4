# Modello RBAC dell'applicazione

Questo documento descrive il funzionamento del modello RBAC attuale, con particolare attenzione alla distinzione fra:

- **menu**: definiscono quali voci di navigazione e quali pagine risultano accessibili a un utente;
- **permessi**: definiscono quali azioni applicative/API l'utente puo eseguire.

I due sistemi sono collegati a livello funzionale, ma nel codice lavorano su piani diversi.

## Sintesi

L'applicazione usa un modello RBAC basato su:

- `tipo_utente`: ruolo applicativo principale, ad esempio `SUPERADMIN`, `AGENZIA`, `GDO`, `MARKETING`, `IT`, `PUNTOVENDITA`, `GUEST`;
- `id_ruolo_utente_gdo`: sotto-ruolo associato all'utente, usato soprattutto per utenti GDO, ad esempio `GDO_ADMIN`, `GDO_IMPIEGATO`, ecc.;
- `id_gdo`: organizzazione/GDO di appartenenza, usata per applicare override specifici;
- `permessi`: codici granulari come `promo.modifica`, `file.download`, `pagina.gestione_api`;
- `menu_items`: configurazione delle voci di menu disponibili per un ruolo.

Il punto chiave e questo:

> L'accesso a una pagina e controllato principalmente dalla presenza della pagina nel menu dell'utente. Le azioni e le API sono controllate dai permessi.

Quindi un utente puo:

- vedere una pagina nel menu ma non poter premere alcuni pulsanti, se gli mancano i permessi azione;
- avere un permesso azione ma non vedere una pagina nel menu, se la voce non e configurata nel menu;
- ricevere `403 Forbidden` da backend anche se un bottone fosse visibile per errore, perche le API sensibili usano `permissionGuard`.

## Modello dati

### `permessi`

Tabella catalogo dei permessi disponibili.

Campi principali:

- `id_permesso`: UUID del permesso;
- `codice`: codice stabile usato da frontend/backend, ad esempio `promo.elimina`;
- `nome`: nome leggibile;
- `descrizione`: descrizione funzionale;
- `categoria`: ad esempio `PAGINA` o `AZIONE`;
- `risorsa`: gruppo logico, ad esempio `promozioni`, `file`, `pagine_api`.

Il catalogo viene definito in `server/core/scripts/seedPermessi.ts`.

Sul frontend esiste una copia tipizzata dei codici in `src/constants/permissions.ts`, usata per evitare stringhe scritte a mano nei componenti React.

### `permessi_ruolo`

Tabella dei permessi globali per ruolo.

Campi principali:

- `tipo_utente`;
- `id_permesso`;
- `id_ruolo_utente_gdo`, opzionale;
- `abilitato`.

Questa tabella dice: "per questo tipo utente, questo permesso e abilitato o disabilitato".

Se `id_ruolo_utente_gdo` e valorizzato, la regola vale per uno specifico sotto-ruolo. Se e `NULL`, vale come regola base del tipo utente.

### `permessi_ruolo_gdo`

Tabella degli override specifici per una GDO.

Campi principali:

- `id_gdo`;
- `tipo_utente`;
- `id_permesso`;
- `id_ruolo_utente_gdo`, opzionale;
- `abilitato`.

Questa tabella permette di cambiare i permessi per una singola GDO senza modificare i default globali.

### `menu_items`

Tabella della navigazione laterale.

Campi principali:

- `tipo_utente`;
- `ruolo_gdo`, opzionale;
- `titolo`;
- `tipo`: `item` oppure `separator`;
- `icona`;
- `pathname`;
- `codice_permesso`;
- `disabilitato`;
- `start_page`;
- `ordinamento`;
- `id_parent`, per sotto-menu.

Nota importante: il campo `codice_permesso` esiste nella configurazione menu ed e selezionabile dalla UI, ma il controllo runtime del menu e dell'accesso pagina oggi si basa sul `pathname` presente nel menu e sul flag `disabilitato`. Non e il meccanismo principale che abilita/disabilita i permessi azione.

## Risoluzione dei permessi effettivi

I permessi effettivi di un utente vengono calcolati da `PermessiService`.

La precedenza e a 4 livelli, dal meno specifico al piu specifico:

1. **Default globale per tipo utente**
   Da `permessi_ruolo` con `tipo_utente` e `id_ruolo_utente_gdo IS NULL`.

2. **Override globale per sotto-ruolo**
   Da `permessi_ruolo` con `tipo_utente` e `id_ruolo_utente_gdo = X`.

3. **Override per GDO**
   Da `permessi_ruolo_gdo` con `id_gdo`, `tipo_utente` e `id_ruolo_utente_gdo IS NULL`.

4. **Override per GDO + sotto-ruolo**
   Da `permessi_ruolo_gdo` con `id_gdo`, `tipo_utente` e `id_ruolo_utente_gdo = X`.

Il livello piu specifico sovrascrive il precedente, sia per abilitare sia per disabilitare un permesso.

Esempio:

```text
GDO base abilita file.download
GDO_ADMIN globale disabilita file.download
GDO specifica riabilita file.download
GDO specifica + GDO_ADMIN disabilita di nuovo file.download
```

Il risultato finale per quell'utente sara `file.download = false`, perche il livello 4 ha priorita massima.

## Superadmin

Il `SUPERADMIN` e un caso speciale.

Nel backend:

- `permissionGuard` fa bypass completo per `TIPO_UTENTI.SUPERADMIN`;
- `PermessiService.getPermessiEffettivi` restituisce tutti i codici permesso;
- `MenuCacheService.hasPageAccess` restituisce `true` per ogni pagina.

Nel frontend:

- `PermissionContext.hasPermission` restituisce `true` se `user.is_admin` e valorizzato.

In pratica il Superadmin non dipende dalle singole righe di permesso per poter operare.

## Funzionamento frontend dei permessi

All'avvio dell'app, `PermissionProvider` legge l'utente dal `UserContext`.

Se esiste un utente loggato, chiama:

```text
GET /permessi/effettivi
```

Il backend risponde con:

```json
{
  "permessi": ["promo.visualizza", "file.download"]
}
```

Il frontend salva l'elenco in memoria e fornisce:

- `hasPermission(codice)`;
- `usePermission(codice)`;
- `useActionPermission(codice)`;
- `PermissionGate`.

### `PermissionGate`

`PermissionGate` viene usato per proteggere elementi UI.

Modalita:

- `hide`: se manca il permesso, il contenuto non viene renderizzato;
- `disable`: se manca il permesso, il contenuto resta visibile ma disabilitato con tooltip.

Esempio:

```tsx
<PermissionGate permission={PERMISSIONS.PROMO.MODIFICA} mode="disable">
  <Button>Modifica</Button>
</PermissionGate>
```

Questo controllo serve per UX e riduzione degli errori, ma non e sufficiente come sicurezza. La sicurezza reale deve stare anche sul backend.

## Funzionamento backend dei permessi

Le route sensibili usano `permissionGuard(codicePermesso)`.

Esempio logico:

```ts
authMiddleware,
permissionGuard('promo.modifica'),
controllerHandler
```

Il middleware:

1. verifica che in sessione esistano `id_utente` e `tipo_utente`;
2. consente sempre il passaggio al `SUPERADMIN`;
3. legge i permessi effettivi dell'utente;
4. li mette in cache nella sessione come `permessi_cache`;
5. se il codice richiesto non e presente, registra un audit log e restituisce `403 Forbidden`.

Questo e il controllo di sicurezza principale per azioni e API.

## Funzionamento del menu

Il menu laterale viene caricato dal frontend con:

```text
GET /menu/me
```

Il backend risolve:

- `tipo_utente` dalla sessione;
- per utenti `GDO`, anche il ruolo GDO tramite `resolveGdoRuoloKey`;
- la configurazione menu da `menu_items`.

Se la tabella `menu_items` e vuota, `MenuService` puo fare fallback su `config/menu.json` per retrocompatibilita.

Il menu restituito contiene elementi come:

```json
[
  "PROMOZIONI",
  {
    "icon": "Tag",
    "pathname": "/promozioni/in-corso",
    "title": "Lavorazioni in corso",
    "disabled": false,
    "start_page": true,
    "subMenu": []
  }
]
```

Il frontend salva il menu nello store Redux (`sideMenuSlice_istanta`) e lo usa per renderizzare la sidebar.

`start_page` indica la pagina preferita di ingresso. Se non presente, viene usata la prima voce navigabile non disabilitata.

## Accesso alle pagine

Ogni pagina protetta passa dal componente `SessionChecker`.

`SessionChecker` chiama in parallelo:

```text
GET /session/check
GET /policy/check?rp=<pagina-corrente>
```

Il controllo `/policy/check` non verifica i permessi del catalogo `permessi`.

Verifica invece se la pagina richiesta e presente nel menu dell'utente:

- legge il menu da `MenuCacheService`;
- normalizza il path richiesto;
- cerca una voce menu con `pathname` compatibile;
- se trova la voce e non e `disabled`, consente l'accesso;
- se non la trova, ritorna `can_go_to_page = false`.

Per il `SUPERADMIN`, l'accesso pagina viene sempre autorizzato.

Sono presenti anche alcune eccezioni hardcoded sempre permesse, ad esempio:

- `profilo-utente`;
- `display/files`;
- `storico-volantini`;
- `hub/todos`;
- `auth`.

## Differenza pratica tra menu e permessi

### Menu

Il menu risponde alla domanda:

> L'utente puo raggiungere questa pagina?

Dipende da:

- `menu_items.tipo_utente`;
- `menu_items.ruolo_gdo`;
- `menu_items.pathname`;
- `menu_items.disabilitato`;
- regole speciali per `SUPERADMIN`.

Non dipende direttamente dai permessi azione come `promo.modifica` o `file.download`.

### Permessi

I permessi rispondono alla domanda:

> L'utente puo eseguire questa azione o chiamare questa API?

Dipende da:

- catalogo `permessi`;
- default globali in `permessi_ruolo`;
- sotto-ruoli in `permessi_ruolo`;
- override GDO in `permessi_ruolo_gdo`;
- override GDO + sotto-ruolo in `permessi_ruolo_gdo`;
- bypass `SUPERADMIN`.

## Gestione amministrativa

La pagina `Gestione Permessi e Menu` ha due tab.

### Tab Permessi

Permette di configurare:

- permessi globali per `tipo_utente`;
- permessi per sotto-ruolo;
- override per GDO;
- override per GDO + sotto-ruolo;
- reset degli override GDO;
- reseed del catalogo permessi.

Le modifiche vengono inviate a:

```text
GET    /permessi
GET    /permessi/effettivi
GET    /permessi/ruolo/:tipoUtente
GET    /permessi/ruolo/:tipoUtente/gdo/:idGdo
PUT    /permessi/ruolo/:tipoUtente
PUT    /permessi/ruolo/:tipoUtente/gdo/:idGdo
DELETE /permessi/ruolo/:tipoUtente/gdo/:idGdo
POST   /permessi/seed
POST   /permessi/reseed
```

Queste route amministrative richiedono `permessi.gestisci`.

### Tab Menu

Permette di configurare:

- voci di menu per tipo utente;
- menu specifici per ruolo GDO;
- titolo, icona, path, ordinamento;
- separatori;
- sotto-menu;
- pagina iniziale;
- flag `disabilitato`;
- import iniziale da `config/menu.json`.

Le modifiche vengono inviate a:

```text
GET  /menu
GET  /menu/me
GET  /menu/:tipoUtente
PUT  /menu/:tipoUtente
POST /menu/seed
```

Anche queste route amministrative richiedono `permessi.gestisci`, tranne `/menu/me`, che serve all'utente loggato.

## Cache

### Cache permessi

`permissionGuard` salva i permessi effettivi nella sessione:

```text
req.session.permessi_cache
```

Questo evita query ripetute a ogni chiamata API.

Attenzione operativa: dopo una modifica ai permessi, una sessione gia attiva potrebbe continuare a usare la propria cache finche non viene invalidata/rigenerata. Il frontend inoltre mantiene in memoria i permessi letti da `/permessi/effettivi` finche non viene richiamato `refreshPermessi`, ricaricata la pagina o ricreata la sessione.

### Cache menu

Sono presenti due cache:

- `MenuService`: cache runtime breve, circa 5 minuti, usata nel flusso `/menu/me`;
- `MenuCacheService`: cache per utente, circa 30 minuti, usata dal controllo `/policy/check`.

`MenuCacheService` verifica la versione del menu tramite il massimo timestamp `updatedat/createdat` in `menu_items`. Se cambia, invalida la cache.

## Convenzioni sui codici permesso

I codici seguono due famiglie:

```text
pagina.<nome_pagina>
<risorsa>.<azione>
```

Esempi:

```text
pagina.gestione_api
pagina.gestione_permessi
promo.crea
promo.modifica
file.download
whatsapp.invia_campagna
permessi.gestisci
```

I permessi `pagina.*` rappresentano accessi pagina nel catalogo permessi, ma nel runtime attuale l'accesso pagina effettivo e governato dal menu. Sono comunque utili per coerenza amministrativa, per associazione informativa alle voci menu e per eventuali controlli UI.

## Come aggiungere una nuova pagina protetta

Checklist consigliata:

1. Aggiungere il codice pagina al catalogo in `server/core/scripts/seedPermessi.ts`.
2. Aggiungere lo stesso codice in `src/constants/permissions.ts`.
3. Eseguire reseed o seed del catalogo, se necessario.
4. Configurare la voce in `menu_items` tramite tab Menu, oppure aggiornare `config/menu.json` se si usa il seed da JSON.
5. Verificare che il `pathname` della voce menu corrisponda alla route React.
6. Se servono pulsanti o azioni nella pagina, aggiungere permessi azione dedicati.
7. Proteggere i componenti con `PermissionGate` solo per UX.
8. Proteggere le API con `permissionGuard`.

## Come aggiungere una nuova azione protetta

Checklist consigliata:

1. Aggiungere il codice azione a `PERMESSI_SEED`.
2. Aggiungere la costante frontend in `src/constants/permissions.ts`.
3. Decidere i default per ruolo in `PERMESSI_RUOLO_DEFAULTS`.
4. Eseguire reseed o configurare manualmente dalla UI.
5. Usare `PermissionGate` o `useActionPermission` nel frontend.
6. Applicare `permissionGuard('<codice>')` sulle route backend coinvolte.
7. Testare sia UI sia chiamata API diretta senza permesso.

## Punti di attenzione

- Il menu e i permessi non sono la stessa cosa.
- Nascondere un bottone nel frontend non sostituisce `permissionGuard`.
- Aggiungere un permesso `pagina.*` non rende automaticamente visibile o accessibile una route: serve anche la voce menu.
- Aggiungere una voce menu non abilita automaticamente le azioni nella pagina.
- Il campo `codice_permesso` su `menu_items` e presente, ma il controllo pagina runtime usa il `pathname` del menu.
- Le cache possono far vedere temporaneamente uno stato precedente dopo modifiche a menu o permessi.
- Il Superadmin bypassa sia i controlli permesso sia il controllo pagina.
- I default seed attuali coprono alcuni ruoli principali; per ruoli senza default espliciti, i permessi vanno configurati da UI o aggiunti al seed.

## File principali

- `src/constants/permissions.ts`: costanti frontend dei codici permesso.
- `src/context/PermissionContext.tsx`: caricamento e verifica permessi lato frontend.
- `src/components/PermissionGate/index.tsx`: gate UI per nascondere/disabilitare azioni.
- `src/hooks/useActionPermission.ts`: hook per controlli azione.
- `server/core/scripts/seedPermessi.ts`: catalogo e default iniziali.
- `server/core/services/PermessiService.ts`: risoluzione permessi effettivi.
- `server/core/repositories/PermessiRepository.ts`: query e upsert permessi.
- `server/core/middleware/permissionGuard.ts`: enforcement backend dei permessi.
- `server/core/controllers/PermessiController.ts`: API di gestione permessi.
- `server/core/models/permessi.ts`: modello catalogo permessi.
- `server/core/models/permessi_ruolo.ts`: modello permessi globali per ruolo.
- `server/core/models/permessi_ruolo_gdo.ts`: modello override GDO.
- `server/core/models/menu_item.ts`: modello menu.
- `server/core/services/MenuService.ts`: gestione runtime/admin del menu.
- `server/core/services/MenuCacheService.ts`: menu cache e controllo accesso pagina.
- `server/core/controllers/MenuController.ts`: API menu.
- `server/core/controllers/UserController.ts`: endpoint `/policy/check`.
- `src/stores/sideMenuSlice_istanta.ts`: caricamento menu frontend.
- `src/components/SessionChecker/index.tsx`: check sessione e pagina.
- `src/pages/GestionePermessi/index.tsx`: UI tab Permessi.
- `src/pages/GestionePermessi/MenuTab.tsx`: UI tab Menu.
