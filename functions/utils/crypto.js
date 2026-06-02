function base64url(stringOrBuffer) {
  let base64;
  if (typeof stringOrBuffer === 'string') {
    base64 = btoa(unescape(encodeURIComponent(stringOrBuffer)));
  } else {
    base64 = btoa(String.fromCharCode(...new Uint8Array(stringOrBuffer)));
  }
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return decodeURIComponent(escape(atob(base64)));
}

// Signs a JWT payload using HS256
export async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(payload));
  const data = encoder.encode(`${headerPart}.${payloadPart}`);
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const signaturePart = base64url(signature);
  return `${headerPart}.${payloadPart}.${signaturePart}`;
}

// Verifies an HS256 JWT and returns the parsed payload, or null if invalid
export async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const [headerPart, payloadPart, signaturePart] = parts;
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerPart}.${payloadPart}`);
    
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    const sigBytes = new Uint8Array(
      atob(signaturePart.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => c.charCodeAt(0))
    );
    
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, data);
    if (!isValid) return null;
    
    return JSON.parse(base64urlDecode(payloadPart));
  } catch (err) {
    return null;
  }
}

// Hashes a password using PBKDF2 with SHA-256
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    256
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `pbkdf2_sha256$100000$${saltHex}$${hashHex}`;
}

// Verifies a password against a PBKDF2 hash
export async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;
    const [algo, iterStr, saltHex, hashHex] = parts;
    const iterations = parseInt(iterStr, 10);
    
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: iterations,
        hash: "SHA-256"
      },
      baseKey,
      256
    );
    
    const hashCompare = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashCompare === hashHex;
  } catch (err) {
    return false;
  }
}
