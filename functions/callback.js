import { signJWT } from "./utils/crypto";

export async function onRequestGet(context) {
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
    // 1. Exchange OAuth code for Access Token
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

    // 2. Fetch User Profile from Google API
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

    // 3. Resolve user profile in D1
    let user = await db.prepare("SELECT * FROM users WHERE id = ? OR email = ?").bind(googleId, email).first();
    
    if (user) {
      if (user.is_suspended === 1) {
        return Response.redirect(`${url.origin}/auth?error=suspended`, 302);
      }
      await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(new Date().toISOString(), user.id).run();
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
      const createdAt = new Date().toISOString().split("T")[0];

      await db.prepare(
        "INSERT INTO users (id, username, email, password_hash, avatar, bio, role, is_suspended, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        googleId,
        uniqueUsername,
        email,
        null,
        defaultAvatar,
        "",
        "user",
        0,
        createdAt,
        new Date().toISOString()
      ).run();

      user = {
        id: googleId,
        username: uniqueUsername,
        role: "user"
      };
    }

    // 4. Generate JWT & Cookie
    const secret = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
    const token = await signJWT({ id: user.id, username: user.username, role: user.role }, secret);

    // 5. Redirect browser with secure cookie, honoring state parameter for original page redirect
    const state = url.searchParams.get("state") || "/";
    const headers = new Headers();
    headers.set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000`);
    headers.set("Location", `${url.origin}${state}`);
    
    return new Response(null, {
      status: 302,
      headers
    });
  } catch (err) {
    console.error("Google login callback error:", err);
    return Response.redirect(`${url.origin}/auth?error=callback_error`, 302);
  }
}
 