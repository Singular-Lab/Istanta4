using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Istanta.Migrations.Contesto1
{
    /// <summary>
    /// I20-1106: riallinea lo snapshot al modello che gira davvero. Program.cs attiva da sempre il
    /// comportamento legacy di Npgsql sui timestamp (Migrazioni.ImpostaComportamentoNpgsql), con cui un
    /// DateTime senza HasColumnType e' "timestamp without time zone"; gli snapshot precedenti erano stati
    /// generati senza quello switch, con "with time zone", e Migrate() all'avvio si fermava per
    /// "pending model changes". Le dieci colonne diverse stanno tutte in entita' raggiunte per navigazione
    /// e senza ToTable (Promo, PromoImportazioni, PromoLavorazioni, PromoLavorazioniRecord,
    /// PromoLavorazioniRecordRegister, AddestramentoExcel, PromoTracciatiRecord): tabelle che nessun
    /// database ha, e un ALTER su di loro farebbe fallire l'avvio. Per questo Up e Down sono vuoti, come
    /// nella Baseline: lo schema non cambia, cambia solo cio' che la migration registra. Il modello e' nel
    /// Designer.
    /// </summary>
    public partial class TimestampSenzaFuso : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
