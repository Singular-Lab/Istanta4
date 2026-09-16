# Regole locali di AgenziaLib

Si applica integralmente il protocollo dell'`AGENTS.md` nella root della suite.

## Ambito

AgenziaLib contiene il contratto `IAgenzia` e le implementazioni delle regole cliente. Dipende da IstantaLib ed è distribuita come file OCI `AgenziaLib.dll`, separatamente dall'immagine Istanta.

## Verifica

- Esegui `dotnet build AgenziaLib.csproj -c Release` da questa cartella.
- Per modifiche a `IAgenzia`, tipi condivisi o comportamento consumato da Istanta, verifica anche `dotnet build ../Istanta/Istanta.csproj -c Release`.
- Crea test deterministici per la specifica e il cliente interessati, includendo almeno il caso positivo e i casi limite pertinenti.
- Quando cambia una sola implementazione cliente, evita cambiamenti accidentali alle altre implementazioni.
- Se cambia il formato dell'artefatto o il caricamento runtime, valida dalla root il target di export previsto dal Dockerfile di Istanta.

Non inserire nei test dati, credenziali o configurazioni reali dei clienti. Una modifica alla sola AgenziaLib non deve forzare cambiamenti all'immagine Istanta senza una ragione tecnica approvata.
