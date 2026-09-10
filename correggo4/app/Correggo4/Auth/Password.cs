using System.Security.Cryptography;

namespace Correggo4.Auth;

/// <summary>
/// PBKDF2-SHA256. L'originale teneva le password in chiaro in un nvarchar(50)
/// (vedi correggo-mappa-funzionale.md §9): qui non si riparte da li'.
/// Formato memorizzato: pbkdf2.sha256$iterazioni$sale$chiave (base64).
/// </summary>
public static class Password
{
    private const int Iterazioni = 210_000;
    private const int ByteSale = 16;
    private const int ByteChiave = 32;

    public static string Hash(string password)
    {
        byte[] sale = RandomNumberGenerator.GetBytes(ByteSale);
        byte[] chiave = Rfc2898DeriveBytes.Pbkdf2(password, sale, Iterazioni, HashAlgorithmName.SHA256, ByteChiave);
        return $"pbkdf2.sha256${Iterazioni}${Convert.ToBase64String(sale)}${Convert.ToBase64String(chiave)}";
    }

    public static bool Verifica(string password, string? memorizzato)
    {
        if (string.IsNullOrWhiteSpace(memorizzato)) return false;

        string[] parti = memorizzato.Split('$');
        if (parti.Length != 4 || parti[0] != "pbkdf2.sha256") return false;
        if (!int.TryParse(parti[1], out int iterazioni)) return false;

        try
        {
            byte[] sale = Convert.FromBase64String(parti[2]);
            byte[] atteso = Convert.FromBase64String(parti[3]);
            byte[] calcolato = Rfc2898DeriveBytes.Pbkdf2(password, sale, iterazioni, HashAlgorithmName.SHA256, atteso.Length);
            return CryptographicOperations.FixedTimeEquals(atteso, calcolato);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

public static class Ruoli
{
    public const short CodiceGdo = 1;
    public const short CodiceAgenzia = 2;

    public const string Gdo = "GDO";
    public const string Agenzia = "Agenzia";

    public static string Nome(short codice) => codice == CodiceGdo ? Gdo : Agenzia;
}
