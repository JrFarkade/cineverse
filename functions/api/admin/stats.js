export async function onRequestGet(context) {
  const { env } = context;
  const user = context.data.user;

  // Enforce admin check
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

  try {
    const todayStr = new Date().toISOString().split("T")[0];

    // Build batch queries to execute in a single round-trip for maximum performance
    const queries = [
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin'"),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND is_suspended = 0"),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND is_suspended = 1"),
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role != 'admin' AND created_at = ?").bind(todayStr),
      db.prepare("SELECT COUNT(*) as count FROM watchlist"),
      db.prepare("SELECT COUNT(*) as count FROM watchlist WHERE type = 'movie'"),
      db.prepare("SELECT COUNT(*) as count FROM watchlist WHERE type = 'tv'"),
      db.prepare("SELECT COUNT(*) as count FROM watchlist WHERE type = 'kdrama'"),
      db.prepare("SELECT COUNT(*) as count FROM watchlist WHERE type = 'anime'"),
      db.prepare("SELECT COUNT(*) as count FROM reviews")
    ];

    const results = await db.batch(queries);

    const stats = {
      globalTotalUsers: results[0].results[0].count,
      globalActiveUsers: results[1].results[0].count,
      globalSuspendedUsers: results[2].results[0].count,
      globalNewUsersToday: results[3].results[0].count,
      globalTotalTracked: results[4].results[0].count,
      globalMoviesCount: results[5].results[0].count,
      globalTvCount: results[6].results[0].count,
      globalKdramasCount: results[7].results[0].count,
      globalAnimeCount: results[8].results[0].count,
      globalTotalReviews: results[9].results[0].count
    };

    return new Response(JSON.stringify(stats), {
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
 