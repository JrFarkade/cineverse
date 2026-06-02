var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// utils/crypto.js
function base64url(stringOrBuffer) {
  let base64;
  if (typeof stringOrBuffer === "string") {
    base64 = btoa(unescape(encodeURIComponent(stringOrBuffer)));
  } else {
    base64 = btoa(String.fromCharCode(...new Uint8Array(stringOrBuffer)));
  }
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(base64url, "base64url");
function base64urlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return decodeURIComponent(escape(atob(base64)));
}
__name(base64urlDecode, "base64urlDecode");
async function signJWT(payload, secret) {
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
__name(signJWT, "signJWT");
async function verifyJWT(token, secret) {
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
      atob(signaturePart.replace(/-/g, "+").replace(/_/g, "/")).split("").map((c) => c.charCodeAt(0))
    );
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, data);
    if (!isValid) return null;
    return JSON.parse(base64urlDecode(payloadPart));
  } catch (err) {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
async function hashPassword(password) {
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
      salt,
      iterations: 1e5,
      hash: "SHA-256"
    },
    baseKey,
    256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2_sha256$100000$${saltHex}$${hashHex}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;
    const [algo, iterStr, saltHex, hashHex] = parts;
    const iterations = parseInt(iterStr, 10);
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
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
        salt,
        iterations,
        hash: "SHA-256"
      },
      baseKey,
      256
    );
    const hashCompare = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashCompare === hashHex;
  } catch (err) {
    return false;
  }
}
__name(verifyPassword, "verifyPassword");

// api/auth/google/callback.js
async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI;
  if (!code) {
    return Response.redirect(`${url.origin}/auth?error=missing_code`, 302);
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Token exchange failed:", errText);
      return Response.redirect(`${url.origin}/auth?error=token_exchange_failed`, 302);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const userinfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
    const userinfoResponse = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!userinfoResponse.ok) {
      console.error("Failed to fetch userinfo");
      return Response.redirect(`${url.origin}/auth?error=fetch_userinfo_failed`, 302);
    }
    const googleUser = await userinfoResponse.json();
    const googleId = googleUser.id;
    const email = googleUser.email;
    const name = googleUser.name;
    const photoURL = googleUser.picture;
    let user = await db.prepare("SELECT * FROM users WHERE id = ? OR email = ?").bind(googleId, email).first();
    if (user) {
      if (user.id !== googleId) {
      }
      if (user.is_suspended === 1) {
        return Response.redirect(`${url.origin}/auth?error=suspended`, 302);
      }
      await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind((/* @__PURE__ */ new Date()).toISOString(), user.id).run();
    } else {
      const baseUsername = name ? name.replace(/\s+/g, "") : email.split("@")[0];
      let uniqueUsername = baseUsername;
      let count = 1;
      let isUnique = false;
      while (!isUnique) {
        const check = await db.prepare("SELECT id FROM users WHERE username = ?").bind(uniqueUsername).first();
        if (!check) {
          isUnique = true;
        } else {
          uniqueUsername = `${baseUsername}${count}`;
          count++;
        }
      }
      const defaultAvatar = photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uniqueUsername}`;
      const createdAt = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      await db.prepare(
        "INSERT INTO users (id, username, email, password_hash, avatar, bio, role, is_suspended, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        googleId,
        uniqueUsername,
        email,
        null,
        // No password hash for OAuth
        defaultAvatar,
        "",
        "user",
        0,
        createdAt,
        (/* @__PURE__ */ new Date()).toISOString()
      ).run();
      user = {
        id: googleId,
        username: uniqueUsername,
        role: "user"
      };
    }
    const secret = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
    const token = await signJWT({ id: user.id, username: user.username, role: user.role }, secret);
    const headers = new Headers();
    headers.set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000`);
    headers.set("Location", `${url.origin}/`);
    return new Response(null, {
      status: 302,
      headers
    });
  } catch (err) {
    console.error("Google login callback error:", err);
    return Response.redirect(`${url.origin}/auth?error=callback_error`, 302);
  }
}
__name(onRequestGet, "onRequestGet");

