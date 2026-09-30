using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Istanta.Migrations.Contesto2
{
    /// <summary>
    /// I20-994: migration di partenza di Edro21_DbContext2. Il contesto e' nato database-first: lo schema
    /// c'e' gia' su ogni database, creato da pg-ctx2.sql, e questa migration lo registra senza
    /// toccarlo. Per questo Up e Down sono vuoti. Il modello di partenza e' nel Designer.
    ///
    /// Su un database che esiste gia' si applica con lo script idempotente, che crea la
    /// tabella __EFMigrationsHistory_ctx2 e ci scrive questa riga. Su un database nuovo va prima pg-ctx2.sql.
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
