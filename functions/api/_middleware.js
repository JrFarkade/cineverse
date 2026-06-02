import { verifyJWT } from "../utils/crypto";

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight options request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  // Parse HTTP Cookies
  const cookies = parseCookies(request.headers);
  const token = cookies["session"];
  
  if (token) {
    const secret = env.JWT_SECRET || "fallback_secret_keep_it_safe_123!";
    const user = await verifyJWT(token, secret);
    if (user) {
      context.data.user = user;
    }
  }

  try {
    const response = await context.next();
    return response;
  } catch (err) {
    console.error("Middleware caught error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}

function parseCookies(headers) {
  const cookies = {};
  const cookieHeader = headers.get("Cookie");
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      if (parts.length >= 2) {
        cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    });
  }
  return cookies;
}
