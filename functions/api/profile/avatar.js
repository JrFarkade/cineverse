export async function onRequest(context) {
  const { request, env } = context;
  const user = context.data.user;
  const url = new URL(request.url);

  const bucket = env.AVATARS_BUCKET;
  if (!bucket) {
    return new Response(JSON.stringify({ error: "R2 bucket binding 'AVATARS_BUCKET' is missing on the server." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // --- GET REQUEST (Retrieve/Stream avatar from R2) ---
  if (request.method === "GET") {
    try {
      const key = url.searchParams.get("key");
      if (!key) {
        return new Response("Missing key parameter", { status: 400 });
      }

      const object = await bucket.get(key);
      if (!object) {
        return new Response("Avatar not found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=31536000"); // Cache in browser for 1 year

      return new Response(object.body, { headers });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  // Enforce auth check for upload requests
  if (!user || !user.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // --- POST REQUEST (Upload avatar to R2) ---
  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file) {
        return new Response(JSON.stringify({ error: "No file uploaded" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Check size limit: 1.5 MB
      const maxSize = 1.5 * 1024 * 1024;
      if (file.size > maxSize) {
        return new Response(JSON.stringify({ error: "File size exceeds 1.5MB" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const fileExtension = file.name.split(".").pop() || "jpg";
      const key = `avatars/${user.id}_${Date.now()}.${fileExtension}`;

      // Upload file stream directly to R2 bucket
      await bucket.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "image/jpeg" }
      });

      // Construct dynamic self-hosted public URL
      const publicUrl = `/api/profile/avatar?key=${encodeURIComponent(key)}`;

      return new Response(JSON.stringify({ url: publicUrl }), {
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

  return new Response("Method Not Allowed", { status: 405 });
}
 