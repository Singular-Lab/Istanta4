using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Istanta.Migrations.Contesto1
{
    /// <summary>
    /// I20-994: migration di partenza di edro21_dbContext. Il contesto e' nato database-first: lo schema
    /// c'e' gia' su ogni database, creato da pg-ctx1.sql, e questa migration lo registra senza
    /// toccarlo. Per questo Up e Down sono vuoti. Il modello di partenza e' nel Designer.
    ///
    /// Su un database che esiste gia' si applica con lo script idempotente, che crea la
    /// tabella __EFMigrationsHistory_ctx1 e ci scrive questa riga. Su un database nuovo va prima pg-ctx1.sql.
    /// </summary>
    public partial class Baseline : Migration
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
