# Regole locali di Istanta

Si applica integralmente il protocollo dell'`AGENTS.md` nella root della suite.

## Ambito

Istanta è l'applicazione ASP.NET Core principale. Dipende direttamente da `../IstantaLib/IstantaLib/IstantaLib.csproj` e carica `AgenziaLib.dll` come artefatto runtime separato.

## Verifica

- Per una modifica mirata, esegui almeno `dotnet build Istanta.csproj -c Release` da questa cartella.
- Se cambia `IstantaLib`, verifica anche AgenziaLib secondo il relativo `AGENTS.md`.
- Se cambia il contratto di caricamento di AgenziaLib, verifica sia Istanta sia la produzione dell'artefatto `AgenziaLib.dll`.
- Crea o aggiorna test automatici per il comportamento modificato. Se manca un progetto di test adeguato, proponine la creazione nel pre-flight e mantienilo nel repository.
- Per modifiche a startup, dipendenze native o packaging, valida anche l'immagine dalla root con `docker build -f Istanta/Dockerfile .`.

Non usare database, Redis, filesystem o configurazioni cliente reali durante i test. Non considerare la sola compilazione sufficiente quando il comportamento può essere verificato automaticamente.
