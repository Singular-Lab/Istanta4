# Sicurezza delle API Esterne — Istanta2

> Documento sulla sicurezza del sistema di autenticazione delle API esterne della piattaforma Istanta2.

---

## Indice

1. Panoramica del sistema
2. API Key — Chiamate server-to-server
3. Token Effimero — Sicurezza dello snippet
4. Browser Hash — Vincolo al dispositivo
5. Protezione contro gli abusi
6. Tracciamento e audit
7. Minacce coperte
8. Confronto tra i due sistemi

---

## 1. Panoramica del sistema

Le API esterne di Istanta2 servono due tipologie di consumatori distinte, ciascuna con il proprio meccanismo di autenticazione.

Le **integrazioni server-to-server** comunicano con le API dai propri server e si autenticano tramite **API Key**, una chiave crittografata custodita in modo sicuro nell'infrastruttura del client.

Lo **snippet** di Istanta2 e' un componente embeddato nelle pagine web di siti terzi che permette di visualizzare referenze e materiale POP. Poiche' lo snippet opera nel browser dell'utente finale, su siti non sotto il nostro controllo, non puo' contenere credenziali statiche. Per questo e' stato progettato il **token effimero**: lo snippet si autentica attraverso un protocollo di sfida crittografica e ottiene un token temporaneo, valido solo per pochi minuti, solo dal sito autorizzato, e solo dal browser che l'ha richiesto.

I due sistemi sono indipendenti: l'API Key non e' pensata per l'uso nel browser, e il token effimero non e' pensato per le chiamate server-to-server.

---

## 2. API Key — Chiamate server-to-server

L'API Key e' destinata ai sistemi esterni che comunicano con le API di Istanta2 dal proprio backend.

La chiave e' cifrata con algoritmo AES-256: senza la secret del server non e' possibile leggerla ne' falsificarne una. Ha una validita' massima di un anno, e' legata a un ruolo specifico nel database (il sistema sa sempre chi la sta usando), e puo' essere revocata immediatamente in caso di compromissione. Solo gli utenti autenticati interni alla piattaforma possono generarne di nuove.

La chiave deve essere custodita sul server del client e non deve mai essere esposta nel codice frontend o in ambienti non protetti.

---

## 3. Token Effimero — Sicurezza dello snippet

Il token effimero e' il meccanismo di autenticazione esclusivo dello **snippet**. E' stato progettato per risolvere il problema di autenticare un componente che opera nel browser, dove non e' possibile custodire segreti: qualsiasi credenziale statica nel codice sarebbe visibile e estraibile. Lo snippet non contiene e non necessita di alcuna chiave segreta.

Lo snippet ottiene un token attraverso un protocollo di sfida crittografica in due fasi. Nella prima fase il snippet dichiara al server da quale sito sta operando; il server verifica che il sito sia autorizzato e restituisce una sfida unica, valida 30 secondi e utilizzabile una sola volta. Nella seconda fase lo snippet risponde alla sfida fornendo anche un'impronta del browser; il server verifica tutto e, se corretto, emette un token firmato crittograficamente con validita' di 5 minuti. Alla scadenza, lo snippet ripete il protocollo in modo automatico e trasparente.

Il token e' sicuro perche':

- **Non richiede segreti nel browser**: l'autenticazione avviene tramite il protocollo di sfida, non tramite credenziali statiche.
- **Ha vita breve**: 5 minuti di validita' riducono drasticamente la finestra di rischio.
- **E' vincolato al sito**: non puo' essere usato da un sito diverso da quello autorizzato.
- **E' vincolato al browser**: non puo' essere usato da un dispositivo diverso da quello che l'ha ottenuto.
- **E' firmato crittograficamente**: qualsiasi tentativo di modifica lo invalida.
- **Ha permessi limitati**: contiene solo i permessi strettamente necessari per il sito che l'ha richiesto.
- **E' revocabile**: puo' essere invalidato in qualsiasi momento.

