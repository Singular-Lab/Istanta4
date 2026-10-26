import * as crypto from "node:crypto";
/**
 * Derives a 16-byte key from a passphrase using MD5 to match the .NET implementation.
 * @param passphrase The passphrase to hash.
 * @returns A 16-byte buffer containing the MD5 hash.
 */
const getKeyFromPassphrase = (passphrase: string): Buffer => {
    return crypto.createHash('md5').update(passphrase, 'utf8').digest();
};

/**
 * Encrypts a string using 2-key TripleDES in ECB mode with PKCS7 padding,
 * mimicking the provided C# implementation.
 *
 * @param message The string to encrypt.
 * @param passphrase The passphrase used to derive the encryption key.
 * @returns A base64 encoded string with custom replacements ("/" to "-sl-", "=" to "-ug-").
 */
export function encryptString(message: string, passphrase: string): string {
    const key = getKeyFromPassphrase(passphrase);

    // The cipher is 'des-ede-ecb' which is 2-key 3DES with ECB mode.
    // This is the correct counterpart for .NET's TripleDESCryptoServiceProvider with a 16-byte key.
    const cipher = crypto.createCipheriv('des-ede-ecb', key, null);

    cipher.setAutoPadding(true);

    const encrypted = Buffer.concat([
        cipher.update(message, 'utf8'),
        cipher.final(),
    ]);

    const base64Encrypted = encrypted.toString('base64');
    return base64Encrypted.replace(/\//g, "-sl-").replace(/=/g, "-ug-");
}

/**
 * Decrypts a string that was encrypted with the corresponding C# or Node.js function.
 *
 * @param encryptedMessage The custom-encoded and encrypted string.
 * @param passphrase The passphrase used to derive the decryption key.
 * @returns The original decrypted string.
 */
export function decryptString(encryptedMessage: string, passphrase: string): string {
    const key = getKeyFromPassphrase(passphrase);

    const base64Message = encryptedMessage.replace(/-sl-/g, "/").replace(/-ug-/g, "=");
    const encryptedBuffer = Buffer.from(base64Message, 'base64');

    // Use the same algorithm and key for decryption.
    const decipher = crypto.createDecipheriv('des-ede-ecb', key, null);

    // Disable auto-padding and handle it manually.
    decipher.setAutoPadding(false);

    const decryptedPadded = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(),
    ]);

    // Manually remove PKCS7 padding.
    const paddingLength = decryptedPadded[decryptedPadded.length - 1];
    const decrypted = decryptedPadded.subarray(0, decryptedPadded.length - paddingLength);

    return decrypted.toString('utf8');
}
