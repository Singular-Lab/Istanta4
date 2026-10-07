using Correggo4.Models;
using Microsoft.EntityFrameworkCore;

namespace Correggo4.Data;

// Tabelle aggiunte a mano dopo lo scaffold (j209, j217): qui, cosi' un nuovo scaffold di
// Correggo4Context.cs non le cancella. OnModelCreatingPartial e' il gancio che lo scaffold lascia
// apposta, e puo' stare in un solo file: le nuove tabelle si aggiungono qui dentro.
public partial class Correggo4Context
{
    public virtual DbSet<VolantiniFinestreCategory> VolantiniFinestreCategories { get; set; }

    public virtual DbSet<VolantiniFotoCaricate> VolantiniFotoCaricates { get; set; }

    public virtual DbSet<UtentiPolicy> UtentiPolicies { get; set; }

    public virtual DbSet<VolantiniCommenti> VolantiniCommentis { get; set; }

    /// <summary>j243: le impostazioni per utente (oggi solo le email di notifica).</summary>
    public virtual DbSet<UtentiImpostazioni> Impostazioni { get; set; }

    // ---- j251: il TIMONE (piano di rimpaginazione del Marketing). Tabelle tutte nuove: il piano
    // e' uno strato a parte e non tocca mai i box veri. Vedi claude/timone-specifica.md.
    public virtual DbSet<VolantiniTimone> Timoni { get; set; }

    public virtual DbSet<VolantiniTimonePagine> TimonePagine { get; set; }

    public virtual DbSet<VolantiniTimoneVoci> TimoneVoci { get; set; }

    public virtual DbSet<VolantiniTimoneFinestre> TimoneFinestre { get; set; }

