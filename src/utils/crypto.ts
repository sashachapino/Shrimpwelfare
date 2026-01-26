// Encryption utilities using Web Crypto API
// Uses AES-256-GCM for authenticated encryption
// Password-based key derivation using PBKDF2

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(data: string, password: string): Promise<{
  iv: string;
  salt: string;
  ciphertext: string;
}> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    dataBuffer
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

export async function decrypt(
  ciphertext: string,
  password: string,
  ivBase64: string,
  saltBase64: string
): Promise<string> {
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Hash password for verification (stored separately from encryption)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'coaching-crm-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hash);
}
