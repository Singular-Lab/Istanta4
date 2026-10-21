using System.Security.Cryptography;
using System.Text;

namespace Correggo4.Auth;

/// <summary>
/// La cifratura del parametro `context` scambiato con Fidelity (I20-1091), la stessa di
/// Crypto.EncryptString/DecryptString del Correggo originale e di Istanta (IstantaCore.cs) e di
/// encryptString in fidelity/lib/encryption.ts: 3DES in ECB con chiave MD5(passphrase), PKCS7.
/// </summary>
public static class Crypto
{
    /// <summary>Cifra e codifica in base64url, come Fidelity e Istanta.</summary>
    public static string EncryptString(string messaggio, string passphrase)
    {
        using var tdes = Algoritmo(passphrase);
        byte[] dati = Encoding.UTF8.GetBytes(messaggio);
        byte[] cifrati = tdes.CreateEncryptor().TransformFinalBlock(dati, 0, dati.Length);
        return Convert.ToBase64String(cifrati).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    /// <summary>
    /// Accetta sia base64url (lo produce Fidelity) sia base64 standard (lo produceva l'originale):
    /// in una query string non codificata il '+' arriva come spazio, e l'originale lo rimetteva a
    /// posto con Replace(" ", "+"). Lancia FormatException o CryptographicException se il testo non
    /// si decifra con quella passphrase.
    /// </summary>
    public static string DecryptString(string messaggio, string passphrase)
    {
        string base64 = messaggio.Trim().Replace(' ', '+').Replace('-', '+').Replace('_', '/');
        base64 = base64.PadRight(base64.Length + (4 - base64.Length % 4) % 4, '=');
        byte[] cifrati = Convert.FromBase64String(base64);

        using var tdes = Algoritmo(passphrase);
        byte[] dati = tdes.CreateDecryptor().TransformFinalBlock(cifrati, 0, cifrati.Length);
        return Encoding.UTF8.GetString(dati);
    }

    private static TripleDES Algoritmo(string passphrase)
    {
        var tdes = TripleDES.Create();
        tdes.Key = MD5.HashData(Encoding.UTF8.GetBytes(passphrase));
        tdes.Mode = CipherMode.ECB;
        tdes.Padding = PaddingMode.PKCS7;
        return tdes;
    }
}