    /// <summary>j279: le caselle bloccate, dove non deve andare nessuna referenza.</summary>
    public virtual DbSet<VolantiniTimoneBlocchi> TimoneBlocchi { get; set; }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<VolantiniFinestreCategory>(entity =>
        {
            entity.HasKey(e => e.Classificazione).HasName("volantini_finestre_category_pkey");
            entity.ToTable("volantini_finestre_category");
            entity.Property(e => e.Classificazione).HasColumnName("classificazione");
            entity.Property(e => e.DataInizio).HasColumnName("data_inizio");
            entity.Property(e => e.DataFine).HasColumnName("data_fine");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.DataModifica).HasDefaultValueSql("now()").HasColumnName("data_modifica");
        });

        // j217: foto caricate da "Carica nuova foto" verso Olimpo
        modelBuilder.Entity<VolantiniFotoCaricate>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_foto_caricate_pkey");
            entity.ToTable("volantini_foto_caricate");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.IdElemento).HasColumnName("id_elemento");
            entity.Property(e => e.Codice).HasColumnName("codice");
            entity.Property(e => e.GuidId).HasColumnName("guid_id");
            entity.Property(e => e.NomeFile).HasColumnName("nome_file");
            entity.Property(e => e.Md5).HasColumnName("md5");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.DataCaricamento).HasDefaultValueSql("now()").HasColumnName("data_caricamento");
        });

        // j235: la policy di correzione per utente (il file policy/<id>.json dell'originale)
        modelBuilder.Entity<UtentiPolicy>(entity =>
        {
            entity.HasKey(e => e.IdUtente).HasName("utenti_policy_pkey");
            entity.ToTable("utenti_policy");
            entity.Property(e => e.IdUtente).HasColumnName("id_utente");
            entity.Property(e => e.Policy).HasColumnType("jsonb").HasColumnName("policy");
            entity.Property(e => e.Nota).HasColumnName("nota");
            entity.Property(e => e.DataModifica).HasDefaultValueSql("now()").HasColumnName("data_modifica");
        });

        // j241: i commenti generici di un volantino (bottone "Commenti" della home)
        modelBuilder.Entity<VolantiniCommenti>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_commenti_pkey");
            entity.ToTable("volantini_commenti");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.IdVol).HasColumnName("id_vol");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.Testo).HasColumnName("testo");
            entity.Property(e => e.Data).HasDefaultValueSql("now()").HasColumnName("data");
        });

        // j243: le impostazioni per utente (interruttore delle email di notifica)
        modelBuilder.Entity<UtentiImpostazioni>(entity =>
        {
            entity.HasKey(e => e.IdUtente).HasName("utenti_impostazioni_pkey");
            entity.ToTable("utenti_impostazioni");
            entity.Property(e => e.IdUtente).ValueGeneratedNever().HasColumnName("id_utente");
            entity.Property(e => e.EmailNotifiche).HasDefaultValue(true).HasColumnName("email_notifiche");
            entity.Property(e => e.DataModifica).HasDefaultValueSql("now()").HasColumnName("data_modifica");
            entity.HasOne(e => e.IdUtenteNavigation).WithMany()
                  .HasForeignKey(e => e.IdUtente)
                  .OnDelete(DeleteBehavior.Cascade)
                  .HasConstraintName("utenti_impostazioni_id_utente_fkey");
        });

        // ---------------------------------------------------------------- j251: il TIMONE
        modelBuilder.Entity<VolantiniTimone>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_timone_pkey");
            entity.ToTable("volantini_timone");
            entity.HasIndex(e => new { e.IdVol, e.Versione }, "ux_timone_vol_versione").IsUnique();
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.IdVol).HasColumnName("id_vol");
            entity.Property(e => e.Versione).HasColumnName("versione");
            entity.Property(e => e.Stato).HasColumnName("stato");
            entity.Property(e => e.Revisione).HasColumnName("revisione");
            entity.Property(e => e.DataCreazione).HasDefaultValueSql("now()").HasColumnName("data_creazione");
            entity.Property(e => e.DataModifica).HasColumnName("data_modifica");
            entity.Property(e => e.DataSalvataggio).HasColumnName("data_salvataggio");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.IdUltimoSalvataggio).HasColumnName("id_ultimo_salvataggio");
            // j318: il «fatto» dell'Agenzia. I nomi delle colonne qui si scrivono a mano, uno per
            // uno: aggiungere la proprieta' al modello e basta non funziona, e il programma parte
            // lo stesso - se ne accorge solo Postgres, alla prima lettura, con «column
            // v.DataSistemato does not exist». E' il motivo per cui j317 e' stato tolto.
            entity.Property(e => e.DataSistemato).HasColumnName("data_sistemato");
            entity.Property(e => e.IdSistemato).HasColumnName("id_sistemato");
        });

        modelBuilder.Entity<VolantiniTimonePagine>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_timone_pagine_pkey");
            entity.ToTable("volantini_timone_pagine");
            entity.HasIndex(e => new { e.IdTimone, e.Numero }, "ux_timone_pagine").IsUnique();
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.IdTimone).HasColumnName("id_timone");
            entity.Property(e => e.Numero).HasColumnName("numero");
            entity.Property(e => e.Griglia).HasColumnName("griglia");
            entity.Property(e => e.Capienza).HasColumnName("capienza");
            entity.Property(e => e.Ordine).HasColumnName("ordine");
            entity.Property(e => e.Attiva).HasDefaultValue(true).HasColumnName("attiva");
            entity.Property(e => e.Bloccata).HasDefaultValue(false).HasColumnName("bloccata");
        });

        modelBuilder.Entity<VolantiniTimoneVoci>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_timone_voci_pkey");
            entity.ToTable("volantini_timone_voci");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.IdTimone).HasColumnName("id_timone");
            entity.Property(e => e.IdElemento).HasColumnName("id_elemento");
            entity.Property(e => e.Codice).HasColumnName("codice");
            entity.Property(e => e.Basecode).HasColumnName("basecode");
            entity.Property(e => e.Etichetta).HasColumnName("etichetta");
            entity.Property(e => e.IdPaginaTimone).HasColumnName("id_pagina_timone");
            entity.Property(e => e.Posizione).HasColumnName("posizione");
            // j274: quante caselle occupa. 1 e 1 = una casella sola, com'e' sempre stato
            entity.Property(e => e.Colonne).HasDefaultValue((short)1).HasColumnName("colonne");
            entity.Property(e => e.Righe).HasDefaultValue((short)1).HasColumnName("righe");
            entity.Property(e => e.IdGruppo).HasColumnName("id_gruppo");
            entity.Property(e => e.Ruolo).HasColumnName("ruolo");
            entity.Property(e => e.Stato).HasColumnName("stato");
            entity.Property(e => e.PaginaOrigine).HasColumnName("pagina_origine");
            entity.Property(e => e.PosizioneOrigine).HasColumnName("posizione_origine");
            entity.Property(e => e.DataModifica).HasColumnName("data_modifica");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
        });

        // j279: le caselle bloccate. Una riga = una casella dove non deve andare niente, perche'
        // quel posto e' riservato a un elemento grafico. Non e' una voce: nessun codice, nessuno
        // stato. Una casella sola per riga, per decisione di Michele (28/09).
        modelBuilder.Entity<VolantiniTimoneBlocchi>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("volantini_timone_blocchi_pkey");
            entity.ToTable("volantini_timone_blocchi");
            entity.HasIndex(e => new { e.IdPaginaTimone, e.Posizione }, "ux_timone_blocchi").IsUnique();
            entity.HasIndex(e => e.IdTimone, "ix_timone_blocchi_timone");
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.IdTimone).HasColumnName("id_timone");
            entity.Property(e => e.IdPaginaTimone).HasColumnName("id_pagina_timone");
            entity.Property(e => e.Posizione).HasColumnName("posizione");
            entity.Property(e => e.DataModifica).HasColumnName("data_modifica");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
        });

        modelBuilder.Entity<VolantiniTimoneFinestre>(entity =>
        {
            entity.HasKey(e => e.Classificazione).HasName("volantini_timone_finestre_pkey");
            entity.ToTable("volantini_timone_finestre");
            entity.Property(e => e.Classificazione).HasColumnName("classificazione");
            entity.Property(e => e.DataInizio).HasColumnName("data_inizio");
            entity.Property(e => e.DataFine).HasColumnName("data_fine");
            entity.Property(e => e.IdAutore).HasColumnName("id_autore");
            entity.Property(e => e.DataModifica).HasDefaultValueSql("now()").HasColumnName("data_modifica");
        });

        // j227: colonna aggiunta a volantini_pagine_elementi_versioni per la propagazione
        // dell'Edit avanzato (il box pilota della correzione). Sta qui per lo stesso motivo:
        // un nuovo scaffold del contesto non la porterebbe.
        modelBuilder.Entity<VolantiniPagineElementiVersioni>(entity =>
        {
            entity.Property(e => e.IdElementoMaster).HasColumnName("id_elemento_master");
        });
    }
}
