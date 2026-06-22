import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Sanitizes PEM key by replacing literal \n with actual newlines.
 * @param {string} key - The key to sanitize.
 * @returns {string} Sanitized key.
 */
export function sanitizeKey(key) {
    if (!key) return '';
    return key.replace(/\\n/g, '\n');
}

/**
 * Loads a private key from a PEM file in the project root.
 * @param {string} filename - The filename of the PEM file.
 * @returns {string} The private key content.
 */
export function loadPrivateKey(filename = 'our_winpay_private.pem') {
    try {
        const keyPath = path.join(process.cwd(), filename);
        return fs.readFileSync(keyPath, 'utf8');
    } catch (error) {
        console.error(`[CryptoUtils] Failed to load private key from ${filename}: ${error.message}`);
        throw new Error(`Private Key missing or unreadable: ${filename}`);
    }
}

/**
 * Generates a digital signature for a SNAP request.
 * 
 * @param {string} privateKey - The RSA private key.
 * @param {string} minifiedBody - The stringified request body.
 * @param {string} method - HTTP method.
 * @param {string} url - The endpoint URL.
 * @param {string} timestamp - WIB timestamp.
 * @returns {string} Base64 encoded RSA-SHA256 signature.
 */
export function generateSnapSignature(privateKey, minifiedBody, method, url, timestamp) {
    const bodyHash = crypto
        .createHash('sha256')
        .update(minifiedBody)
        .digest('hex')
        .toLowerCase();

    const endpointPath = url.startsWith('/') ? url : `/${url}`;
    const stringToSign = `${method}:${endpointPath}:${bodyHash}:${timestamp}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(stringToSign);
    signer.end();

    return signer.sign(privateKey, 'base64');
}

/**
 * Verifies the signature of an inbound SNAP callback.
 * 
 * @param {string} publicKey - The RSA public key.
 * @param {string} minifiedBody - The stringified request body.
 * @param {string} signature - The signature to verify.
 * @param {string} method - HTTP method.
 * @param {string} url - The endpoint URL.
 * @param {string} timestamp - WIB timestamp.
 * @returns {boolean} True if signature is valid.
 */
export function verifySnapSignature(publicKey, minifiedBody, signature, method, url, timestamp) {
    const bodyHash = crypto
        .createHash('sha256')
        .update(minifiedBody)
        .digest('hex')
        .toLowerCase();

    const stringToVerify = `${method}:${url}:${bodyHash}:${timestamp}`;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(stringToVerify);

    return verifier.verify(publicKey, signature, 'base64');
}
