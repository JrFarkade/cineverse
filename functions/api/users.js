export async function onRequest(context) {
  const { request, env } = context;
  const user = context.data.user;

  // Enforce admin-only verification
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

  // --- GET REQUEST (List all users) ---
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

  // --- PUT REQUEST (Toggle user suspension status) ---
  if (request.method === "PUT") {
    try {
      const body = await request.json();
      const { userId, isSuspended } = body;

      if (!userId || isSuspended === undefined) {
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

  // --- DELETE REQUEST (Permanently delete user) ---
  if (request.method === "DELETE") {
    try {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // SQLite foreign keys are ON by default in D1, but let's delete explicitly if needed
      // Delete user
      await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

      // D1/SQLite tables with ON DELETE CASCADE will clean up watchlists/reviews/likes/comments/activities automatically
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
