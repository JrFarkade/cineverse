import { hashPassword, verifyPassword, signJWT } from "../../utils/crypto";

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
    // 1. Admin account seeding hook on fresh projects
    if (emailOrUsername === "@Jrfarkade" && password === "@Sahil267") {
      const adminEmail = "admin@cineverse.com";
      let admin = await db.prepare("SELECT * FROM users WHERE username = ?").bind("@Jrfarkade").first();
      
      if (!admin) {
        const userId = crypto.randomUUID();
        const passwordHash = await hashPassword(password);
        const createdAt = new Date().toISOString().split("T")[0];
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
          new Date().toISOString()
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

      const secret = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
      const token = await signJWT({ id: admin.id, username: admin.username, role: admin.role }, secret);
      
      const adminProfile = {
        uid: admin.id,
        username: admin.username,
        email: admin.email,
        avatar: admin.avatar,
        createdAt: admin.created_at,
        role: admin.role,
        isSuspended: false,
        lastLoginAt: new Date().toISOString()
      };

      return new Response(JSON.stringify(adminProfile), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000`
        }
      });
    }

    // 2. Fetch user by email or username
    const user = await db.prepare("SELECT * FROM users WHERE email = ? OR username = ?").bind(emailOrUsername, emailOrUsername).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid username/email or password." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Check suspension status
    if (user.is_suspended === 1) {
      return new Response(JSON.stringify({ error: "This account has been suspended by an administrator." }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: "Invalid username/email or password." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5. Update last login
    await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(new Date().toISOString(), user.id).run();

    // 6. Set JWT Cookie & Return user profile
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
      lastLoginAt: new Date().toISOString()
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
