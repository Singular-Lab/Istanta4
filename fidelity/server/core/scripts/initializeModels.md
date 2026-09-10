# Script di Inizializzazione Modelli Sequelize

## Descrizione Generale
Questo script CLI gestisce la sincronizzazione e la migrazione dei modelli Sequelize con il database. Offre diverse funzionalità per gestire lo schema del database in modo programmatico.

## Comandi Disponibili

### `sync`
Sincronizza tutti i modelli con il database.

**Opzioni:**
- `-f, --force`: Forza la ricreazione delle tabelle (CANCELLA I DATI!)
- `-a, --alter`: Permette modifiche alla struttura delle tabelle (default: true)
- `-l, --logging`: Abilita logging SQL dettagliato
- `-d, --drop`: Elimina tabelle prima di ricrearle

**Output:**
- Mostra un riepilogo con lo stato di sincronizzazione per ogni modello
- Indica il numero di successi/errori

### `status`
Mostra lo stato di sincronizzazione dei modelli.

**Output:**
- Numero totale di modelli
- Numero di modelli sincronizzati
- Data ultima sincronizzazione
- Lista dettagliata di tutti i modelli con stato

### `check`
Verifica la connessione al database.

**Output:**
- Conferma se la connessione è riuscita o meno

### `sync-db-objects`
Sincronizza oggetti DB custom (views, enums, etc) da file SQL.

**Funzionamento:**
1. Legge i file SQL dalla directory `db/definitions`
2. Esegue gli script SQL per creare/modificare oggetti database
3. Supporta i tipi: `enums`, `views`

**Output:**
- Riepilogo degli oggetti processati con successo/errori

### `model <nome>`
Sincronizza un singolo modello specifico.

**Opzioni:**
- `-f, --force`: Forza la ricreazione della tabella
- `-a, --alter`: Permette modifiche alla struttura (default: true)
- `-l, --logging`: Abilita logging SQL

### `migrate-lowercase`
Migra tutte le colonne da camelCase a lowercase.

**Opzioni:**
- `-d, --dry-run`: Simula la migrazione senza eseguirla
- `-v, --verify`: Verifica solo lo stato della migrazione
- `-r, --rollback`: Annulla la migrazione e ripristina le tabelle originali

**Processo:**
1. Crea nuove tabelle con colonne lowercase
2. Migra tutti i dati esistenti
3. Sostituisce le tabelle originali
4. Mantiene le tabelle originali come backup (_old)

### `verify-migration`
Verifica lo stato della migrazione lowercase.

## Dipendenze
- `commander`: Per la gestione della CLI
- `fs/promises`: Per la lettura dei file SQL
- `path`: Per la gestione dei percorsi
- `sequelize`: ORM per il database
- `Colorize` (custom): Per l'output colorato

## Utilizzo
```bash
# Sincronizza tutti i modelli
npm run initialize-models sync

# Mostra lo stato
npm run initialize-models status

# Migra a lowercase
npm run initialize-models migrate-lowercase
```

## Note Importanti
1. **Modalità FORCE**: Cancella tutti i dati esistenti nelle tabelle
2. **Migrazione lowercase**: Operazione irreversibile senza backup manuale
3. **Ambiente ES Modules**: Lo script usa `import/export` invece di `require`
4. **Logging**: L'output è colorato per migliorare la leggibilità

## Struttura Directory
- `db/definitions/`: Contiene gli script SQL per oggetti custom
- `db/definitions/migrations/`: Contiene gli script per la migrazione lowercase