Se il token risulta usato da un sito o un browser diverso da quello originale, la richiesta viene bloccata immediatamente e l'evento viene registrato come possibile tentativo di attacco.

---

## 4. Browser Hash — Vincolo al dispositivo

Il browser hash e' un'impronta digitale del browser calcolata dallo snippet, che vincola il token a uno specifico dispositivo. Viene generata combinando quattro caratteristiche del browser (tipo e versione, lingua, fuso orario, risoluzione) in un hash irreversibile. Il server non conosce le singole caratteristiche: riceve solo l'hash, a tutela della privacy dell'utente.

L'impronta viene sigillata nel token al momento dell'emissione. Ad ogni richiesta lo snippet la ricalcola e il server la confronta con quella nel token: se non corrispondono, la richiesta viene rifiutata. Un attaccante che intercetta il token non puo' usarlo da un browser diverso, ne' puo' modificare l'impronta nel token senza invalidare la firma crittografica.

---

## 5. Protezione contro gli abusi

Il sistema applica **limiti di frequenza** su tre livelli (per indirizzo IP, per sito di origine, e per singolo token) per prevenire attacchi brute force e denial of service.

Una **whitelist delle origini** garantisce che solo i siti esplicitamente autorizzati possano utilizzare lo snippet. Per ogni sito vengono configurati i permessi concessi e i limiti di frequenza personalizzati. I siti non registrati vengono bloccati immediatamente.

**Controlli sul client** verificano che le richieste provengano da un browser legittimo, bloccando strumenti automatizzati (bot, crawler, client da linea di comando) e versioni obsolete dello snippet.

---

## 6. Tracciamento e audit

Ogni operazione relativa ai token effimeri viene registrata in un log di audit dedicato: sfide avviate e completate, token emessi e utilizzati, token scaduti o revocati, tentativi con impronta non corrispondente, e accessi da origini non autorizzate. Il log include origine, indirizzo IP, browser, esito e motivo dell'eventuale errore.

Questo permette di identificare tempestivamente tentativi di abuso, furti di token e pattern di attacco.

---

## 7. Minacce coperte

**Furto del token.** Un token intercettato e' di utilita' limitata: e' vincolato al browser e al sito originale (usarlo da un contesto diverso genera un blocco immediato), dura solo 5 minuti, e la comunicazione avviene esclusivamente su HTTPS.

**Attacchi replay.** Le sfide sono monouso e scadono in 30 secondi. Ogni token ha un identificativo univoco tracciato nel sistema, impedendo il riutilizzo.

**Brute force e denial of service.** I limiti di frequenza su tre livelli e il blocco degli strumenti automatizzati impediscono tentativi massivi.

**Falsificazione dell'origine.** Nei browser moderni l'origine e' impostata automaticamente e non puo' essere falsificata dal codice JavaScript.

**Compromissione dell'API Key.** La chiave e' cifrata, ha scadenza, ed e' revocabile. API Key e token effimero sono sistemi indipendenti: la compromissione dell'uno non coinvolge l'altro.

**Manomissione del token o dell'impronta.** Il token e' firmato crittograficamente: qualsiasi modifica a permessi, scadenza, origine o impronta del browser invalida la firma e causa il rifiuto della richiesta.

---

## 8. Confronto tra i due sistemi

| Caratteristica | API Key (server-to-server) | Token Effimero (snippet) |
|---|---|---|
| Destinazione | Server backend di terze parti | Snippet nel browser |
| Durata | 1 anno | 5 minuti |
| Credenziali nel client | Chiave custodita sul server | Nessun segreto nel browser |
| Vincolo al sito | No | Si' |
| Vincolo al browser | No | Si' |
| Permessi granulari | No | Si' |
| Limiti di frequenza dedicati | No | Si' |
| Audit dedicato | No | Si' |
| Revocabilita' | Manuale | Immediata |
| Protezione da replay | No | Si' |

---
