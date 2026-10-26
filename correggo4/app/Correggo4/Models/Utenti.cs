using System;
using System.Collections.Generic;

namespace Correggo4.Models;

public partial class Utenti
{
    public short Id { get; set; }

    public string Nome { get; set; } = null!;

    public string Cognome { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string Username { get; set; } = null!;

    public string? Telefono { get; set; }

    public string? PswHash { get; set; }

    /// <summary>
    /// 1=GDO fa le correzioni, 2=Agenzia le legge e conferma
    /// </summary>
    public short Ruolo { get; set; }

    public bool IsSuperAdmin { get; set; }

    public bool Attivo { get; set; }

    public short? TipoUtenteFico { get; set; }

    public DateTime DataInserimento { get; set; }

    public DateTime? DataModifica { get; set; }

    public virtual ICollection<Notifiche> Notifiches { get; set; } = new List<Notifiche>();

    public virtual ICollection<UtentiPreferenze> UtentiPreferenzes { get; set; } = new List<UtentiPreferenze>();

    public virtual ICollection<VolantiniCorrezzioniMessaggistica> VolantiniCorrezzioniMessaggisticas { get; set; } = new List<VolantiniCorrezzioniMessaggistica>();

    public virtual ICollection<Volantini> VolantiniIdAutoreBloccoNavigations { get; set; } = new List<Volantini>();

    public virtual ICollection<Volantini> VolantiniIdAutoreNavigations { get; set; } = new List<Volantini>();

    public virtual ICollection<VolantiniPagineDisegniComposizioni> VolantiniPagineDisegniComposizioniIdAutoreNavigations { get; set; } = new List<VolantiniPagineDisegniComposizioni>();

    public virtual ICollection<VolantiniPagineDisegniComposizioni> VolantiniPagineDisegniComposizioniIdCorrettoreNavigations { get; set; } = new List<VolantiniPagineDisegniComposizioni>();

    public virtual ICollection<VolantiniPagineDisegniComposizioni> VolantiniPagineDisegniComposizioniIdRevisoreNavigations { get; set; } = new List<VolantiniPagineDisegniComposizioni>();

    public virtual ICollection<VolantiniPagineElementiVersioni> VolantiniPagineElementiVersionis { get; set; } = new List<VolantiniPagineElementiVersioni>();

    public virtual ICollection<VolantiniPagineElementi> VolantiniPagineElementis { get; set; } = new List<VolantiniPagineElementi>();

    public virtual ICollection<VolantiniPagineNote> VolantiniPagineNoteIdAutoreNavigations { get; set; } = new List<VolantiniPagineNote>();

    public virtual ICollection<VolantiniPagineNote> VolantiniPagineNoteIdCorrettoreNavigations { get; set; } = new List<VolantiniPagineNote>();

    public virtual ICollection<VolantiniPagineNote> VolantiniPagineNoteIdRevisoreNavigations { get; set; } = new List<VolantiniPagineNote>();

    public virtual ICollection<VolantiniPostit> VolantiniPostits { get; set; } = new List<VolantiniPostit>();

    public virtual ICollection<VolantiniPropagazioniElementi> VolantiniPropagazioniElementiIdAutoreNavigations { get; set; } = new List<VolantiniPropagazioniElementi>();

    public virtual ICollection<VolantiniPropagazioniElementi> VolantiniPropagazioniElementiIdCorrettoreNavigations { get; set; } = new List<VolantiniPropagazioniElementi>();

    public virtual ICollection<VolantiniPropagazioniElementi> VolantiniPropagazioniElementiIdRevisoreNavigations { get; set; } = new List<VolantiniPropagazioniElementi>();
}
