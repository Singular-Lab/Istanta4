using System.Text.Json;
using System.Text.Json.Serialization;

namespace Correggo4.Ingestione;

// Struttura del JSON dentro un file .pack, ricostruita leggendo
// CorreggoWebPublisher/Worker.cs:121-178. I nomi dei campi sono quelli originali:
// il pacchetto arriva da fidelity-promotion e non possiamo rinominarli.

public class PacchettoCorreggoPerFP
{
    public CorreggoPromo? promo { get; set; }
    public List<CorreggoPagina>? pagine { get; set; }
    public List<CorreggoSchemaCampiDellaRef>? lista { get; set; }
}

public class CorreggoPromo
{
    public string? guidIdKitRuntime { get; set; }
    public string? guidIdPromo { get; set; }
    public int idLavorazioneIstanta { get; set; }
    // Commento originale (Worker.cs:133): "Nel mondo correggo e' l'accoppiata
    // CANALE_AREA + _DATA INIZIO PROMO (gg_MM_yy)"
    public string? titolo { get; set; }
    // Commento originale (Worker.cs:134): "Nel mondo correggo e' il titolo della promo"
    public string? classificatore { get; set; }
    public DateTime dataInizio { get; set; }
    public DateTime dataFine { get; set; }
    public DateTime dataScadenza { get; set; }
}

public class CorreggoPagina
{
    public byte numero { get; set; }
    public decimal[]? bounds { get; set; }   // [top, left, bottom, right]
}

public class CorreggoSchemaCampiDellaRef
{
    public string? boxName { get; set; }
    public string? itemRefStringfied { get; set; }   // JSON stringificato
    public decimal[]? bounds { get; set; }           // [top, left, bottom, right]
    public byte pag { get; set; }
    public List<CorreggoAzioneSullaRef>? azioni { get; set; }

    /// <summary>
    /// Tutto cio' che il pacchetto contiene e questa classe non nomina (11/9/2026). Prima andava
    /// perso: ImportatorePack salva lo schema con JsonSerializer.Serialize(rif), quindi solo le
    /// proprieta' dichiarate arrivavano in volantini_pagine_elementi.contenuto.
    /// </summary>
    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Altro { get; set; }
}

public class CorreggoAzioneSullaRef
{
    public int id { get; set; }
    public string? titolo { get; set; }
    public string? compiledValue { get; set; }
    public string? labelIndd { get; set; }
    public decimal[]? bounds { get; set; }

    /// <summary>
    /// Istruzioni a livello di campo (IstantaLib FicoTypes.Correggo_IstruzioneCampoDellaRef):
    /// quali campi l'Edit avanzato rende modificabili e con quali valori. Mancavano dall'ingestione
    /// fino all'11/9/2026: senza, la scheda non sa quali campi mostrare.
    /// </summary>
    public List<CorreggoIstruzioneCampoDellaRef>? istruzioni { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Altro { get; set; }
}

public class CorreggoIstruzioneCampoDellaRef
{
    public string? tipoDato { get; set; }        // "string" | "number" | "array" ...
    public string? field { get; set; }           // es. "prezzo_promo", "Descrizioni$Peso"
    // null: il valore lo mette l'utente; uno: va solo confermato; piu' d'uno: tendina.
    public string[]? valore { get; set; }
    public string? autocomplete { get; set; }
    public bool primary { get; set; }
    public int triggerActionId { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Altro { get; set; }
}

/// <summary>Un .pack decodificato: metadati, PDF e l'utente che l'ha depositato.</summary>
public sealed record ContenutoPack(PacchettoCorreggoPerFP Pacchetto, byte[] Pdf, short IdUtente);

public sealed class EsitoImportazione
{
    public bool Esito { get; set; }
    public string? Errore { get; set; }
    public int IdVolantino { get; set; }
    public string Titolo { get; set; } = "";
    public string Classificazione { get; set; } = "";
    public bool VolantinoCreato { get; set; }
    public short Versione { get; set; }
    public int Pagine { get; set; }
    public int Box { get; set; }
    public int Campi { get; set; }
    public List<string> Avvisi { get; } = new();
}
