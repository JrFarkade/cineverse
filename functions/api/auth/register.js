import { hashPassword, signJWT } from "../../utils/crypto";

export async function onRequestPost(context) {
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
  const emailVal = email?.trim();
  const usernameVal = username?.trim();
  const passwordVal = password?.trim();

  if (!emailVal || !passwordVal || !usernameVal) {
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
    // 1. Verify username uniqueness
    const userCheck = await db.prepare("SELECT id FROM users WHERE username = ?").bind(usernameVal).first();
    if (userCheck) {
      return new Response(
        JSON.stringify({ error: "Username already exists. Please choose another username." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Verify email uniqueness
    const emailCheck = await db.prepare("SELECT id FROM users WHERE email = ?").bind(emailVal).first();
    if (emailCheck) {
      return new Response(
        JSON.stringify({ error: "Email already in use." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Hash password and insert user
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(passwordVal);
    const createdAt = new Date().toISOString().split("T")[0];
    const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${usernameVal}`;

    await db.prepare(
      "INSERT INTO users (id, username, email, password_hash, avatar, bio, role, is_suspended, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      userId,
      usernameVal,
      emailVal,
      passwordHash,
      defaultAvatar,
      "",
      "user",
      0,
      createdAt,
      new Date().toISOString()
    ).run();

    // 4. Generate JWT & Cookie
    const secret = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
    const sessionPayload = { id: userId, username: usernameVal, role: "user" };
    const token = await signJWT(sessionPayload, secret);

    const userProfile = {
      uid: userId,
      username: usernameVal,
      email: emailVal,
      avatar: defaultAvatar,
      createdAt,
      role: "user",
      isSuspended: false,
      lastLoginAt: new Date().toISOString()
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
