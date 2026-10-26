using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class Volantini
{
    public int Id { get; set; }

    public string Titolo { get; set; } = null!;

    public string? Descrizione { get; set; }

    public string Classificazione { get; set; } = null!;

    /// <summary>
    /// guidIdPromo di fidelity-promotion
    /// </summary>
    public Guid? IdPromoFp { get; set; }

    public short? IdFormato { get; set; }

    public decimal? LarghezzaPagina { get; set; }

    public decimal? AltezzaPagina { get; set; }

    public string? Margini { get; set; }

    public short? IdAutore { get; set; }

    public DateTime? DataPubblicazione { get; set; }

    public DateTime? UltimaPubblicazione { get; set; }

    public short TotPubblicazioni { get; set; }

    public short Status { get; set; }

    public short StatoPubblicazione { get; set; }

    public short CodaPubblicazione { get; set; }

    public short ProgressPubblicazione { get; set; }

    public DateTime DataValiditaInizio { get; set; }

    public DateTime DataValiditaFine { get; set; }

    public DateTime DataScadenza { get; set; }

    public DateTime? UltimaVisita { get; set; }

    public short? IdAutoreBlocco { get; set; }

    public DateTime? DataRegistrazioneBlocco { get; set; }

    public DateTime? DataScadenzaBlocco { get; set; }

    public short Contatore { get; set; }

    public short ContatoreConferme { get; set; }

    public short ContatoreRevisioni { get; set; }

    /// <summary>
    /// guidIdKitRuntime: identifica la pubblicazione, torna indietro nella notifica di esito
    /// </summary>
    public Guid? GuidKitRuntime { get; set; }

    /// <summary>
    /// idLavorazioneIstanta: aggancio alla lavorazione lato Istanta
    /// </summary>
    public int? IdLavorazioneIstanta { get; set; }

    public virtual ICollection<DemoneActivity> DemoneActivities { get; set; } = new List<DemoneActivity>();

    public virtual Utenti? IdAutoreBloccoNavigation { get; set; }

    public virtual Utenti? IdAutoreNavigation { get; set; }

    public virtual Formati? IdFormatoNavigation { get; set; }

    public virtual ICollection<Notifiche> Notifiches { get; set; } = new List<Notifiche>();

    public virtual ICollection<VolantiniNotifiche> VolantiniNotifiches { get; set; } = new List<VolantiniNotifiche>();

    public virtual ICollection<VolantiniPagine> VolantiniPagines { get; set; } = new List<VolantiniPagine>();

    public virtual ICollection<VolantiniPostit> VolantiniPostits { get; set; } = new List<VolantiniPostit>();

    public virtual ICollection<VolantiniRevisione> VolantiniRevisiones { get; set; } = new List<VolantiniRevisione>();

    public virtual ICollection<VolantiniVersioni> VolantiniVersionis { get; set; } = new List<VolantiniVersioni>();
}
