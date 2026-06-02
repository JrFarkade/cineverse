export async function onRequestGet(context) {
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
 