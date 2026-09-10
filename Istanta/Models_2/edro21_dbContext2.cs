using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Istanta.Models_2;
using Microsoft.Extensions.Options;
using Istanta.Models;

namespace Istanta.Models_2
{
    public partial class Edro21_DbContext2 : DbContext
    {
        private readonly string connString = "";
        // +--- DEPRECATO 7/9/2026  costruttore a stringa ------------------------------
        // COSA        public Edro21_DbContext2(string connString)
        // PERCHE      il contesto ora si ottiene da IDbContextFactory<Edro21_DbContext2>,
        //             registrata in Program.cs. Con due costruttori applicabili la
        //             fabbrica non sa quale scegliere e l'applicazione non parte:
        //             'Multiple constructors accepting all given argument types'.
        // PRECEDENTE  identica scelta gia fatta dal team sul primo contesto: in
        //             Models/edro21_dbContext.cs il costruttore a stringa e commentato.
        // NON CANCELLARE: resta qui come traccia di come si costruiva prima.
        // +---------------------------------------------------------------------------
//        public Edro21_DbContext2(string connString)
//        {
//            this.connString = connString;
//        }

        public Edro21_DbContext2(DbContextOptions<Edro21_DbContext2> options)
            : base(options)
        {
        }

        public virtual DbSet<AddestramentoExcel> AddestramentoExcels { get; set; } = null!;
        public virtual DbSet<AddestramentoExcelRelazioni> AddestramentoExcelRelazionis { get; set; } = null!;
        public virtual DbSet<Promo> Promos { get; set; } = null!;
        public virtual DbSet<PromoImportazioni> PromoImportazionis { get; set; } = null!;
        public virtual DbSet<PromoTracciati> PromoTracciatis { get; set; } = null!;
        public virtual DbSet<PromoTracciatiRecord> PromoTracciatiRecords { get; set; } = null!;
        public virtual DbSet<SchemaCampiExcel> SchemaCampiExcels { get; set; } = null!;
        public virtual DbSet<SchemaCampiExcelRelazioni> SchemaCampiExcelRelazionis { get; set; } = null!;
        public virtual DbSet<SchemaCustom> SchemaCustoms { get; set; } = null!;
        public virtual DbSet<SchemaCustomRecord> SchemaCustomRecords { get; set; } = null!;
        public virtual DbSet<MenaboPagine> MenaboPagines { get; set; } = null!;
        public virtual DbSet<MenaboRef> MenaboRefs { get; set; } = null!;
        public virtual DbSet<PromoLavorazioni> PromoLavorazionis { get; set; } = null!;
        public virtual DbSet<PromoLavorazioniRecord> PromoLavorazioniRecords { get; set; } = null!;
        //public virtual DbSet<PromoLavorazioniRecordRegister> PromoLavorazioniRecordRegisters { get; set; } = null!;

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                optionsBuilder.UseNpgsql(this.connString);
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<AddestramentoExcel>(entity =>
            {
                entity.ToTable("addestramento_excel");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.DataCaricamento)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_caricamento");

                entity.Property(e => e.FileAddestramento)
                    .HasMaxLength(150)
                    .HasColumnName("file_addestramento");

                entity.Property(e => e.Titolo)
                    .HasMaxLength(100)
                    .HasColumnName("titolo");

                entity.Property(e => e.esportaSubito)
                    .HasColumnName("esportaSubito");

                entity.Property(e => e.salvaSuDb)
                    .HasColumnName("salvaSuDb");

                entity.Property(e => e.externalCallPerImport)
                    .HasColumnType("text")
                    .HasColumnName("externalCallPerImport");

                entity.Property(e => e.externalCallPerExport)
                    .HasColumnType("text")
                    .HasColumnName("externalCallPerExport");

                entity.Property(e => e.externalCallPerExportPoP)
                    .HasColumnType("text")
                    .HasColumnName("externalCallPerExportPoP");
            });

