export async function onRequestGet(context) {
  const { request, env } = context;

  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new Response(
      JSON.stringify({ error: "Google OAuth client configuration (GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI) is missing on the server." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const redirectPath = url.searchParams.get("redirect") || "/";

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    state: redirectPath,
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" ")
  };

  const qs = new URLSearchParams(options).toString();
  return Response.redirect(`${rootUrl}?${qs}`, 302);
}
 