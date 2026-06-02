async function addSocialActivity(db, userId, description) {
  try {
    const userProfile = await db.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first();
    const username = userProfile?.username || "User";
    const activityId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    await db.prepare(
      "INSERT INTO activities (id, user_id, description, timestamp) VALUES (?, ?, ?, ?)"
    ).bind(
      activityId,
      userId,
      `**${username}** ${description}`,
      timestamp
    ).run();
  } catch (err) {
    console.error("Failed to add social activity:", err);
  }
}

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

  // --- GET REQUEST (Fetch reviews) ---
  if (request.method === "GET") {
    try {
      // 1. Fetch reviews joined with user profile info
      const reviewsQuery = await db.prepare(`
        SELECT r.*, u.username, u.avatar 
        FROM reviews r 
        LEFT JOIN users u ON r.user_id = u.id 
        ORDER BY r.created_at DESC 
        LIMIT 100
      `).all();

      const rawReviews = reviewsQuery.results || [];

      if (rawReviews.length === 0) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      // 2. Fetch all likes and comments to assemble on server
      const likesQuery = await db.prepare("SELECT * FROM review_likes").all();
      const rawLikes = likesQuery.results || [];

      const commentsQuery = await db.prepare(`
        SELECT rc.*, u.username, u.avatar 
        FROM review_comments rc 
        LEFT JOIN users u ON rc.user_id = u.id 
        ORDER BY rc.created_at ASC
      `).all();
      const rawComments = commentsQuery.results || [];

      // Map D1 data to match the camelCase format expected by front-end client
      const mappedReviews = rawReviews.map((rev) => {
        const reviewLikes = rawLikes
          .filter((like) => like.review_id === rev.id)
          .map((like) => like.user_id);

        const reviewComments = rawComments
          .filter((comment) => comment.review_id === rev.id)
          .map((comment) => ({
            userId: comment.user_id,
            username: comment.username,
            avatar: comment.avatar,
            text: comment.text,
            createdAt: comment.created_at
          }));

        return {
          id: rev.id,
          userId: rev.user_id,
          username: rev.username,
          avatar: rev.avatar,
          mediaId: rev.media_id,
          mediaTitle: rev.media_title,
          content: rev.content,
          rating: rev.rating,
          createdAt: rev.created_at,
          likes: reviewLikes,
          comments: reviewComments
        };
      });

      return new Response(JSON.stringify(mappedReviews), {
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

  // --- POST REQUEST (Create review) ---
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { mediaId, mediaTitle, content, rating } = body;

      if (!mediaId || !mediaTitle || !content || rating === undefined) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const reviewId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await db.prepare(
        "INSERT INTO reviews (id, user_id, media_id, media_title, content, rating, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        reviewId,
        user.id,
        String(mediaId),
        mediaTitle,
        content,
        Number(rating),
        createdAt
      ).run();

      await addSocialActivity(db, user.id, `reviewed **${mediaTitle}** and rated it **${rating}/10**`);

      return new Response(JSON.stringify({ success: true, reviewId }), {
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

  // --- DELETE REQUEST (Remove review) ---
  if (request.method === "DELETE") {
    try {
      const reviewId = url.searchParams.get("id");
      if (!reviewId) {
        return new Response(JSON.stringify({ error: "Missing review id" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const existingReview = await db.prepare("SELECT * FROM reviews WHERE id = ?").bind(reviewId).first();
      if (!existingReview) {
        return new Response(JSON.stringify({ error: "Review not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Check permissions: author or admin
      if (existingReview.user_id !== user.id && user.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }

      await db.prepare("DELETE FROM reviews WHERE id = ?").bind(reviewId).run();

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
 