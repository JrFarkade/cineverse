import { onRequestGet as __api_auth_google_callback_js_onRequestGet } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\auth\\google\\callback.js"
import { onRequestGet as __api_admin_stats_js_onRequestGet } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\admin\\stats.js"
import { onRequestGet as __api_auth_google_js_onRequestGet } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\auth\\google.js"
import { onRequestPost as __api_auth_login_js_onRequestPost } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\auth\\login.js"
import { onRequestPost as __api_auth_logout_js_onRequestPost } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\auth\\logout.js"
import { onRequestGet as __api_auth_me_js_onRequestGet } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\auth\\me.js"
import { onRequestPost as __api_auth_register_js_onRequestPost } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\auth\\register.js"
import { onRequestPost as __api_reviews_comment_js_onRequestPost } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\reviews\\comment.js"
import { onRequestPost as __api_reviews_like_js_onRequestPost } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\reviews\\like.js"
import { onRequest as __api_profile_avatar_js_onRequest } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\profile\\avatar.js"
import { onRequestGet as __api_activities_js_onRequestGet } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\activities.js"
import { onRequestPut as __api_profile_js_onRequestPut } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\profile.js"
import { onRequest as __api_reviews_js_onRequest } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\reviews.js"
import { onRequest as __api_users_js_onRequest } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\users.js"
import { onRequest as __api_watchlist_js_onRequest } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\watchlist.js"
import { onRequest as __api__middleware_js_onRequest } from "D:\\Z-A\\VS Code\\Anti\\cineverse\\functions\\api\\_middleware.js"

export const routes = [
    {
      routePath: "/api/auth/google/callback",
      mountPath: "/api/auth/google",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_google_callback_js_onRequestGet],
    },
  {
      routePath: "/api/admin/stats",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_stats_js_onRequestGet],
    },
  {
      routePath: "/api/auth/google",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_google_js_onRequestGet],
    },
  {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_login_js_onRequestPost],
    },
  {
      routePath: "/api/auth/logout",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_logout_js_onRequestPost],
    },
  {
      routePath: "/api/auth/me",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_me_js_onRequestGet],
    },
  {
      routePath: "/api/auth/register",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_register_js_onRequestPost],
    },
  {
      routePath: "/api/reviews/comment",
      mountPath: "/api/reviews",
      method: "POST",
      middlewares: [],
      modules: [__api_reviews_comment_js_onRequestPost],
    },
  {
      routePath: "/api/reviews/like",
      mountPath: "/api/reviews",
      method: "POST",
      middlewares: [],
      modules: [__api_reviews_like_js_onRequestPost],
    },
  {
      routePath: "/api/profile/avatar",
      mountPath: "/api/profile",
      method: "",
      middlewares: [],
      modules: [__api_profile_avatar_js_onRequest],
    },
  {
      routePath: "/api/activities",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_activities_js_onRequestGet],
    },
  {
      routePath: "/api/profile",
      mountPath: "/api",
      method: "PUT",
      middlewares: [],
      modules: [__api_profile_js_onRequestPut],
    },
  {
      routePath: "/api/reviews",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_reviews_js_onRequest],
    },
  {
      routePath: "/api/users",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_users_js_onRequest],
    },
  {
      routePath: "/api/watchlist",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_watchlist_js_onRequest],
    },
  {
      routePath: "/api",
      mountPath: "/api",
      method: "",
      middlewares: [__api__middleware_js_onRequest],
      modules: [],
    },
  ]