async function addSocialActivity(db, userId, description) {
  try {
    const userProfile = await db.prepare("SELECT username, avatar FROM users WHERE id = ?").bind(userId).first();
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

  // --- GET REQUEST ---
  if (request.method === "GET") {
    try {
      let targetUserId = user.id;
      const queryUserId = url.searchParams.get("userId");
      const all = url.searchParams.get("all");

      let list;
      if (all === "true" && user.role === "admin") {
        list = await db.prepare("SELECT * FROM watchlist ORDER BY updated_at DESC").all();
      } else {
        if (queryUserId && user.role === "admin") {
          targetUserId = queryUserId;
        }
        list = await db.prepare("SELECT * FROM watchlist WHERE user_id = ? ORDER BY updated_at DESC").bind(targetUserId).all();
      }
      
      // Map D1 SQLite naming conventions (snake_case) to client properties (camelCase)
      const mappedList = (list.results || []).map((item) => ({
        userId: item.user_id,
        mediaId: item.media_id,
        title: item.title,
        type: item.type,
        originalType: item.original_type,
        posterPath: item.poster_path,
        status: item.status,
        personalRating: item.personal_rating,
        episodesWatched: item.episodes_watched,
        totalEpisodes: item.total_episodes,
        seasonsCompleted: item.seasons_completed,
        rewatchCount: item.rewatch_count,
        updatedAt: item.updated_at,
        completionDate: item.completion_date
      }));

      return new Response(JSON.stringify(mappedList), {
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

  // --- POST REQUEST (Add to watchlist) ---
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { 
        media, 
        status, 
        personalRating, 
        episodesWatched, 
        totalEpisodes, 
        seasonsCompleted, 
        rewatchCount 
      } = body;

      if (!media || !status) {
        return new Response(JSON.stringify({ error: "Missing media or status" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Re-run K-Drama and Anime determination on backend to assign correct type
      const isAnime = media.genres?.some(g => g.id === 16) && media.original_language === "ja";
      const isKdrama = !media.title && media.original_language === "ko";
      const concreteType = isAnime ? "anime" : (isKdrama ? "kdrama" : (media.title ? "movie" : "tv"));
      const originalType = media.title ? "movie" : "tv";
      
      const docId = `${user.id}_${media.id}`;
      const title = media.title || media.name;
      const posterPath = media.poster_path;
      const updatedAt = new Date().toISOString();
      const completionDate = status === "Completed" ? new Date().toISOString().split("T")[0] : "";

      await db.prepare(
        `INSERT OR REPLACE INTO watchlist (
          id, user_id, media_id, title, type, original_type, poster_path, status, 
          personal_rating, episodes_watched, total_episodes, seasons_completed, 
          rewatch_count, updated_at, completion_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        docId,
        user.id,
        String(media.id),
        title,
        concreteType,
        originalType,
        posterPath,
        status,
        Number(personalRating || 0),
        Number(episodesWatched || 0),
        Number(totalEpisodes || 1),
        Number(seasonsCompleted || 0),
        Number(rewatchCount || 0),
        updatedAt,
        completionDate
      ).run();

      await addSocialActivity(db, user.id, `added **${title}** to **${status}**`);

      return new Response(JSON.stringify({ success: true }), {
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

  // --- PUT REQUEST (Update watchlist progress) ---
  if (request.method === "PUT") {
    try {
      const body = await request.json();
      const { mediaId, fields } = body;

      if (!mediaId || !fields) {
        return new Response(JSON.stringify({ error: "Missing mediaId or fields to update" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const docId = `${user.id}_${mediaId}`;
      const currentItem = await db.prepare("SELECT * FROM watchlist WHERE id = ?").bind(docId).first();
      
      if (!currentItem) {
        return new Response(JSON.stringify({ error: "Watchlist item not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Generate dynamic SET parameters
      const updates = [];
      const bindings = [];

      Object.entries(fields).forEach(([key, val]) => {
        // Map camelCase fields to snake_case table columns
        let colName = key;
        if (key === "personalRating") colName = "personal_rating";
        else if (key === "episodesWatched") colName = "episodes_watched";
        else if (key === "totalEpisodes") colName = "total_episodes";
        else if (key === "seasonsCompleted") colName = "seasons_completed";
        else if (key === "rewatchCount") colName = "rewatch_count";
        else if (key === "completionDate") colName = "completion_date";

        updates.push(`${colName} = ?`);
        bindings.push(val);
      });

      // Append updatedAt and completionDate dynamically if needed
      updates.push("updated_at = ?");
      bindings.push(new Date().toISOString());

      if (fields.status === "Completed") {
        updates.push("completion_date = ?");
        bindings.push(new Date().toISOString().split("T")[0]);
      }

      // Add docId to bindings at the end
      bindings.push(docId);

      const queryStr = `UPDATE watchlist SET ${updates.join(", ")} WHERE id = ?`;
      await db.prepare(queryStr).bind(...bindings).run();

      if (fields.status && fields.status !== currentItem.status) {
        await addSocialActivity(db, user.id, `updated **${currentItem.title}** status to **${fields.status}**`);
      }

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

  // --- DELETE REQUEST (Remove from watchlist) ---
  if (request.method === "DELETE") {
    try {
      const mediaId = url.searchParams.get("mediaId");
      if (!mediaId) {
        return new Response(JSON.stringify({ error: "Missing mediaId parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const docId = `${user.id}_${mediaId}`;
      await db.prepare("DELETE FROM watchlist WHERE id = ?").bind(docId).run();

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
