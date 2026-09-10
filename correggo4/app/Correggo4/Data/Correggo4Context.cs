using System;
using System.Collections.Generic;
using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Data;

public partial class Correggo4Context : DbContext
{
    public Correggo4Context(DbContextOptions<Correggo4Context> options)
        : base(options)
    {
    }

    public virtual DbSet<DemoneActivity> DemoneActivities { get; set; }

    public virtual DbSet<Formati> Formatis { get; set; }

    public virtual DbSet<Notifiche> Notifiches { get; set; }

    public virtual DbSet<SettingsEmail> SettingsEmails { get; set; }

    public virtual DbSet<Utenti> Utentis { get; set; }

    public virtual DbSet<UtentiPreferenze> UtentiPreferenzes { get; set; }

    public virtual DbSet<Volantini> Volantinis { get; set; }

    public virtual DbSet<VolantiniCorrezzioniMessaggistica> VolantiniCorrezzioniMessaggisticas { get; set; }

    public virtual DbSet<VolantiniNotifiche> VolantiniNotifiches { get; set; }

    public virtual DbSet<VolantiniNotificheEmail> VolantiniNotificheEmails { get; set; }

    public virtual DbSet<VolantiniPagine> VolantiniPagines { get; set; }

    public virtual DbSet<VolantiniPagineDisegni> VolantiniPagineDisegnis { get; set; }

    public virtual DbSet<VolantiniPagineDisegniComposizioni> VolantiniPagineDisegniComposizionis { get; set; }

    public virtual DbSet<VolantiniPagineElementi> VolantiniPagineElementis { get; set; }

    public virtual DbSet<VolantiniPagineElementiVersioni> VolantiniPagineElementiVersionis { get; set; }

    public virtual DbSet<VolantiniPagineNote> VolantiniPagineNotes { get; set; }

    public virtual DbSet<VolantiniPostit> VolantiniPostits { get; set; }

    public virtual DbSet<VolantiniPropagazioni> VolantiniPropagazionis { get; set; }

    public virtual DbSet<VolantiniPropagazioniElementi> VolantiniPropagazioniElementis { get; set; }

    public virtual DbSet<VolantiniRevisione> VolantiniRevisiones { get; set; }

    public virtual DbSet<VolantiniVersioni> VolantiniVersionis { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DemoneActivity>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("demone_activity_pkey");

            entity.ToTable("demone_activity");

            entity.HasIndex(e => e.DataRegistrazione, "ix_demone_da_processare").HasFilter("(data_processo IS NULL)");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DataInizioProcesso).HasColumnName("data_inizio_processo");
            entity.Property(e => e.DataProcesso).HasColumnName("data_processo");
            entity.Property(e => e.DataRegistrazione)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_registrazione");
            entity.Property(e => e.Errore).HasColumnName("errore");
            entity.Property(e => e.IdDisegno).HasColumnName("id_disegno");
            entity.Property(e => e.IdElemento).HasColumnName("id_elemento");
            entity.Property(e => e.IdElementoPropagazione).HasColumnName("id_elemento_propagazione");
            entity.Property(e => e.IdNota).HasColumnName("id_nota");
            entity.Property(e => e.IdPropagazione).HasColumnName("id_propagazione");
            entity.Property(e => e.IdVol).HasColumnName("id_vol");
            entity.Property(e => e.TipoAzione).HasColumnName("tipo_azione");

            entity.HasOne(d => d.IdDisegnoNavigation).WithMany(p => p.DemoneActivities)
                .HasForeignKey(d => d.IdDisegno)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("demone_activity_id_disegno_fkey");

            entity.HasOne(d => d.IdElementoNavigation).WithMany(p => p.DemoneActivities)
                .HasForeignKey(d => d.IdElemento)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("demone_activity_id_elemento_fkey");

            entity.HasOne(d => d.IdElementoPropagazioneNavigation).WithMany(p => p.DemoneActivities)
                .HasForeignKey(d => d.IdElementoPropagazione)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("demone_activity_id_elemento_propagazione_fkey");

            entity.HasOne(d => d.IdNotaNavigation).WithMany(p => p.DemoneActivities)
                .HasForeignKey(d => d.IdNota)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("demone_activity_id_nota_fkey");

            entity.HasOne(d => d.IdPropagazioneNavigation).WithMany(p => p.DemoneActivities)
                .HasForeignKey(d => d.IdPropagazione)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("demone_activity_id_propagazione_fkey");

