using System;
using System.Collections.Generic;
using Istanta.Models_2;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Options;

/*
Generato con il comando
Scaffold-DbContext 

Esempio dimostrativo 
"Server=(localdb)\mssqllocaldb;Database=Blogging;Trusted_Connection=True;" Microsoft.EntityFrameworkCore.SqlServer -OutputDir Models -Tables "Blog","Post" -ContextDir Context -Context BlogContext -ContextNamespace New.Namespace

 */
namespace Istanta.Models
{
    public partial class edro21_dbContext : DbContext
    {
        private readonly string connString="";
        //public edro21_dbContext()
        //{
        //}

        //public edro21_dbContext(string connString)
        //{
        //    this.connString = connString;
        //}

        public edro21_dbContext(DbContextOptions<edro21_dbContext> options)
            : base(options)
        {
        }

        public virtual DbSet<Articoli> Articolis { get; set; } = null!;
        public virtual DbSet<ArticoliFoto> ArticoliFotos { get; set; } = null!;

        public virtual DbSet<FotoEscluse> FotoEscluses { get; set; } = null!;

        public virtual DbSet<ArticoliDescrizioni> ArticoliDescrizionis { get; set; } = null!;        
        public virtual DbSet<Setting> Settings { get; set; } = null!;

        public virtual DbSet<AttivitaLog> AttivitaLogs { get; set; } = null!;
        public virtual DbSet<Attivitum> Attivita { get; set; } = null!;
        public virtual DbSet<Utenti> Utentis { get; set; } = null!;
        public virtual DbSet<UtentiFico> UtentiFicos { get; set; } = null!;
        public virtual DbSet<RegistroOperazioni> RegistroOperazionis { get; set; } = null!;
        public virtual DbSet<RegistroPropagazioni> RegistroPropagazionis { get; set; } = null!;

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                //var sqlServerOptionsExtension = 
                //optionsBuilder.Options!.FindExtension<SqlServerOptionsExtension>();

                //optionsBuilder.UseNpgsql("Server=(local)\\SQLEXPRESS;Database=edro21_db;Trusted_Connection=True;");
                optionsBuilder.UseNpgsql(this.connString);
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {            
            modelBuilder.Entity<Articoli>(entity =>
            {
                entity.ToTable("articoli");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Descrizione2)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione2");

                entity.Property(e => e.Codice)
                    .HasMaxLength(100)
                    .HasColumnName("codice");

                entity.Property(e => e.Descrizione1)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione1");

                //I20-988: la misura sta in un posto solo, condivisa col troncamento in
                //importazione. Sui database gia' esistenti la colonna non si allarga da sola:
                //va eseguita l'alterazione, perche' gli schemi si applicano solo alla creazione.
                entity.Property(e => e.Ean)
                    .HasMaxLength(Utility.Main.lunghezzaMassimaEan)
                    .HasColumnName("ean");

                entity.Property(e => e.Descrizione4)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione4");

                entity.Property(e => e.NotaTecnica)
                    .HasColumnType("text")
                    .HasColumnName("nota_tecnica");

                entity.Property(e => e.Peso)
                    .HasColumnType("decimal(18, 3)")
                    .HasColumnName("peso");

                entity.Property(e => e.Reparto).HasColumnName("reparto");

                entity.Property(e => e.Segmento)
                    .HasMaxLength(20)
                    .HasColumnName("segmento");

                entity.Property(e => e.StatoRevisione)
                    .HasColumnName("stato_revisione")
                    .HasComment("0 - non processato 1 - descrizione conad approvata 2 - descrizione conad bocciata 3 - obsoleto 4 - processato solo da edro");

                entity.Property(e => e.Descrizione3)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione3");

                entity.Property(e => e.UltimaRevisione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("ultima_revisione");

                entity.Property(e => e.DataInserimento)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_inserimento");

                entity.Property(e => e.DataModifica)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_modifica");

                entity.Property(e => e.Um)
                    .HasMaxLength(10)
                    .HasColumnName("um");
            });

            modelBuilder.Entity<ArticoliFoto>(entity =>
            {
                entity.ToTable("articoli_foto");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Attiva)
                    .IsRequired()
                    .HasColumnName("attiva")
                    .HasDefaultValueSql("((1))");

                entity.Property(e => e.Area)
                    .HasMaxLength(30)
                    .HasColumnName("area");

                entity.Property(e => e.Canale)
                    .HasMaxLength(30)
                    .HasColumnName("canale");

                entity.Property(e => e.DataInserimento)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_inserimento");

                entity.Property(e => e.DataModifica)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_modifica");

                entity.Property(e => e.IdArticolo).HasColumnName("id_articolo");

                entity.Property(e => e.NomeReale)
                    .HasMaxLength(250)
                    .HasColumnName("nome_reale");

                entity.Property(e => e.GuidId)
                    .HasMaxLength(50)
                    .HasColumnName("guid_id");

                entity.Property(e => e.Puntatore)
                .HasColumnName("puntatore");

                entity.Property(e => e.PathFoto)
                    .HasMaxLength(250)
                    .HasColumnName("path_foto");

                entity.Property(e => e.Hash)
                    .HasMaxLength(200)
                    .HasColumnName("hash");

                entity.Property(e => e.Tipo)
                    .HasColumnName("tipo");

                entity.Property(e => e.StatoSelezione)
                    .HasColumnName("stato_selezione")
                    .HasDefaultValueSql("((1))")
                    .HasComment("0 - no selezionata 1 - primaria 2 - selezionata");

                entity.HasOne(d => d.IdArticoloNavigation)
                    .WithMany(p => p.ArticoliFotos)
                    .HasForeignKey(d => d.IdArticolo)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_articoli_foto_articoli");
            });


