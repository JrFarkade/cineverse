export async function onRequest(context) {
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

  // --- POST REQUEST (Create comment) ---
  if (request.method === "POST") {
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

  // --- PUT REQUEST (Edit comment) ---
  if (request.method === "PUT") {
    try {
      const body = await request.json();
      const { commentId, text } = body;

      if (!commentId || !text) {
        return new Response(JSON.stringify({ error: "Missing required fields commentId or text" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const existingComment = await db.prepare("SELECT * FROM review_comments WHERE id = ?").bind(commentId).first();
      if (!existingComment) {
        return new Response(JSON.stringify({ error: "Comment not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (existingComment.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }

      await db.prepare("UPDATE review_comments SET text = ? WHERE id = ?").bind(text, commentId).run();

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

  // --- DELETE REQUEST (Delete comment) ---
  if (request.method === "DELETE") {
    try {
      const commentId = url.searchParams.get("id");
      if (!commentId) {
        return new Response(JSON.stringify({ error: "Missing comment id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const existingComment = await db.prepare("SELECT * FROM review_comments WHERE id = ?").bind(commentId).first();
      if (!existingComment) {
        return new Response(JSON.stringify({ error: "Comment not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (existingComment.user_id !== user.id && user.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }

      await db.prepare("DELETE FROM review_comments WHERE id = ?").bind(commentId).run();

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
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}
 