// api/admin/stats.js
async function onRequestGet2(context) {
  const { env } = context;
  const user = context.data.user;
  if (!user || user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const queries = [
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin'"),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND is_suspended = 0"),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND is_suspended = 1"),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND created_at = ?").bind(todayStr),
      db.prepare("SELECT COUNT(*) as count FROM watchlist"),
      db.prepare("SELECT COUNT(*) as count FROM watchlist WHERE type = 'movie'"),
      db.prepare("SELECT COUNT(*) as count FROM watchlist WHERE type = 'tv'"),
      db.prepare("SELECT COUNT(*) as count FROM watchlist WHERE type = 'kdrama'"),
      db.prepare("SELECT COUNT(*) as count FROM watchlist WHERE type = 'anime'"),
      db.prepare("SELECT COUNT(*) as count FROM reviews")
    ];
    const results = await db.batch(queries);
    const stats = {
      globalTotalUsers: results[0].results[0].count,
      globalActiveUsers: results[1].results[0].count,
      globalSuspendedUsers: results[2].results[0].count,
      globalNewUsersToday: results[3].results[0].count,
      globalTotalTracked: results[4].results[0].count,
      globalMoviesCount: results[5].results[0].count,
      globalTvCount: results[6].results[0].count,
      globalKdramasCount: results[7].results[0].count,
      globalAnimeCount: results[8].results[0].count,
      globalTotalReviews: results[9].results[0].count
    };
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestGet2, "onRequestGet");

// api/auth/google.js
async function onRequestGet3(context) {
  const { env } = context;
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return new Response(
      JSON.stringify({ error: "Google OAuth client configuration (GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI) is missing on the server." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" ")
  };
  const qs = new URLSearchParams(options).toString();
  return Response.redirect(`${rootUrl}?${qs}`, 302);
}
__name(onRequestGet3, "onRequestGet");

// api/auth/login.js
async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { emailOrUsername, password } = body;
  if (!emailOrUsername || !password) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    if (emailOrUsername === "@Jrfarkade" && password === "@Sahil267") {
      const adminEmail = "admin@cineverse.com";
      let admin = await db.prepare("SELECT * FROM users WHERE username = ?").bind("@Jrfarkade").first();
      if (!admin) {
        const userId = crypto.randomUUID();
        const passwordHash = await hashPassword(password);
        const createdAt = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const defaultAvatar = "https://api.dicebear.com/7.x/adventurer/svg?seed=Jrfarkade";
        await db.prepare(
          "INSERT INTO users (id, username, email, password_hash, avatar, bio, role, is_suspended, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          userId,
          "@Jrfarkade",
          adminEmail,
          passwordHash,
          defaultAvatar,
          "",
          "admin",
          0,
          createdAt,
          (/* @__PURE__ */ new Date()).toISOString()
        ).run();
        admin = {
          id: userId,
          username: "@Jrfarkade",
          email: adminEmail,
          avatar: defaultAvatar,
          bio: "",
          role: "admin",
          is_suspended: 0,
          created_at: createdAt
        };
      }
      const secret2 = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
      const token2 = await signJWT({ id: admin.id, username: admin.username, role: admin.role }, secret2);
      const adminProfile = {
        uid: admin.id,
        username: admin.username,
        email: admin.email,
        avatar: admin.avatar,
        createdAt: admin.created_at,
        role: admin.role,
        isSuspended: false,
        lastLoginAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return new Response(JSON.stringify(adminProfile), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `session=${token2}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000`
        }
      });
    }
    const user = await db.prepare("SELECT * FROM users WHERE email = ? OR username = ?").bind(emailOrUsername, emailOrUsername).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid username/email or password." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (user.is_suspended === 1) {
      return new Response(JSON.stringify({ error: "This account has been suspended by an administrator." }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: "Invalid username/email or password." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind((/* @__PURE__ */ new Date()).toISOString(), user.id).run();
    const secret = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
    const token = await signJWT({ id: user.id, username: user.username, role: user.role }, secret);
    const userProfile = {
      uid: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.created_at,
      role: user.role,
      isSuspended: false,
      lastLoginAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(JSON.stringify(userProfile), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000`
      }
    });
  } catch (err) {
    console.error("Login endpoint error:", err);
    return new Response(JSON.stringify({ error: err.message || "Database execution failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost, "onRequestPost");

// api/auth/logout.js
async function onRequestPost2() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    }
  });
}
__name(onRequestPost2, "onRequestPost");

// api/auth/me.js
async function onRequestGet4(context) {
  const { env } = context;
  const user = context.data.user;
  if (!user || !user.id) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const dbUser = await db.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
    if (!dbUser) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        }
      });
    }
    if (dbUser.is_suspended === 1) {
      return new Response(
        JSON.stringify({ error: "This account has been suspended by an administrator." }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
          }
        }
      );
    }
    const userProfile = {
      uid: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      avatar: dbUser.avatar,
      bio: dbUser.bio || "",
      createdAt: dbUser.created_at,
      role: dbUser.role,
      isSuspended: false,
      lastLoginAt: dbUser.last_login_at
    };
    return new Response(JSON.stringify({ authenticated: true, user: userProfile }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Session restoration error:", err);
    return new Response(JSON.stringify({ error: "Database query failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestGet4, "onRequestGet");

// api/auth/register.js
async function onRequestPost3(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { email, password, username } = body;
  if (!email || !password || !username) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const userCheck = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
    if (userCheck) {
      return new Response(
        JSON.stringify({ error: "Username already exists. Please choose another username." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const emailCheck = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (emailCheck) {
      return new Response(
        JSON.stringify({ error: "Email already in use." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const createdAt = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
    await db.prepare(
      "INSERT INTO users (id, username, email, password_hash, avatar, bio, role, is_suspended, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      userId,
      username,
      email,
      passwordHash,
      defaultAvatar,
      "",
      "user",
      0,
      createdAt,
      (/* @__PURE__ */ new Date()).toISOString()
    ).run();
    const secret = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
    const sessionPayload = { id: userId, username, role: "user" };
    const token = await signJWT(sessionPayload, secret);
    const userProfile = {
      uid: userId,
      username,
      email,
      avatar: defaultAvatar,
      createdAt,
      role: "user",
      isSuspended: false,
      lastLoginAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(JSON.stringify(userProfile), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000`
      }
    });
  } catch (err) {
    console.error("Registration error:", err);
    return new Response(JSON.stringify({ error: err.message || "Database execution failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost3, "onRequestPost");

// api/reviews/comment.js
async function onRequestPost4(context) {
  const { request, env } = context;
  const user = context.data.user;
  if (!user || !user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const { reviewId, text } = body;
    if (!reviewId || !text) {
      return new Response(JSON.stringify({ error: "Missing required fields reviewId or text" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const commentId = crypto.randomUUID();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(
      "INSERT INTO review_comments (id, review_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      commentId,
      reviewId,
      user.id,
      text,
      createdAt
    ).run();
    return new Response(JSON.stringify({ success: true, commentId }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost4, "onRequestPost");

// api/reviews/like.js
async function onRequestPost5(context) {
  const { request, env } = context;
  const user = context.data.user;
  if (!user || !user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const { reviewId } = body;
    if (!reviewId) {
      return new Response(JSON.stringify({ error: "Missing reviewId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const likeCheck = await db.prepare(
      "SELECT * FROM review_likes WHERE review_id = ? AND user_id = ?"
    ).bind(reviewId, user.id).first();
    if (likeCheck) {
      await db.prepare(
        "DELETE FROM review_likes WHERE review_id = ? AND user_id = ?"
      ).bind(reviewId, user.id).run();
      return new Response(JSON.stringify({ success: true, liked: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      await db.prepare(
        "INSERT INTO review_likes (review_id, user_id) VALUES (?, ?)"
      ).bind(reviewId, user.id).run();
      return new Response(JSON.stringify({ success: true, liked: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost5, "onRequestPost");

// api/profile/avatar.js
async function onRequest(context) {
  const { request, env } = context;
  const user = context.data.user;
  const url = new URL(request.url);
  const bucket = env.AVATARS_BUCKET;
  if (!bucket) {
    return new Response(JSON.stringify({ error: "R2 bucket binding 'AVATARS_BUCKET' is missing on the server." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (request.method === "GET") {
    try {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response("Missing key parameter", { status: 400 });
      }
      const object = await bucket.get(key);
      if (!object) {
        return new Response("Avatar not found", { status: 404 });
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000");
      return new Response(object.body, { headers });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }
  if (!user || !user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) {
        return new Response(JSON.stringify({ error: "No file uploaded" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const maxSize = 1.5 * 1024 * 1024;
      if (file.size > maxSize) {
        return new Response(JSON.stringify({ error: "File size exceeds 1.5MB" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const fileExtension = file.name.split(".").pop() || "jpg";
      const key = `avatars/${user.id}_${Date.now()}.${fileExtension}`;
      await bucket.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "image/jpeg" }
      });
      const publicUrl = `/api/profile/avatar?key=${encodeURIComponent(key)}`;
      return new Response(JSON.stringify({ url: publicUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  return new Response("Method Not Allowed", { status: 405 });
}
__name(onRequest, "onRequest");

// api/activities.js
async function onRequestGet5(context) {
  const { env } = context;
  const user = context.data.user;
  if (!user || !user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const listQuery = await db.prepare(`
      SELECT a.id, a.user_id as userId, a.description, a.timestamp, u.username, u.avatar
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT 50
    `).all();
    return new Response(JSON.stringify(listQuery.results || []), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestGet5, "onRequestGet");

// api/profile.js
async function onRequestPut(context) {
  const { request, env } = context;
  const user = context.data.user;
  if (!user || !user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const { username, bio, avatar } = body;
    if (!username) {
      return new Response(JSON.stringify({ error: "Username is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (username !== user.username) {
      const collisionCheck = await db.prepare(
        "SELECT id FROM users WHERE username = ? AND id != ?"
      ).bind(username, user.id).first();
      if (collisionCheck) {
        return new Response(
          JSON.stringify({ error: "Username already exists. Please choose another username." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    await db.prepare(
      "UPDATE users SET username = ?, bio = ?, avatar = ? WHERE id = ?"
    ).bind(
      username,
      bio || "",
      avatar,
      user.id
    ).run();
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPut, "onRequestPut");

// api/reviews.js
async function addSocialActivity(db, userId, description) {
  try {
    const userProfile = await db.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first();
    const username = userProfile?.username || "User";
    const activityId = crypto.randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(
      "INSERT INTO activities (id, user_id, description, timestamp) VALUES (?, ?, ?, ?)"
    ).bind(
      activityId,
      userId,
      `**${username}** ${description}`,
      timestamp
    ).run();
  } catch (err) {
    console.error("Failed to add social activity:", err);
  }
}
__name(addSocialActivity, "addSocialActivity");
async function onRequest2(context) {
  const { request, env } = context;
  const user = context.data.user;
  if (!user || !user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  if (request.method === "GET") {
    try {
      const reviewsQuery = await db.prepare(`
        SELECT r.*, u.username, u.avatar 
        FROM reviews r 
        LEFT JOIN users u ON r.user_id = u.id 
        ORDER BY r.created_at DESC 
        LIMIT 100
      `).all();
      const rawReviews = reviewsQuery.results || [];
      if (rawReviews.length === 0) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      const likesQuery = await db.prepare("SELECT * FROM review_likes").all();
      const rawLikes = likesQuery.results || [];
      const commentsQuery = await db.prepare(`
        SELECT rc.*, u.username, u.avatar 
        FROM review_comments rc 
        LEFT JOIN users u ON rc.user_id = u.id 
        ORDER BY rc.created_at ASC
      `).all();
      const rawComments = commentsQuery.results || [];
      const mappedReviews = rawReviews.map((rev) => {
        const reviewLikes = rawLikes.filter((like) => like.review_id === rev.id).map((like) => like.user_id);
        const reviewComments = rawComments.filter((comment) => comment.review_id === rev.id).map((comment) => ({
          userId: comment.user_id,
          username: comment.username,
          avatar: comment.avatar,
          text: comment.text,
          createdAt: comment.created_at
        }));
        return {
          id: rev.id,
          userId: rev.user_id,
          username: rev.username,
          avatar: rev.avatar,
          mediaId: rev.media_id,
          mediaTitle: rev.media_title,
          content: rev.content,
          rating: rev.rating,
          createdAt: rev.created_at,
          likes: reviewLikes,
          comments: reviewComments
        };
      });
      return new Response(JSON.stringify(mappedReviews), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { mediaId, mediaTitle, content, rating } = body;
      if (!mediaId || !mediaTitle || !content || rating === void 0) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const reviewId = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await db.prepare(
        "INSERT INTO reviews (id, user_id, media_id, media_title, content, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        reviewId,
        user.id,
        String(mediaId),
        mediaTitle,
        content,
        Number(rating),
        createdAt
      ).run();
      await addSocialActivity(db, user.id, `reviewed **${mediaTitle}** and rated it **${rating}/10**`);
      return new Response(JSON.stringify({ success: true, reviewId }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "DELETE") {
    try {
      const reviewId = url.searchParams.get("id");
      if (!reviewId) {
        return new Response(JSON.stringify({ error: "Missing review id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const existingReview = await db.prepare("SELECT * FROM reviews WHERE id = ?").bind(reviewId).first();
      if (!existingReview) {
        return new Response(JSON.stringify({ error: "Review not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (existingReview.user_id !== user.id && user.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
      await db.prepare("DELETE FROM reviews WHERE id = ?").bind(reviewId).run();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 450,
    headers: { "Content-Type": "application/json" }
  });
}
__name(onRequest2, "onRequest");

// api/users.js
async function onRequest3(context) {
  const { request, env } = context;
  const user = context.data.user;
  if (!user || user.role !== "admin") {
    return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  if (request.method === "GET") {
    try {
      const list = await db.prepare(`
        SELECT id as uid, username, email, avatar, bio, role, is_suspended as isSuspended, created_at as createdAt, last_login_at as lastLoginAt 
        FROM users 
        ORDER BY username ASC
      `).all();
      const mappedUsers = (list.results || []).map((u) => ({
        ...u,
        isSuspended: u.isSuspended === 1
      }));
      return new Response(JSON.stringify(mappedUsers), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "PUT") {
    try {
      const body = await request.json();
      const { userId, isSuspended } = body;
      if (!userId || isSuspended === void 0) {
        return new Response(JSON.stringify({ error: "Missing required parameters userId or isSuspended" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const flag = isSuspended ? 1 : 0;
      await db.prepare("UPDATE users SET is_suspended = ? WHERE id = ?").bind(flag, userId).run();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "DELETE") {
    try {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 450,
    headers: { "Content-Type": "application/json" }
  });
}
__name(onRequest3, "onRequest");

// api/watchlist.js
async function addSocialActivity2(db, userId, description) {
  try {
    const userProfile = await db.prepare("SELECT username, avatar FROM users WHERE id = ?").bind(userId).first();
    const username = userProfile?.username || "User";
    const activityId = crypto.randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await db.prepare(
      "INSERT INTO activities (id, user_id, description, timestamp) VALUES (?, ?, ?, ?)"
    ).bind(
      activityId,
      userId,
      `**${username}** ${description}`,
      timestamp
    ).run();
  } catch (err) {
    console.error("Failed to add social activity:", err);
  }
}
__name(addSocialActivity2, "addSocialActivity");
async function onRequest4(context) {
  const { request, env } = context;
  const user = context.data.user;
  if (!user || !user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "Database binding missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  if (request.method === "GET") {
    try {
      let targetUserId = user.id;
      const queryUserId = url.searchParams.get("userId");
      const all = url.searchParams.get("all");
      let list;
      if (all === "true" && user.role === "admin") {
        list = await db.prepare("SELECT * FROM watchlist ORDER BY updated_at DESC").all();
      } else {
        if (queryUserId && user.role === "admin") {
          targetUserId = queryUserId;
        }
        list = await db.prepare("SELECT * FROM watchlist WHERE user_id = ? ORDER BY updated_at DESC").bind(targetUserId).all();
      }
      const mappedList = (list.results || []).map((item) => ({
        userId: item.user_id,
        mediaId: item.media_id,
        title: item.title,
        type: item.type,
        originalType: item.original_type,
        posterPath: item.poster_path,
        status: item.status,
        personalRating: item.personal_rating,
        episodesWatched: item.episodes_watched,
        totalEpisodes: item.total_episodes,
        seasonsCompleted: item.seasons_completed,
        rewatchCount: item.rewatch_count,
        updatedAt: item.updated_at,
        completionDate: item.completion_date
      }));
      return new Response(JSON.stringify(mappedList), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const {
        media,
        status,
        personalRating,
        episodesWatched,
        totalEpisodes,
        seasonsCompleted,
        rewatchCount
      } = body;
      if (!media || !status) {
        return new Response(JSON.stringify({ error: "Missing media or status" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const isAnime = media.genres?.some((g) => g.id === 16) && media.original_language === "ja";
      const isKdrama = !media.title && media.original_language === "ko";
      const concreteType = isAnime ? "anime" : isKdrama ? "kdrama" : media.title ? "movie" : "tv";
      const originalType = media.title ? "movie" : "tv";
      const docId = `${user.id}_${media.id}`;
      const title = media.title || media.name;
      const posterPath = media.poster_path;
      const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const completionDate = status === "Completed" ? (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : "";
      await db.prepare(
        `INSERT OR REPLACE INTO watchlist (
          id, user_id, media_id, title, type, original_type, poster_path, status, 
          personal_rating, episodes_watched, total_episodes, seasons_completed, 
          rewatch_count, updated_at, completion_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        docId,
        user.id,
        String(media.id),
        title,
        concreteType,
        originalType,
        posterPath,
        status,
        Number(personalRating || 0),
        Number(episodesWatched || 0),
        Number(totalEpisodes || 1),
        Number(seasonsCompleted || 0),
        Number(rewatchCount || 0),
        updatedAt,
        completionDate
      ).run();
      await addSocialActivity2(db, user.id, `added **${title}** to **${status}**`);
      return new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "PUT") {
    try {
      const body = await request.json();
      const { mediaId, fields } = body;
      if (!mediaId || !fields) {
        return new Response(JSON.stringify({ error: "Missing mediaId or fields to update" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const docId = `${user.id}_${mediaId}`;
      const currentItem = await db.prepare("SELECT * FROM watchlist WHERE id = ?").bind(docId).first();
      if (!currentItem) {
        return new Response(JSON.stringify({ error: "Watchlist item not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      const updates = [];
      const bindings = [];
      Object.entries(fields).forEach(([key, val]) => {
        let colName = key;
        if (key === "personalRating") colName = "personal_rating";
        else if (key === "episodesWatched") colName = "episodes_watched";
        else if (key === "totalEpisodes") colName = "total_episodes";
        else if (key === "seasonsCompleted") colName = "seasons_completed";
        else if (key === "rewatchCount") colName = "rewatch_count";
        else if (key === "completionDate") colName = "completion_date";
        updates.push(`${colName} = ?`);
        bindings.push(val);
      });
      updates.push("updated_at = ?");
      bindings.push((/* @__PURE__ */ new Date()).toISOString());
      if (fields.status === "Completed") {
        updates.push("completion_date = ?");
        bindings.push((/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
      }
      bindings.push(docId);
      const queryStr = `UPDATE watchlist SET ${updates.join(", ")} WHERE id = ?`;
      await db.prepare(queryStr).bind(...bindings).run();
      if (fields.status && fields.status !== currentItem.status) {
        await addSocialActivity2(db, user.id, `updated **${currentItem.title}** status to **${fields.status}**`);
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "DELETE") {
    try {
      const mediaId = url.searchParams.get("mediaId");
      if (!mediaId) {
        return new Response(JSON.stringify({ error: "Missing mediaId parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const docId = `${user.id}_${mediaId}`;
      await db.prepare("DELETE FROM watchlist WHERE id = ?").bind(docId).run();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 450,
    headers: { "Content-Type": "application/json" }
  });
}
__name(onRequest4, "onRequest");

// api/_middleware.js
async function onRequest5(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  const cookies = parseCookies(request.headers);
  const token = cookies["session"];
  if (token) {
    const secret = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
    const user = await verifyJWT(token, secret);
    if (user) {
      context.data.user = user;
    }
  }
  try {
    const response = await context.next();
    return response;
  } catch (err) {
    console.error("Middleware caught error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
__name(onRequest5, "onRequest");
function parseCookies(headers) {
  const cookies = {};
  const cookieHeader = headers.get("Cookie");
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      if (parts.length >= 2) {
        cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    });
  }
  return cookies;
}
__name(parseCookies, "parseCookies");

// ../.wrangler/tmp/pages-cOd6iM/functionsRoutes-0.9438251687332923.mjs
var routes = [
  {
    routePath: "/api/auth/google/callback",
    mountPath: "/api/auth/google",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/stats",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/auth/google",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/reviews/comment",
    mountPath: "/api/reviews",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/reviews/like",
    mountPath: "/api/reviews",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/profile/avatar",
    mountPath: "/api/profile",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/activities",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/profile",
    mountPath: "/api",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/reviews",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/users",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/watchlist",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api",
    mountPath: "/api",
    method: "",
    middlewares: [onRequest5],
    modules: []
  }
];

// C:/Users/JrFar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/JrFar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// C:/Users/JrFar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/JrFar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-BBKMgK/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// C:/Users/JrFar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-BBKMgK/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.4752711203390253.mjs.map
