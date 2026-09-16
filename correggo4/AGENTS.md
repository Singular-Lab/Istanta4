# Regole locali di Correggo4

Si applica integralmente il protocollo dell'`AGENTS.md` nella root della suite.

## Ambito

Correggo4 è un'applicazione ASP.NET Core in `app/Correggo4` e usa storage persistente per i volantini e funzionalità native di elaborazione documenti.

## Verifica

- Esegui `dotnet build app/Correggo4/Correggo4.csproj -c Release` da questa cartella.
- Crea o aggiorna test automatici per endpoint, persistenza e trasformazioni modificate. Se manca un progetto di test adeguato, proponine la creazione nel pre-flight e mantienilo nel repository.
- Per modifiche a startup, ImageMagick/Ghostscript, filesystem o packaging, valida dalla root `docker build -f correggo4/Dockerfile correggo4`.
- Per test che scrivono file, usa una directory temporanea isolata e verifica il risultato senza alterare `storage` o dati persistenti esistenti.

Non eseguire migrazioni o operazioni distruttive su PostgreSQL reale. Non includere documenti o dati di produzione nelle fixture di test.
