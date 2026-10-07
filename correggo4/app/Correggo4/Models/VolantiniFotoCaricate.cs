namespace Correggo4.Models;

/// <summary>
/// Foto caricate dall'editor con "Carica nuova foto" (j217) e mandate a Olimpo. Istanta non le conosce
/// ancora: le crea sull'articolo alla conferma dell'Agenzia, usando nome file e md5 registrati qui
/// (FicoProcessController.correggiFotoESelezioniFromCorreggo, ramo "altrimenti la genero").
/// Serve anche come prova che quella foto e' stata caricata davvero da Correggo, per quel prodotto.
/// </summary>
public partial class VolantiniFotoCaricate
{
    public long Id { get; set; }
    /// <summary>Box radice (volantini_pagine_elementi.id) su cui si stava lavorando.</summary>
    public long IdElemento { get; set; }
    /// <summary>Codice della referenza a cui la foto e' destinata.</summary>
    public string Codice { get; set; } = null!;
    /// <summary>Guid della foto in archivio Olimpo.</summary>
    public string GuidId { get; set; } = null!;
    public string NomeFile { get; set; } = null!;
    public string Md5 { get; set; } = null!;
    public short? IdAutore { get; set; }
    public DateTime DataCaricamento { get; set; }
}
