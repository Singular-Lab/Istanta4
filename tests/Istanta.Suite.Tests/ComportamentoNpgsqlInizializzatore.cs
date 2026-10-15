using System.Runtime.CompilerServices;
using Istanta.Models;

namespace Istanta.Suite.Tests;

/// <summary>
/// I20-1106: gli switch di Npgsql valgono anche nei test, prima di qualsiasi contesto. Senza, il
/// modello che i test confrontano con gli snapshot non e' quello che gira (un DateTime senza tipo
/// esplicito sarebbe "timestamp with time zone" invece di "without"), e MigrazioniTests darebbe
/// ragione a uno snapshot sbagliato: e' successo, e l'applicazione in produzione non e' partita.
/// Npgsql legge gli switch una volta sola, quindi vanno impostati prima che un test crei un
/// contesto, in qualunque ordine girino i test: un inizializzatore di modulo e' il posto sicuro.
/// </summary>
internal static class ComportamentoNpgsqlInizializzatore
{
    [ModuleInitializer]
    internal static void Inizializza()
    {
        Migrazioni.ImpostaComportamentoNpgsql();
    }
}
