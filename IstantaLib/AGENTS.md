# Regole locali di IstantaLib

Si applica integralmente il protocollo dell'`AGENTS.md` nella root della suite.

## Ambito e impatto

IstantaLib è una libreria condivisa. Ogni modifica ai suoi tipi pubblici o al suo comportamento può influire sia su Istanta sia su AgenziaLib.

## Verifica

- Esegui `dotnet build IstantaLib/IstantaLib.csproj -c Release` da questa cartella.
- Esegui inoltre `dotnet build ../Istanta/Istanta.csproj -c Release`.
- Esegui inoltre `dotnet build ../AgenziaLib/AgenziaLib.csproj -c Release`.
- Crea test nella soluzione più vicina al comportamento modificato; per contratti pubblici copri compatibilità, valori nulli, serializzazione e casi limite pertinenti.
- Cerca tutti i consumatori prima di rinominare o cambiare firme, DTO, enum, serializzazione o semantica dei valori.

Non introdurre dipendenze specifiche di un'applicazione o di un cliente in una API condivisa senza averlo dichiarato nel pre-flight.
