export async function onRequestGet(context) {
  const { env, request } = context;
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
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");

    let listQuery;
    if (scope === "community") {
      listQuery = await db.prepare(`
        SELECT a.id, a.user_id as userId, a.description, a.timestamp, u.username, u.avatar
        FROM activities a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.timestamp DESC
        LIMIT 50
      `).all();
    } else {
      // Default: Only show the authenticated account holder's own activities
      listQuery = await db.prepare(`
        SELECT a.id, a.user_id as userId, a.description, a.timestamp, u.username, u.avatar
        FROM activities a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.user_id = ?
        ORDER BY a.timestamp DESC
        LIMIT 50
      `).bind(user.id).all();
    }

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
 