            entity.HasOne(d => d.IdVolNavigation).WithMany(p => p.DemoneActivities)
                .HasForeignKey(d => d.IdVol)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("demone_activity_id_vol_fkey");
        });

        modelBuilder.Entity<Formati>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("formati_pkey");

            entity.ToTable("formati");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Coefficiente)
                .HasPrecision(18, 2)
                .HasColumnName("coefficiente");
            entity.Property(e => e.Nome)
                .HasMaxLength(50)
                .HasColumnName("nome");
            entity.Property(e => e.WEsportazione)
                .HasPrecision(18, 2)
                .HasColumnName("w_esportazione");
            entity.Property(e => e.WReale)
                .HasPrecision(18, 2)
                .HasColumnName("w_reale");
        });

        modelBuilder.Entity<Notifiche>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("notifiche_pkey");

            entity.ToTable("notifiche");

            entity.HasIndex(e => new { e.IdUtente, e.Stato }, "ix_notifiche_da_leggere").HasFilter("(data_lettura IS NULL)");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DataLettura).HasColumnName("data_lettura");
            entity.Property(e => e.DataModifica).HasColumnName("data_modifica");
            entity.Property(e => e.DataRegistrazione)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_registrazione");
            entity.Property(e => e.IdDisegno).HasColumnName("id_disegno");
            entity.Property(e => e.IdNota).HasColumnName("id_nota");
            entity.Property(e => e.IdPropagazioneElemento).HasColumnName("id_propagazione_elemento");
            entity.Property(e => e.IdUtente).HasColumnName("id_utente");
            entity.Property(e => e.IdVolantino).HasColumnName("id_volantino");
            entity.Property(e => e.Stato).HasColumnName("stato");
            entity.Property(e => e.Tag)
                .HasMaxLength(20)
                .HasColumnName("tag");

            entity.HasOne(d => d.IdDisegnoNavigation).WithMany(p => p.Notifiches)
                .HasForeignKey(d => d.IdDisegno)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("notifiche_id_disegno_fkey");

            entity.HasOne(d => d.IdNotaNavigation).WithMany(p => p.Notifiches)
                .HasForeignKey(d => d.IdNota)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("notifiche_id_nota_fkey");

            entity.HasOne(d => d.IdPropagazioneElementoNavigation).WithMany(p => p.Notifiches)
                .HasForeignKey(d => d.IdPropagazioneElemento)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("notifiche_id_propagazione_elemento_fkey");

            entity.HasOne(d => d.IdUtenteNavigation).WithMany(p => p.Notifiches)
                .HasForeignKey(d => d.IdUtente)
                .HasConstraintName("notifiche_id_utente_fkey");

            entity.HasOne(d => d.IdVolantinoNavigation).WithMany(p => p.Notifiches)
                .HasForeignKey(d => d.IdVolantino)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("notifiche_id_volantino_fkey");
        });

        modelBuilder.Entity<SettingsEmail>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("settings_email_pkey");

            entity.ToTable("settings_email");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Email)
                .HasMaxLength(250)
                .HasColumnName("email");
            entity.Property(e => e.Materiale)
                .HasMaxLength(250)
                .HasColumnName("materiale");
            entity.Property(e => e.Stato)
                .HasDefaultValue((short)1)
                .HasColumnName("stato");
        });

        modelBuilder.Entity<Utenti>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("utenti_pkey");

            entity.ToTable("utenti");

            entity.HasIndex(e => e.Email, "utenti_email_key").IsUnique();

            entity.HasIndex(e => e.Username, "utenti_username_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Attivo)
                .HasDefaultValue(true)
                .HasColumnName("attivo");
            entity.Property(e => e.Cognome)
                .HasMaxLength(100)
                .HasColumnName("cognome");
            entity.Property(e => e.DataInserimento)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_inserimento");
            entity.Property(e => e.DataModifica).HasColumnName("data_modifica");
            entity.Property(e => e.Email)
                .HasMaxLength(150)
                .HasColumnName("email");
            entity.Property(e => e.IsSuperAdmin).HasColumnName("is_super_admin");
            entity.Property(e => e.Nome)
                .HasMaxLength(100)
                .HasColumnName("nome");
            entity.Property(e => e.PswHash).HasColumnName("psw_hash");
            entity.Property(e => e.Ruolo)
                .HasComment("1=GDO fa le correzioni, 2=Agenzia le legge e conferma")
                .HasColumnName("ruolo");
            entity.Property(e => e.Telefono)
                .HasMaxLength(100)
                .HasColumnName("telefono");
            entity.Property(e => e.TipoUtenteFico).HasColumnName("tipo_utente_fico");
            entity.Property(e => e.Username)
                .HasMaxLength(100)
                .HasColumnName("username");
        });

        modelBuilder.Entity<UtentiPreferenze>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("utenti_preferenze_pkey");

            entity.ToTable("utenti_preferenze");

            entity.HasIndex(e => new { e.IdUtente, e.DataSalvataggio }, "ix_utenti_preferenze_utente").IsDescending(false, true);

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Cartella)
                .HasMaxLength(80)
                .HasColumnName("cartella");
            entity.Property(e => e.DataSalvataggio)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_salvataggio");
            entity.Property(e => e.IdUtente).HasColumnName("id_utente");

            entity.HasOne(d => d.IdUtenteNavigation).WithMany(p => p.UtentiPreferenzes)
                .HasForeignKey(d => d.IdUtente)
                .HasConstraintName("utenti_preferenze_id_utente_fkey");
        });

        modelBuilder.Entity<Volantini>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_pkey");

            entity.ToTable("volantini");

            entity.HasIndex(e => new { e.Status, e.DataScadenza }, "ix_volantini_attivi");

            entity.HasIndex(e => e.GuidKitRuntime, "ix_volantini_kit_runtime").HasFilter("(guid_kit_runtime IS NOT NULL)");

            entity.HasIndex(e => e.IdPromoFp, "ix_volantini_promo_fp").HasFilter("(id_promo_fp IS NOT NULL)");

            entity.HasIndex(e => e.Titolo, "ix_volantini_titolo");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.AltezzaPagina)
                .HasPrecision(18, 2)
                .HasColumnName("altezza_pagina");
            entity.Property(e => e.Classificazione)
                .HasMaxLength(80)
                .HasColumnName("classificazione");
            entity.Property(e => e.CodaPubblicazione).HasColumnName("coda_pubblicazione");
            entity.Property(e => e.Contatore).HasColumnName("contatore");
            entity.Property(e => e.ContatoreConferme).HasColumnName("contatore_conferme");
            entity.Property(e => e.ContatoreRevisioni).HasColumnName("contatore_revisioni");
            entity.Property(e => e.DataPubblicazione).HasColumnName("data_pubblicazione");
            entity.Property(e => e.DataRegistrazioneBlocco).HasColumnName("data_registrazione_blocco");
            entity.Property(e => e.DataScadenza).HasColumnName("data_scadenza");
            entity.Property(e => e.DataScadenzaBlocco).HasColumnName("data_scadenza_blocco");
            entity.Property(e => e.DataValiditaFine).HasColumnName("data_validita_fine");
            entity.Property(e => e.DataValiditaInizio).HasColumnName("data_validita_inizio");
            entity.Property(e => e.Descrizione)
                .HasMaxLength(400)
                .HasColumnName("descrizione");
            entity.Property(e => e.GuidKitRuntime)
                .HasComment("guidIdKitRuntime: identifica la pubblicazione, torna indietro nella notifica di esito")
                .HasColumnName("guid_kit_runtime");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.IdAutoreBlocco).HasColumnName("id_autore_blocco");
            entity.Property(e => e.IdFormato).HasColumnName("id_formato");
            entity.Property(e => e.IdLavorazioneIstanta)
                .HasComment("idLavorazioneIstanta: aggancio alla lavorazione lato Istanta")
                .HasColumnName("id_lavorazione_istanta");
            entity.Property(e => e.IdPromoFp)
                .HasComment("guidIdPromo di fidelity-promotion")
                .HasColumnName("id_promo_fp");
            entity.Property(e => e.LarghezzaPagina)
                .HasPrecision(18, 2)
                .HasColumnName("larghezza_pagina");
            entity.Property(e => e.Margini)
                .HasMaxLength(500)
                .HasColumnName("margini");
            entity.Property(e => e.ProgressPubblicazione).HasColumnName("progress_pubblicazione");
            entity.Property(e => e.StatoPubblicazione).HasColumnName("stato_pubblicazione");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Titolo)
                .HasMaxLength(150)
                .HasColumnName("titolo");
            entity.Property(e => e.TotPubblicazioni).HasColumnName("tot_pubblicazioni");
            entity.Property(e => e.UltimaPubblicazione).HasColumnName("ultima_pubblicazione");
            entity.Property(e => e.UltimaVisita).HasColumnName("ultima_visita");

            entity.HasOne(d => d.IdAutoreNavigation).WithMany(p => p.VolantiniIdAutoreNavigations)
                .HasForeignKey(d => d.IdAutore)
                .HasConstraintName("volantini_id_autore_fkey");

            entity.HasOne(d => d.IdAutoreBloccoNavigation).WithMany(p => p.VolantiniIdAutoreBloccoNavigations)
                .HasForeignKey(d => d.IdAutoreBlocco)
                .HasConstraintName("volantini_id_autore_blocco_fkey");

            entity.HasOne(d => d.IdFormatoNavigation).WithMany(p => p.Volantinis)
                .HasForeignKey(d => d.IdFormato)
                .HasConstraintName("volantini_id_formato_fkey");
        });

        modelBuilder.Entity<VolantiniCorrezzioniMessaggistica>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_correzzioni_messaggistica_pkey");

            entity.ToTable("volantini_correzzioni_messaggistica");

            entity.HasIndex(e => e.IdDisegno, "ix_msg_disegno").HasFilter("(id_disegno IS NOT NULL)");

            entity.HasIndex(e => e.IdNota, "ix_msg_nota").HasFilter("(id_nota IS NOT NULL)");

            entity.HasIndex(e => e.IdPropagato, "ix_msg_propagato").HasFilter("(id_propagato IS NOT NULL)");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DataInvioEmail).HasColumnName("data_invio_email");
            entity.Property(e => e.DataInvioEmailProgrammata).HasColumnName("data_invio_email_programmata");
            entity.Property(e => e.DataRegistrazione)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_registrazione");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.IdDisegno).HasColumnName("id_disegno");
            entity.Property(e => e.IdNota).HasColumnName("id_nota");
            entity.Property(e => e.IdParent).HasColumnName("id_parent");
            entity.Property(e => e.IdPropagato).HasColumnName("id_propagato");
            entity.Property(e => e.Messaggio).HasColumnName("messaggio");
            entity.Property(e => e.Stato).HasColumnName("stato");
            entity.Property(e => e.Tags)
                .HasMaxLength(200)
                .HasColumnName("tags");

            entity.HasOne(d => d.IdAutoreNavigation).WithMany(p => p.VolantiniCorrezzioniMessaggisticas)
                .HasForeignKey(d => d.IdAutore)
                .HasConstraintName("volantini_correzzioni_messaggistica_id_autore_fkey");

            entity.HasOne(d => d.IdDisegnoNavigation).WithMany(p => p.VolantiniCorrezzioniMessaggisticas)
                .HasForeignKey(d => d.IdDisegno)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_correzzioni_messaggistica_id_disegno_fkey");

            entity.HasOne(d => d.IdNotaNavigation).WithMany(p => p.VolantiniCorrezzioniMessaggisticas)
                .HasForeignKey(d => d.IdNota)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_correzzioni_messaggistica_id_nota_fkey");

            entity.HasOne(d => d.IdParentNavigation).WithMany(p => p.InverseIdParentNavigation)
                .HasForeignKey(d => d.IdParent)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_correzzioni_messaggistica_id_parent_fkey");

            entity.HasOne(d => d.IdPropagatoNavigation).WithMany(p => p.VolantiniCorrezzioniMessaggisticas)
                .HasForeignKey(d => d.IdPropagato)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_correzzioni_messaggistica_id_propagato_fkey");
        });

        modelBuilder.Entity<VolantiniNotifiche>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_notifiche_pkey");

            entity.ToTable("volantini_notifiche");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DataUltimaCorrezione).HasColumnName("data_ultima_correzione");
            entity.Property(e => e.DataUltimaEmail).HasColumnName("data_ultima_email");
            entity.Property(e => e.IdVolantino).HasColumnName("id_volantino");

            entity.HasOne(d => d.IdVolantinoNavigation).WithMany(p => p.VolantiniNotifiches)
                .HasForeignKey(d => d.IdVolantino)
                .HasConstraintName("volantini_notifiche_id_volantino_fkey");
        });

        modelBuilder.Entity<VolantiniNotificheEmail>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_notifiche_email_pkey");

            entity.ToTable("volantini_notifiche_email");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DataInvio).HasColumnName("data_invio");
            entity.Property(e => e.IdNotifica).HasColumnName("id_notifica");
            entity.Property(e => e.Messaggio).HasColumnName("messaggio");
            entity.Property(e => e.Oggetto)
                .HasMaxLength(150)
                .HasColumnName("oggetto");

            entity.HasOne(d => d.IdNotificaNavigation).WithMany(p => p.VolantiniNotificheEmails)
                .HasForeignKey(d => d.IdNotifica)
                .HasConstraintName("volantini_notifiche_email_id_notifica_fkey");
        });

        modelBuilder.Entity<VolantiniPagine>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_pagine_pkey");

            entity.ToTable("volantini_pagine");

            entity.HasIndex(e => e.IdVersione, "ix_pagine_versione");

            entity.HasIndex(e => new { e.IdVol, e.Numero, e.Versione }, "volantini_pagine_id_vol_numero_versione_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Altezza)
                .HasPrecision(18, 2)
                .HasColumnName("altezza");
            entity.Property(e => e.Alto)
                .HasPrecision(18, 2)
                .HasColumnName("alto");
            entity.Property(e => e.Contatore).HasColumnName("contatore");
            entity.Property(e => e.ContatoreConferme).HasColumnName("contatore_conferme");
            entity.Property(e => e.DataVersione)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_versione");
            entity.Property(e => e.IdVersione).HasColumnName("id_versione");
            entity.Property(e => e.IdVol).HasColumnName("id_vol");
            entity.Property(e => e.Larghezza)
                .HasPrecision(18, 2)
                .HasColumnName("larghezza");
            entity.Property(e => e.MargineEsterno)
                .HasPrecision(18, 2)
                .HasColumnName("margine_esterno");
            entity.Property(e => e.Mastro)
                .HasMaxLength(80)
                .HasColumnName("mastro");
            entity.Property(e => e.Numero).HasColumnName("numero");
            entity.Property(e => e.Path)
                .HasMaxLength(200)
                .HasColumnName("path");
            entity.Property(e => e.PathFisico)
                .HasMaxLength(250)
                .HasColumnName("path_fisico");
            entity.Property(e => e.RapportoX)
                .HasPrecision(18, 2)
                .HasColumnName("rapporto_x");
            entity.Property(e => e.RapportoY)
                .HasPrecision(18, 2)
                .HasColumnName("rapporto_y");
            entity.Property(e => e.Sinistra)
                .HasPrecision(18, 2)
                .HasColumnName("sinistra");
            entity.Property(e => e.Stato).HasColumnName("stato");
            entity.Property(e => e.UltimaVisita).HasColumnName("ultima_visita");
            entity.Property(e => e.UltimoAggiornamento).HasColumnName("ultimo_aggiornamento");
            entity.Property(e => e.Versione).HasColumnName("versione");

            entity.HasOne(d => d.IdVersioneNavigation).WithMany(p => p.VolantiniPagines)
                .HasForeignKey(d => d.IdVersione)
                .HasConstraintName("volantini_pagine_id_versione_fkey");

            entity.HasOne(d => d.IdVolNavigation).WithMany(p => p.VolantiniPagines)
                .HasForeignKey(d => d.IdVol)
                .HasConstraintName("volantini_pagine_id_vol_fkey");
        });

        modelBuilder.Entity<VolantiniPagineDisegni>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_pagine_disegni_pkey");

            entity.ToTable("volantini_pagine_disegni");

            entity.HasIndex(e => e.IdGruppo, "ix_disegni_gruppo");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.IdGruppo).HasColumnName("id_gruppo");
            entity.Property(e => e.Vectors).HasColumnName("vectors");

            entity.HasOne(d => d.IdGruppoNavigation).WithMany(p => p.VolantiniPagineDisegnis)
                .HasForeignKey(d => d.IdGruppo)
                .HasConstraintName("volantini_pagine_disegni_id_gruppo_fkey");
        });

        modelBuilder.Entity<VolantiniPagineDisegniComposizioni>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_pagine_disegni_composizioni_pkey");

            entity.ToTable("volantini_pagine_disegni_composizioni");

            entity.HasIndex(e => e.IdElemento, "ix_disegni_comp_elemento").HasFilter("(id_elemento IS NOT NULL)");

            entity.HasIndex(e => e.IdPagina, "ix_disegni_comp_pagina");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Border).HasColumnName("border");
            entity.Property(e => e.Color)
                .HasMaxLength(50)
                .HasColumnName("color");
            entity.Property(e => e.DataCorrezione).HasColumnName("data_correzione");
            entity.Property(e => e.DataInserimento)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_inserimento");
            entity.Property(e => e.DataRevisione).HasColumnName("data_revisione");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.IdCorrettore).HasColumnName("id_correttore");
            entity.Property(e => e.IdElemento).HasColumnName("id_elemento");
            entity.Property(e => e.IdPagina).HasColumnName("id_pagina");
            entity.Property(e => e.IdRevisore).HasColumnName("id_revisore");
            entity.Property(e => e.Simbolo)
                .HasMaxLength(40)
                .HasColumnName("simbolo");
            entity.Property(e => e.Stato).HasColumnName("stato");

            entity.HasOne(d => d.IdAutoreNavigation).WithMany(p => p.VolantiniPagineDisegniComposizioniIdAutoreNavigations)
                .HasForeignKey(d => d.IdAutore)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("volantini_pagine_disegni_composizioni_id_autore_fkey");

            entity.HasOne(d => d.IdCorrettoreNavigation).WithMany(p => p.VolantiniPagineDisegniComposizioniIdCorrettoreNavigations)
                .HasForeignKey(d => d.IdCorrettore)
                .HasConstraintName("volantini_pagine_disegni_composizioni_id_correttore_fkey");

            entity.HasOne(d => d.IdElementoNavigation).WithMany(p => p.VolantiniPagineDisegniComposizionis)
                .HasForeignKey(d => d.IdElemento)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_pagine_disegni_composizioni_id_elemento_fkey");

            entity.HasOne(d => d.IdPaginaNavigation).WithMany(p => p.VolantiniPagineDisegniComposizionis)
                .HasForeignKey(d => d.IdPagina)
                .HasConstraintName("volantini_pagine_disegni_composizioni_id_pagina_fkey");

            entity.HasOne(d => d.IdRevisoreNavigation).WithMany(p => p.VolantiniPagineDisegniComposizioniIdRevisoreNavigations)
                .HasForeignKey(d => d.IdRevisore)
                .HasConstraintName("volantini_pagine_disegni_composizioni_id_revisore_fkey");
        });

        modelBuilder.Entity<VolantiniPagineElementi>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_pagine_elementi_pkey");

            entity.ToTable("volantini_pagine_elementi");

            entity.HasIndex(e => e.Basecode, "ix_elementi_basecode").HasFilter("(id_parent IS NULL)");

            entity.HasIndex(e => e.IdPagina, "ix_elementi_pagina");

            entity.HasIndex(e => e.IdParent, "ix_elementi_parent").HasFilter("(id_parent IS NOT NULL)");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Altezza)
                .HasPrecision(18, 2)
                .HasColumnName("altezza");
            entity.Property(e => e.Basecode)
                .HasMaxLength(3000)
                .HasDefaultValueSql("''::character varying")
                .HasColumnName("basecode");
            entity.Property(e => e.Contatore).HasColumnName("contatore");
            entity.Property(e => e.ContatoreConferme).HasColumnName("contatore_conferme");
            entity.Property(e => e.Contenuto)
                .HasDefaultValueSql("''::text")
                .HasColumnName("contenuto");
            entity.Property(e => e.DataOk).HasColumnName("data_ok");
            entity.Property(e => e.Dna)
                .HasColumnType("jsonb")
                .HasColumnName("dna");
            entity.Property(e => e.IdAutoreOk).HasColumnName("id_autore_ok");
            entity.Property(e => e.IdPagina).HasColumnName("id_pagina");
            entity.Property(e => e.IdParent).HasColumnName("id_parent");
            entity.Property(e => e.LabelInd)
                .HasMaxLength(150)
                .HasDefaultValueSql("''::character varying")
                .HasColumnName("label_ind");
            entity.Property(e => e.Larghezza)
                .HasPrecision(18, 2)
                .HasColumnName("larghezza");
            entity.Property(e => e.PosizioneX)
                .HasPrecision(18, 2)
                .HasColumnName("posizione_x");
            entity.Property(e => e.PosizioneY)
                .HasPrecision(18, 2)
                .HasColumnName("posizione_y");
            entity.Property(e => e.Stato).HasColumnName("stato");
            entity.Property(e => e.Tipo).HasColumnName("tipo");
            entity.Property(e => e.UltimoCambiamento).HasColumnName("ultimo_cambiamento");
            entity.Property(e => e.ZIndex).HasColumnName("z_index");

            entity.HasOne(d => d.IdAutoreOkNavigation).WithMany(p => p.VolantiniPagineElementis)
                .HasForeignKey(d => d.IdAutoreOk)
                .HasConstraintName("volantini_pagine_elementi_id_autore_ok_fkey");

            entity.HasOne(d => d.IdPaginaNavigation).WithMany(p => p.VolantiniPagineElementis)
                .HasForeignKey(d => d.IdPagina)
                .HasConstraintName("volantini_pagine_elementi_id_pagina_fkey");

            entity.HasOne(d => d.IdParentNavigation).WithMany(p => p.InverseIdParentNavigation)
                .HasForeignKey(d => d.IdParent)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_pagine_elementi_id_parent_fkey");
        });

        modelBuilder.Entity<VolantiniPagineElementiVersioni>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_pagine_elementi_versioni_pkey");

            entity.ToTable("volantini_pagine_elementi_versioni");

            entity.HasIndex(e => e.IdElemento, "ix_elementi_versioni_elemento");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DataModifica)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_modifica");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.IdElemento).HasColumnName("id_elemento");
            entity.Property(e => e.IdElementoPropagazione).HasColumnName("id_elemento_propagazione");
            entity.Property(e => e.IdPagina).HasColumnName("id_pagina");
            entity.Property(e => e.NewHeight)
                .HasPrecision(18, 2)
                .HasColumnName("new_height");
            entity.Property(e => e.NewPosx)
                .HasPrecision(18, 2)
                .HasColumnName("new_posx");
            entity.Property(e => e.NewPosy)
                .HasPrecision(18, 2)
                .HasColumnName("new_posy");
            entity.Property(e => e.NewWidth)
                .HasPrecision(18, 2)
                .HasColumnName("new_width");
            entity.Property(e => e.NuovaVersione).HasColumnName("nuova_versione");
            entity.Property(e => e.Stato).HasColumnName("stato");

            entity.HasOne(d => d.IdAutoreNavigation).WithMany(p => p.VolantiniPagineElementiVersionis)
                .HasForeignKey(d => d.IdAutore)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("volantini_pagine_elementi_versioni_id_autore_fkey");

            entity.HasOne(d => d.IdElementoNavigation).WithMany(p => p.VolantiniPagineElementiVersionis)
                .HasForeignKey(d => d.IdElemento)
                .HasConstraintName("volantini_pagine_elementi_versioni_id_elemento_fkey");

            entity.HasOne(d => d.IdElementoPropagazioneNavigation).WithMany(p => p.VolantiniPagineElementiVersionis)
                .HasForeignKey(d => d.IdElementoPropagazione)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_elementi_versioni_propagazione");

            entity.HasOne(d => d.IdPaginaNavigation).WithMany(p => p.VolantiniPagineElementiVersionis)
                .HasForeignKey(d => d.IdPagina)
                .HasConstraintName("volantini_pagine_elementi_versioni_id_pagina_fkey");
        });

        modelBuilder.Entity<VolantiniPagineNote>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_pagine_note_pkey");

            entity.ToTable("volantini_pagine_note");

            entity.HasIndex(e => e.IdElemento, "ix_note_elemento").HasFilter("(id_elemento IS NOT NULL)");

            entity.HasIndex(e => e.IdPagina, "ix_note_pagina");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.AllegatoKey).HasColumnName("allegato_key");
            entity.Property(e => e.DataCorrezione).HasColumnName("data_correzione");
            entity.Property(e => e.DataInserimento)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_inserimento");
            entity.Property(e => e.DataModifica).HasColumnName("data_modifica");
            entity.Property(e => e.DataRevisione).HasColumnName("data_revisione");
            entity.Property(e => e.Descrizione).HasColumnName("descrizione");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.IdCorrettore).HasColumnName("id_correttore");
            entity.Property(e => e.IdElemento).HasColumnName("id_elemento");
            entity.Property(e => e.IdPagina).HasColumnName("id_pagina");
            entity.Property(e => e.IdRevisore).HasColumnName("id_revisore");
            entity.Property(e => e.Posx).HasColumnName("posx");
            entity.Property(e => e.Posy).HasColumnName("posy");
            entity.Property(e => e.RefLabel)
                .HasMaxLength(50)
                .HasColumnName("ref_label");
            entity.Property(e => e.RefRegion)
                .HasMaxLength(50)
                .HasColumnName("ref_region");
            entity.Property(e => e.Stato).HasColumnName("stato");
            entity.Property(e => e.Tipo).HasColumnName("tipo");

            entity.HasOne(d => d.IdAutoreNavigation).WithMany(p => p.VolantiniPagineNoteIdAutoreNavigations)
                .HasForeignKey(d => d.IdAutore)
                .HasConstraintName("volantini_pagine_note_id_autore_fkey");

            entity.HasOne(d => d.IdCorrettoreNavigation).WithMany(p => p.VolantiniPagineNoteIdCorrettoreNavigations)
                .HasForeignKey(d => d.IdCorrettore)
                .HasConstraintName("volantini_pagine_note_id_correttore_fkey");

            entity.HasOne(d => d.IdElementoNavigation).WithMany(p => p.VolantiniPagineNotes)
                .HasForeignKey(d => d.IdElemento)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_pagine_note_id_elemento_fkey");

            entity.HasOne(d => d.IdPaginaNavigation).WithMany(p => p.VolantiniPagineNotes)
                .HasForeignKey(d => d.IdPagina)
                .HasConstraintName("volantini_pagine_note_id_pagina_fkey");

            entity.HasOne(d => d.IdRevisoreNavigation).WithMany(p => p.VolantiniPagineNoteIdRevisoreNavigations)
                .HasForeignKey(d => d.IdRevisore)
                .HasConstraintName("volantini_pagine_note_id_revisore_fkey");
        });

        modelBuilder.Entity<VolantiniPostit>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_postit_pkey");

            entity.ToTable("volantini_postit");

            entity.HasIndex(e => new { e.IdVolantino, e.VersioneVol }, "ix_postit_volantino");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DataRegistrazione)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_registrazione");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.IdVolantino).HasColumnName("id_volantino");
            entity.Property(e => e.Messaggio)
                .HasMaxLength(500)
                .HasColumnName("messaggio");
            entity.Property(e => e.Stato).HasColumnName("stato");
            entity.Property(e => e.VersioneVol).HasColumnName("versione_vol");

            entity.HasOne(d => d.IdAutoreNavigation).WithMany(p => p.VolantiniPostits)
                .HasForeignKey(d => d.IdAutore)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("volantini_postit_id_autore_fkey");

            entity.HasOne(d => d.IdVolantinoNavigation).WithMany(p => p.VolantiniPostits)
                .HasForeignKey(d => d.IdVolantino)
                .HasConstraintName("volantini_postit_id_volantino_fkey");
        });

        modelBuilder.Entity<VolantiniPropagazioni>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_propagazioni_pkey");

            entity.ToTable("volantini_propagazioni");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Attivo)
                .HasDefaultValue((short)1)
                .HasColumnName("attivo");
            entity.Property(e => e.DataRegistrazione)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_registrazione");
            entity.Property(e => e.DataVisto).HasColumnName("data_visto");
            entity.Property(e => e.IdDisegnoMaster).HasColumnName("id_disegno_master");
            entity.Property(e => e.IdNotaMaster).HasColumnName("id_nota_master");
            entity.Property(e => e.Visto).HasColumnName("visto");

            entity.HasOne(d => d.IdDisegnoMasterNavigation).WithMany(p => p.VolantiniPropagazionis)
                .HasForeignKey(d => d.IdDisegnoMaster)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_propagazioni_id_disegno_master_fkey");

            entity.HasOne(d => d.IdNotaMasterNavigation).WithMany(p => p.VolantiniPropagazionis)
                .HasForeignKey(d => d.IdNotaMaster)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("volantini_propagazioni_id_nota_master_fkey");
        });

        modelBuilder.Entity<VolantiniPropagazioniElementi>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_propagazioni_elementi_pkey");

            entity.ToTable("volantini_propagazioni_elementi");

            entity.HasIndex(e => e.IdElemento, "ix_prop_elementi_elemento");

            entity.HasIndex(e => new { e.IdPropagazione, e.IdElemento }, "volantini_propagazioni_elementi_id_propagazione_id_elemento_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.Attivo)
                .HasDefaultValue(true)
                .HasColumnName("attivo");
            entity.Property(e => e.DataAttivazione).HasColumnName("data_attivazione");
            entity.Property(e => e.DataCorrezione).HasColumnName("data_correzione");
            entity.Property(e => e.DataRevisione).HasColumnName("data_revisione");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.IdCorrettore).HasColumnName("id_correttore");
            entity.Property(e => e.IdElemento).HasColumnName("id_elemento");
            entity.Property(e => e.IdPropagazione).HasColumnName("id_propagazione");
            entity.Property(e => e.IdRevisore).HasColumnName("id_revisore");
            entity.Property(e => e.Stato).HasColumnName("stato");

            entity.HasOne(d => d.IdAutoreNavigation).WithMany(p => p.VolantiniPropagazioniElementiIdAutoreNavigations)
                .HasForeignKey(d => d.IdAutore)
                .HasConstraintName("volantini_propagazioni_elementi_id_autore_fkey");

            entity.HasOne(d => d.IdCorrettoreNavigation).WithMany(p => p.VolantiniPropagazioniElementiIdCorrettoreNavigations)
                .HasForeignKey(d => d.IdCorrettore)
                .HasConstraintName("volantini_propagazioni_elementi_id_correttore_fkey");

            entity.HasOne(d => d.IdElementoNavigation).WithMany(p => p.VolantiniPropagazioniElementis)
                .HasForeignKey(d => d.IdElemento)
                .HasConstraintName("volantini_propagazioni_elementi_id_elemento_fkey");

            entity.HasOne(d => d.IdPropagazioneNavigation).WithMany(p => p.VolantiniPropagazioniElementis)
                .HasForeignKey(d => d.IdPropagazione)
                .HasConstraintName("volantini_propagazioni_elementi_id_propagazione_fkey");

            entity.HasOne(d => d.IdRevisoreNavigation).WithMany(p => p.VolantiniPropagazioniElementiIdRevisoreNavigations)
                .HasForeignKey(d => d.IdRevisore)
                .HasConstraintName("volantini_propagazioni_elementi_id_revisore_fkey");
        });

        modelBuilder.Entity<VolantiniRevisione>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_revisione_pkey");

            entity.ToTable("volantini_revisione");

            entity.HasIndex(e => e.IdVolantino, "ix_revisione_volantino");

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.CorrezioniKey).HasColumnName("correzioni_key");
            entity.Property(e => e.DataEsportazione)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_esportazione");
            entity.Property(e => e.DataRicezione).HasColumnName("data_ricezione");
            entity.Property(e => e.IdVolantino).HasColumnName("id_volantino");
            entity.Property(e => e.PdfKey).HasColumnName("pdf_key");

            entity.HasOne(d => d.IdVolantinoNavigation).WithMany(p => p.VolantiniRevisiones)
                .HasForeignKey(d => d.IdVolantino)
                .HasConstraintName("volantini_revisione_id_volantino_fkey");
        });

        modelBuilder.Entity<VolantiniVersioni>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_versioni_pkey");

            entity.ToTable("volantini_versioni");

            entity.HasIndex(e => new { e.IdVol, e.Versione }, "volantini_versioni_id_vol_versione_key").IsUnique();

            entity.Property(e => e.Id)
                .UseIdentityAlwaysColumn()
                .HasColumnName("id");
            entity.Property(e => e.DaRevocare)
                .HasComment("Sostituisce il \"versione = 0\" dell'originale (vedi RevocaVersioneVol)")
                .HasColumnName("da_revocare");
            entity.Property(e => e.DataChiusura).HasColumnName("data_chiusura");
            entity.Property(e => e.DataPubblicazione)
                .HasDefaultValueSql("now()")
                .HasColumnName("data_pubblicazione");
            entity.Property(e => e.IdVol).HasColumnName("id_vol");
            entity.Property(e => e.Versione).HasColumnName("versione");

            entity.HasOne(d => d.IdVolNavigation).WithMany(p => p.VolantiniVersionis)
                .HasForeignKey(d => d.IdVol)
                .HasConstraintName("volantini_versioni_id_vol_fkey");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
