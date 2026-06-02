export async function onRequestPost(context) {
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
    const createdAt = new Date().toISOString();

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
