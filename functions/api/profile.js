export async function onRequestPut(context) {
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

    // 1. Verify username uniqueness if it changed
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

    // 2. Perform database update
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
 