            modelBuilder.Entity<FotoEscluse>(entity =>
            {
                entity.ToTable("foto_escluse");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.DataInserimento)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_inserimento");

                entity.Property(e => e.IdArticolo).HasColumnName("idArticolo");

                entity.Property(e => e.NomeReale)
                    .HasMaxLength(250)
                    .HasColumnName("nome_reale");

                entity.HasOne(d => d.IdArticoloNavigation)
                    .WithMany(p => p.FotoEscluses)
                    .HasForeignKey(d => d.IdArticolo)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_foto_escluse_articoli");
            });

            modelBuilder.Entity<ArticoliDescrizioni>(entity =>
            {
                entity.ToTable("articoli_descrizioni");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.IdArticolo).HasColumnName("id_articolo");

                entity.Property(e => e.DataUltimaRicezione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_ultima_ricezione");

                entity.Property(e => e.CodiceGruppo).HasColumnName("codice_gruppo");

                entity.Property(e => e.Area)
                    .HasMaxLength(30)
                    .HasColumnName("area");

                entity.Property(e => e.Canale)
                    .HasMaxLength(30)
                    .HasColumnName("canale");                
                
                entity.Property(e => e.Custom)
                    .HasMaxLength(1000)
                    .HasColumnName("custom");

                entity.Property(e => e.Descrizione1)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione_1");

                entity.Property(e => e.Descrizione2)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione_2");

                entity.Property(e => e.Descrizione3)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione_3");

                entity.Property(e => e.Descrizione4)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione_4");

                entity.Property(e => e.DescrizioneIndd)
                    .HasMaxLength(4000)
                    .HasColumnName("descrizione_indd");

                entity.Property(e => e.Extra)
                    .HasColumnType("text")
                    .HasColumnName("extra");

                entity.Property(e => e.Peso)
      .HasColumnName("peso")
      .HasPrecision(18, 3);

                entity.Property(e => e.Um)
                    .HasColumnName("um");

                entity.Property(e => e.Approvata)
                    .HasColumnName("approvata");              
                
                entity.Property(e => e.Attiva)
                    .HasColumnName("attiva");

                entity.Property(e => e.FirmaTracciato)
                    .HasColumnType("text")
                    .HasColumnName("firma_tracciato");

                entity.Property(e => e.Meta)
                    .HasColumnType("text")
                    .HasColumnName("meta");

                entity.HasOne(d => d.IdArticoloNavigation)
                    .WithMany(p => p.ArticoliDescrizionis)
                    .HasForeignKey(d => d.IdArticolo)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_articoli_descrizioni_articoli");
            });            