            modelBuilder.Entity<AddestramentoExcelRelazioni>(entity =>
            {
                entity.ToTable("addestramento_excel_relazioni");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Algoritmo)
                    .HasColumnType("text")
                    .HasColumnName("algoritmo");

                entity.Property(e => e.IdCampo)
                    .HasColumnName("id_campo")
                    .HasComment("Rif al campo esteso, non trovato nell'excel");

                entity.Property(e => e.NomeRelazione)
                    .HasMaxLength(50)
                    .HasColumnName("nome_relazione");

                entity.Property(e => e.TipoCompilazione)
                    .HasColumnName("tipo_compilazione")
                    .HasDefaultValueSql("((1))")
                    .HasComment("1 - importazione inline 2 - importazione atend  3 - esportazione 4 - Manuale");

                entity.HasOne(d => d.IdCampoNavigation)
                    .WithMany(p => p.AddestramentoExcelRelazionis)
                    .HasForeignKey(d => d.IdCampo)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_addestramento_excel_relazioni_schema_campi_excel");
            });

            modelBuilder.Entity<Promo>(entity =>
            {
                entity.ToTable("promo");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.DataRegistrazione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_registrazione");

                entity.Property(e => e.DataScadenza)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_scadenza");

                entity.Property(e => e.NomePromo)
                    .HasMaxLength(100)
                    .HasColumnName("nome_promo");

                entity.Property(e => e.guidID)
                    .HasMaxLength(50)
                    .HasColumnName("guidId");

                entity.Property(e => e.Context)
                    .HasColumnName("context");

                entity.Property(e => e.Stato)
                    .HasColumnName("stato")
                    .HasDefaultValueSql("((1))")
                    .HasComment("0-chiusa 1-aperta");

                entity.Property(e => e.ValiditaAl)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("validita_al");

                entity.Property(e => e.ValiditaDal)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("validita_dal");
            });

            modelBuilder.Entity<PromoImportazioni>(entity =>
            {
                entity.ToTable("promo_importazioni");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.DataCaricamento)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_caricamento");

                entity.Property(e => e.IdAddestramento).HasColumnName("id_addestramento");

                entity.Property(e => e.IdPromo).HasColumnName("id_promo");

                entity.Property(e => e.NomeFile)
                    .HasMaxLength(150)
                    .HasColumnName("nome_file");

                entity.Property(e => e.guidID)
                    .HasMaxLength(50)
                    .HasColumnName("guidId");

                entity.Property(e => e.IdAttivita)
                    .HasColumnName("id_attivita");

                entity.Property(e => e.TipoMateriale)
                    .HasMaxLength(50)
                    .HasColumnName("tipo_materiale");

                entity.Property(e => e.ParamsRequest)
                    .HasColumnName("paramsRequest");

                entity.HasOne(d => d.IdAddestramentoNavigation)
                    .WithMany(p => p.PromoImportazionis)
                    .HasForeignKey(d => d.IdAddestramento)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_promo_importazioni_addestramento_excel");

                entity.HasOne(d => d.IdPromoNavigation)
                    .WithMany(p => p.PromoImportazionis)
                    .HasForeignKey(d => d.IdPromo)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_promo_importazioni_promo");

                entity.HasOne(d => d.IdAttivitaNavigation)
                    .WithMany(p => p.PromoImportazionis)
                    .HasForeignKey(d => d.IdAttivita)
                    .HasConstraintName("FK_promo_importazioni_Attivita");

            });

            modelBuilder.Entity<PromoTracciati>(entity =>
            {
                entity.ToTable("promo_tracciati");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Area).HasColumnName("area");

                entity.Property(e => e.Canale).HasColumnName("canale");

                entity.Property(e => e.IdImportazione).HasColumnName("id_importazione");

                entity.Property(e => e.IdPromo).HasColumnName("id_promo");

                entity.Property(e => e.Versione).HasColumnName("versione");

                entity.Property(e => e.OrdineLista)
                    .HasColumnType("text")
                    .HasColumnName("ordine_lista");


                entity.Property(e => e.Meta)
                    .HasColumnType("text")
                    .HasColumnName("meta");


                entity.Property(e => e.Context)
                    .HasColumnType("text")
                    .HasColumnName("context");

                entity.Property(e => e.Sigla)
                    .HasMaxLength(50)
                    .HasColumnName("sigla");


                entity.Property(e => e.guidArea)
                .HasMaxLength(50)
                .HasColumnName("guidArea");

                entity.Property(e => e.guidCanale)
                .HasMaxLength(50)
                .HasColumnName("guidCanale");

                entity.Property(e => e.guidPV)
                .HasMaxLength(50)
                .HasColumnName("guidPV");


                entity.HasOne(d => d.IdImportazioneNavigation)
                    .WithMany(p => p.PromoTracciatis)
                    .HasForeignKey(d => d.IdImportazione)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_promo_tracciati_promo_importazioni");

                entity.HasOne(d => d.IdPromoNavigation)
                    .WithMany(p => p.PromoTracciatis)
                    .HasForeignKey(d => d.IdPromo)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_promo_tracciati_promo");
            });

            modelBuilder.Entity<PromoTracciatiRecord>(entity =>
            {
                entity.ToTable("promo_tracciati_records");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.DaEsportare).HasColumnName("da_esportare");

                entity.Property(e => e.Dato)
                    .HasColumnType("text")
                    .HasColumnName("dato");

                entity.Property(e => e.Versione).HasColumnName("versione");

                entity.Property(e => e.IdTracciato).HasColumnName("id_tracciato");

                entity.Property(e => e.IndiceEsportazione)
                    .HasColumnName("indice_esportazione")
                    .HasDefaultValueSql("((-1))");

                entity.Property(e => e.IndiceLettura).HasColumnName("indice_lettura");

                entity.Property(e => e.Label)
                    .HasMaxLength(40)
                    .HasColumnName("label");

                entity.Property(e => e.Scatto)
                    .HasMaxLength(500)
                    .HasColumnName("scatto");

                entity.Property(e => e.Codice)
                    .HasMaxLength(100)
                    .HasColumnName("codice");

                entity.Property(e => e.CodiceGruppo)
                    .HasMaxLength(4000)
                    .HasColumnName("codice_gruppo");

                //entity.Property(e => e.SelezioneMenabo).HasColumnName("selezione_menabo");

                entity.Property(e => e.DataRegistrazione)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("data_registrazione");

                entity.Property(e => e.ModalitaInserimento).HasColumnName("modalita_inserimento");

                entity.Property(e => e.Stato).HasColumnName("stato");

                entity.Property(e => e.IdAddestramento).HasColumnName("id_addestramento");


                entity.HasOne(d => d.IdTracciatoNavigation)
                    .WithMany(p => p.PromoTracciatiRecords)
                    .HasForeignKey(d => d.IdTracciato)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_promo_tracciati_records_promo_tracciati");



                entity.HasOne(d => d.IdAddestramentoNavigation)
                    .WithMany(p => p.PromoTracciatiRecords)
                    .HasForeignKey(d => d.IdAddestramento)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_promo_importazioni_Attivita");

            });

            modelBuilder.Entity<SchemaCampiExcel>(entity =>
            {
                entity.ToTable("schema_campi_excel");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.IdAddestramento).HasColumnName("id_addestramento");

                entity.Property(e => e.Indice).HasColumnName("indice");

                entity.Property(e => e.NomeColonna)
                    .HasMaxLength(70)
                    .HasColumnName("nome_colonna");

                entity.Property(e => e.NomeColonnaOriginale)
                    .HasMaxLength(70)
                    .HasColumnName("nome_colonna_originale");

                entity.Property(e => e.NomeVisualizzato)
                    .HasMaxLength(70)
                    .HasColumnName("nome_visualizzato");

                entity.Property(e => e.Note)
                    .HasMaxLength(500)
                    .HasColumnName("note");

                entity.Property(e => e.Ordinamento)
                    .HasColumnName("ordinamento")
                    .HasDefaultValueSql("((0))")
                    .HasComment("0 - none 1 - categoria(liv1) 2 - reparto (liv2) 3 - settore (liv 3) 4 - segmento (liv 4)");

                entity.Property(e => e.Ruolo)
                    .HasMaxLength(100)
                    .HasColumnName("ruolo");

                entity.Property(e => e.TipoDato).HasColumnName("tipo_dato");

                entity.HasOne(d => d.IdAddestramentoNavigation)
                    .WithMany(p => p.SchemaCampiExcels)
                    .HasForeignKey(d => d.IdAddestramento)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_schema_campi_excel_addestramento_excel");
            });

            modelBuilder.Entity<SchemaCampiExcelRelazioni>(entity =>
            {
                entity.ToTable("schema_campi_excel_relazioni");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Condizione)
                    .HasMaxLength(500)
                    .HasColumnName("condizione");

                entity.Property(e => e.IdCampo)
                    .HasColumnName("id_campo")
                    .HasComment("Rif al campo essitente sull'excel");

                entity.Property(e => e.IdRelazione).HasColumnName("id_relazione");

                entity.HasOne(d => d.IdCampoNavigation)
                    .WithMany(p => p.SchemaCampiExcelRelazionis)
                    .HasForeignKey(d => d.IdCampo)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_schema_campi_excel_relazioni_schema_campi_excel");

                entity.HasOne(d => d.IdRelazioneNavigation)
                    .WithMany(p => p.SchemaCampiExcelRelazionis)
                    .HasForeignKey(d => d.IdRelazione)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_schema_campi_excel_relazioni_addestramento_excel_relazioni");
            });

            modelBuilder.Entity<SchemaCustom>(entity =>
            {
                entity.ToTable("schema_custom");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.DataRegistrazione)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("data_registrazione");

                entity.Property(e => e.Titolo)
                    .HasMaxLength(60)
                    .HasColumnName("titolo");
            });

            modelBuilder.Entity<SchemaCustomRecord>(entity =>
            {
                entity.ToTable("schema_custom_records");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.Dato)
                    .HasColumnType("text")
                    .HasColumnName("dato");

                entity.Property(e => e.IdSchema).HasColumnName("id_schema");

                entity.HasOne(d => d.IdSchemaNavigation)
                    .WithMany(p => p.SchemaCustomRecords)
                    .HasForeignKey(d => d.IdSchema)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_schema_custom_records_schema_custom");
            });

            modelBuilder.Entity<MenaboPagine>(entity =>
            {
                entity.ToTable("menabo_pagine");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.IdMastro)
                    .HasColumnName("id_mastro");

                entity.Property(e => e.IdTracciato).HasColumnName("id_tracciato");
                
                entity.Property(e => e.Numero).HasColumnName("numero");
                
                entity.Property(e => e.Formato).HasMaxLength(15).HasColumnName("formato");

                entity.HasOne(d => d.IdTracciatoNavigation)
                    .WithMany(p => p.MenaboPagines)
                    .HasForeignKey(d => d.IdTracciato)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_menabo_pagine_promo_tracciati");
            });

            modelBuilder.Entity<MenaboRef>(entity =>
            {
                entity.ToTable("menabo_ref");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.IdPagina)
                    .HasColumnName("id_pagina");

                entity.Property(e => e.IdRecord).HasColumnName("id_record");

                entity.Property(e => e.CodiceGruppo).HasMaxLength(2000).HasColumnName("codice_gruppo");

                entity.Property(e => e.Indice).HasColumnName("indice");

                entity.Property(e => e.Selezione).HasColumnName("selezione");

                entity.Property(e => e.Formato).HasMaxLength(100).HasColumnName("formato");

                entity.Property(e => e.Meccaniche).HasColumnType("text").HasColumnName("meccanica");

                entity.HasOne(d => d.IdPaginaNavigation)
                    .WithMany(p => p.MenaboRefs)
                    .HasForeignKey(d => d.IdPagina)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_menabo_ref_menabo_pagine");

                entity.HasOne(d => d.IdRecordNavigation)
                    .WithMany(p => p.MenaboRefs)
                    .HasForeignKey(d => d.IdRecord)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_menabo_promo_tracciati_records");
            });

            modelBuilder.Entity<PromoLavorazioni>(entity =>
            {
                entity.ToTable("promo_lavorazioni");

                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.IdAutore).HasColumnName("id_autore");

                entity.Property(e => e.GuidId).HasColumnName("guidId");
                entity.Property(e => e.GuidPromo).HasColumnName("guidPromo");

                entity.Property(e => e.GuidCanale).HasColumnName("guidCanale");

                entity.Property(e => e.GuidArea).HasColumnName("guidArea");

                entity.Property(e => e.GuidFormato).HasColumnName("guidFormato");

                entity.Property(e => e.GuidRaccoglitore).HasColumnName("guidRaccoglitore");

                entity.Property(e => e.Stato).HasColumnName("stato");

                entity.Property(e => e.Meta)
                    .HasColumnType("text")
                    .HasColumnName("meta");

                entity.Property(e => e.RegisterDate)
                    .HasColumnType("timestamp without time zone")
                    .HasColumnName("register_date");

            });

            modelBuilder.Entity<PromoLavorazioniRecord>(entity =>
            {
                entity.ToTable("promo_lavorazioni_records");

                entity.Property(e => e.Id).HasColumnName("id");

                entity.Property(e => e.IdAutore).HasColumnName("id_autore");

                entity.Property(e => e.IdLavorazione).HasColumnName("id_lavorazione");

                entity.Property(e => e.IdRecordTracciato).HasColumnName("id_record_tracciato");

                entity.Property(e => e.Codice).HasColumnName("codice");

                entity.Property(e => e.CodiceGruppo).HasMaxLength(4000).HasColumnName("codice_gruppo");
                
                entity.Property(e => e.Indice).HasColumnName("indice");

                entity.Property(e => e.Pagina).HasColumnName("pagina");

                entity.Property(e => e.Meta).HasColumnType("text").HasColumnName("meta");



                entity.Property(e => e.RegisterDate)
                .HasColumnType("timestamp without time zone")
                .HasColumnName("register_date");



                entity.HasOne(d => d.IdPromoTracciatiRecordNavigation)
                    .WithMany(p => p.PromoLavorazioniRecords)
                    .HasForeignKey(d => d.IdRecordTracciato)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_promo_lavorazioni_records_promo_tracciati_records");



                entity.HasOne(d => d.IdPromoLavorazioniNavigation)
                    .WithMany(p => p.PromoLavorazioniRecords)
                    .HasForeignKey(d => d.IdLavorazione)
                    .OnDelete(DeleteBehavior.ClientSetNull)
                    .HasConstraintName("FK_promo_lavorazioni_records_promo_lavorazioni");

            });
            
            //modelBuilder.Entity<PromoLavorazioniRecordRegister>(entity =>
            //{
            //    entity.ToTable("promo_lavorazioni_records_register");

            //    entity.Property(e => e.Id).HasColumnName("id");

            //    entity.Property(e => e.IdAutore).HasColumnName("id_autore");

            //    entity.Property(e => e.IdLavorazioneRecord).HasColumnName("id_lavorazione_record");

            //    entity.Property(e => e.TipoAzione).HasColumnName("tipo_azione");


            //    entity.Property(e => e.RegisterDate)
            //    .HasColumnType("timestamp without time zone")
            //    .HasColumnName("register_date");



            //    entity.HasOne(d => d.IdPromoLavorazioniRecordNavigation)
            //        .WithMany(p => p.PromoLavorazioniRecordRegisters)
            //        .HasForeignKey(d => d.IdLavorazioneRecord)
            //        .OnDelete(DeleteBehavior.ClientSetNull)
            //        .HasConstraintName("FK_promo_lavorazioni_records_register_promo_lavorazioni_records");


            //});


            OnModelCreatingPartial(modelBuilder);
        }

        partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
    }
}
