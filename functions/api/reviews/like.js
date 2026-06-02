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
    const { reviewId } = body;

    if (!reviewId) {
      return new Response(JSON.stringify({ error: "Missing reviewId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check if the like already exists
    const likeCheck = await db.prepare(
      "SELECT * FROM review_likes WHERE review_id = ? AND user_id = ?"
    ).bind(reviewId, user.id).first();

    if (likeCheck) {
      // Unlike: delete record
      await db.prepare(
        "DELETE FROM review_likes WHERE review_id = ? AND user_id = ?"
      ).bind(reviewId, user.id).run();
      
      return new Response(JSON.stringify({ success: true, liked: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // Like: insert record
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
 