            modelBuilder.Entity<Setting>(entity =>
            {
                entity.ToTable("settings");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Codice)
                    .HasMaxLength(80)
                    .HasColumnName("codice");

                entity.Property(e => e.Valore)
                    .HasColumnType("text")
                    .HasColumnName("valore");
            });      

            modelBuilder.Entity<AttivitaLog>(entity =>
            {
                entity.ToTable("AttivitaLogs");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.DataRegistrazione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_registrazione");

                entity.Property(e => e.IdAttivita).HasColumnName("id_attivita");

                entity.Property(e => e.Note)
                    .HasColumnType("text")
                    .HasColumnName("note");

                entity.Property(e => e.Tipo).HasColumnName("tipo");

                entity.HasOne(d => d.IdAttivitaNavigation)
                    .WithMany(p => p.AttivitaLogs)
                    .HasForeignKey(d => d.IdAttivita)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_AttivitaLogs_Attivita");
            });

            modelBuilder.Entity<Attivitum>(entity =>
            {
                entity.ToTable("Attivita");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Contract)
                    .HasMaxLength(500)
                    .HasColumnName("contract");

                entity.Property(e => e.StatoMsg)
                .HasMaxLength(250)
                .HasColumnName("stato_msg");

                entity.Property(e => e.DataFine)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_fine");

                entity.Property(e => e.DataInizio)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_inizio");

                entity.Property(e => e.DataInserimento)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_inserimento");

                entity.Property(e => e.IdParent).HasColumnName("id_parent");

                entity.Property(e => e.IdUtente).HasColumnName("id_utente");

                entity.Property(e => e.Priorita).HasColumnName("priorita");

                entity.Property(e => e.Progress).HasColumnName("progress");

                entity.Property(e => e.Stato).HasColumnName("stato");

                entity.Property(e => e.Coda).HasColumnName("coda");

                entity.Property(e => e.Tipo)
                    .HasColumnName("tipo")
                    .HasDefaultValueSql("((1))");

                entity.Property(e => e.TipoProcesso)
                    .HasColumnName("tipo_processo")
                    .HasDefaultValueSql("((1))");

                entity.Property(e => e.Titolo)
                    .HasMaxLength(250)
                    .HasColumnName("titolo");

                //entity.HasOne(d => d.IdUtenteNavigation)
                //    .WithMany(p => p.Attivita)
                //    .HasForeignKey(d => d.IdUtente)
                //    .HasConstraintName("FK_Attivita_utenti");

                entity.HasOne(d => d.IdParentNavigation)
                    .WithMany(p => p.SubAttivita)
                    .HasForeignKey(d => d.IdParent)
                    .HasConstraintName("FK_Attivita_Attivita");
            });

            modelBuilder.Entity<Utenti>(entity =>
            {
                entity.ToTable("utenti");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Data_Registrazione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_registrazione");

                entity.Property(e => e.Data_Update)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_update");

                entity.Property(e => e.NomeUtente)
                    .HasMaxLength(150)
                    .HasColumnName("nomeUtente");

                entity.Property(e => e.Nome)
                    .HasMaxLength(150)
                    .HasColumnName("nome");

                entity.Property(e => e.Cognome)
                    .HasMaxLength(150)
                    .HasColumnName("cognome");

                entity.Property(e => e.Password)
                    .HasMaxLength(50)
                    .HasColumnName("password");

                entity.Property(e => e.PrivateKey)
                    .HasMaxLength(50)
                    .HasColumnName("privateKey");

                entity.Property(e => e.ADToken)
                    .HasColumnType("text")
                    .HasColumnName("ad_token");

                entity.Property(e => e.ADTokenExpiration)
                    .HasColumnType("timestamp without time zone").HasColumnName("scadenza_token_ad");

                entity.Property(e => e.Stato).HasColumnName("stato");
                entity.Property(e => e.Ruolo).HasColumnName("ruolo");

                entity.Property(e => e.Email)
                    .HasMaxLength(150)
                    .HasColumnName("email");

                entity.Property(e => e.PolicyGroups)
                    .HasColumnType("text")
                    .HasColumnName("policyGroups");

                entity.HasIndex(e => e.Email)
                   .IsUnique();

            });

            modelBuilder.Entity<UtentiFico>(entity =>
            {
                entity.ToTable("utenti_fico");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.IdUtente).HasColumnName("id_utente");

                entity.Property(e => e.lastAccess)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("last_access");

                entity.Property(e => e.UserData)
                    .HasColumnName("user_data");

                entity.Property(e => e.Username)
                    .HasMaxLength(150)
                    .HasColumnName("username");

                entity.Property(e => e.TipoUtente)
                    .HasColumnName("tipo_utente");


                entity.Property(e => e.Token)
                    .HasMaxLength(100)
                    .HasColumnName("token");

                entity.Property(e => e.Origin)
                    .HasMaxLength(50)
                    .HasColumnName("origin");

                entity.HasOne(d => d.IdUtenteNavigation)
                    .WithMany(p => p.UtentiFicos)
                    .HasForeignKey(d => d.IdUtente)
                    .HasConstraintName("PK_utenti_fico");
            });

            modelBuilder.Entity<RegistroOperazioni>(entity =>
            {
                entity.ToTable("registro_operazioni");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.TipoOperazione)
                    .HasColumnName("tipo_operazione");

                entity.Property(e => e.CodiceAssociato)
                    .HasMaxLength(4000)
                    .HasColumnName("codice_associato");

                entity.Property(e => e.IdTracciato).HasColumnName("idTracciato");

                entity.Property(e => e.idPromoLavorazioniRecord).HasColumnName("idPromoLavorazioniRecord");

                entity.Property(e => e.idPromoLavorazione).HasColumnName("idPromoLavorazione");
                

                entity.Property(e => e.Area).HasMaxLength(30)
                    .HasColumnName("area");

                entity.Property(e => e.Canale).HasMaxLength(30)
                    .HasColumnName("canale");

                entity.Property(e => e.Url).HasColumnName("url");

                entity.Property(e => e.FormData).HasColumnName("formData");

                entity.Property(e => e.Data_Registrazione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_registrazione");

                entity.Property(e => e.Data_Esecuzione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_esecuzione");

                entity.Property(e => e.DataElaborazionePropagazioni)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_elaborazione_propagazioni");

                


                entity.Property(e => e.Stato).HasColumnName("stato");

                entity.Property(e => e.Autore)
                    .HasMaxLength(150)
                    .HasColumnName("autore");

                entity.Property(e => e.Esecutore)
                    .HasMaxLength(150)
                    .HasColumnName("esecutore");

            });

            modelBuilder.Entity<RegistroPropagazioni>(entity =>
            {
                entity.ToTable("registro_propagazioni");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.IdRegistro)
                    .HasColumnName("idRegistro");

                entity.Property(e => e.IdPromoLavorazioniRecord)
                    .HasColumnName("idPromoLavorazioneRecord");

                entity.Property(e => e.DataRegistrazione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_registrazione");

                entity.Property(e => e.DataElaborazione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_elaborazione");

                entity.Property(e => e.AutoreElaborazione)
                    .HasColumnName("autore_elaborazione");



                entity.Property(e => e.Stato).HasColumnName("stato");
                entity.Property(e => e.Priorita).HasColumnName("priorita");

                entity.HasOne(d => d.IdRegistroNavigation)
                .WithMany(p => p.RegistroPopagazionis)
                .HasForeignKey(d => d.IdRegistro)
                .HasConstraintName("FK_registro_propagazioni_registro_operazioni");

                entity.HasOne(d => d.IdUtenteNavigation)
                .WithMany(p => p.RegistroPopagazionis)
                .HasForeignKey(d => d.AutoreElaborazione)
                .HasConstraintName("FK_registro_propagazioni_utenti");


            });

            OnModelCreatingPartial(modelBuilder);
        }

        partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
    }
}
