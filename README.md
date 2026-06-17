# CineVerse: Media Tracking and Discovery Platform

**Live Deployment:** [https://cineverse-6st.pages.dev/](https://cineverse-6st.pages.dev/)

CineVerse is a media tracking and discovery web application, similar to Letterboxd, AniList, or MyAnimeList. It lets users search for movies, TV series, K-dramas, and anime, manage their watchlist progress, write reviews, interact with comments, and follow other users to see their updates.

Originally built on Firebase, this project has been fully migrated to a serverless **Cloudflare-native stack** utilizing Cloudflare Pages, Cloudflare D1 (SQLite), and Cloudflare R2 (Object Storage) for improved performance, simpler architecture, and smaller bundle sizes.

---

## 🚀 Key Features

* **Discovery Hub**: Find what to watch with horizontal carousels showing Trending Movies, Trending TV Shows, Upcoming Releases, and seasonal Top Airing Anime (fetched dynamically from the Jikan MAL API).
* **Track Progress**: Save titles into your personal library with custom statuses (*Watching*, *Completed*, *On Hold*, *Dropped*, *Plan to Watch*). Track episode counts, rewatch counts, and completion dates.
* **Master Rating Synchronization**: 
  - Library ratings and reviews use a single unified score.
  - Updating a score in your library updates your review, and editing a review score updates your library.
  - Writing a review for a title not in your library automatically adds it to your watchlist as `Completed` with that rating.
* **Community Social Feed**: Read and write reviews, like reviews, write comments, and follow other users in a directory to see their live updates.
* **User Profile & Stats**: View library stats such as total hours watched, total titles, episode count breakdown, and your mean rating score.
* **Mobile-First Responsive UI**: Styled with responsive vanilla CSS. Features a bottom navigation bar on mobile (≤ 768px) with custom SVG icons and thumb-friendly touch targets.
* **Admin Control Center**: Admins can suspend or delete user accounts, see system-wide stats, and moderate community reviews directly.

---

## 🛠️ Tech Stack

* **Frontend**: React.js (v18), React Router (v6), Vanilla CSS3.
* **APIs**: TMDB (The Movie Database) API, Jikan (MyAnimeList) API.
* **Backend Functions**: Cloudflare Pages Functions (Serverless endpoints).
* **Database**: Cloudflare D1 (Serverless SQLite).
* **Object Storage**: Cloudflare R2 (for user avatar uploads).
* **Authentication**: Native PBKDF2 cryptography for secure password hashing and JWT-based session tokens stored in secure, HttpOnly cookies. Supports Google OAuth.

---

## 📂 Project Structure

* `/functions/api/` - Backend API endpoints.
  * `auth/` - Registration, login, Google OAuth redirect, and session check handlers.
  * `profile/` - Biography and R2 avatar file upload handlers.
  * `reviews/` - Review creation, likes, comments, edits, and deletions.
  * `watchlist.js` - Watchlist CRUD operations.
* `/src/` - Frontend React application.
  * `Navbar.js` - Responsive navbar (desktop top header vs mobile bottom bar).
  * `Dashboard.js` - Discovery hub sections with scrollable carousels.
  * `SingleMovie.js` - Media details view, rating/tracking panels, and comment section.
  * `Watchlist.js` - Personal library views with scrollable category filters.
  * `Profile.js` - User stats calculation and profile editing forms.
  * `SocialFeed.js` - Community updates feed and follow directory.
  * `Auth.js` - Register and login form module.
  * `AdminDashboard.js` - Admin system summary and user moderation hub.

---

## ⚙️ Getting Started

### Setup and Installation
1. Clone the project repository.
2. In the project root folder, install dependencies:
   ```bash
   npm install
   ```

### Local Development Environment
1. To run the backend functions, D1 database, and R2 storage locally, make sure you have wrangler installed and run:
   ```bash
   npx wrangler pages dev build --port 3001
   ```
2. The dev server uses the local SQLite cache from the `.wrangler` folder and runs on `http://localhost:3001`.
3. Set your TMDB API keys or Google OAuth secrets in a `.dev.vars` file in the root directory if needed.

### Production Build
To create an optimized production build:
```bash
npm run build
```
The resulting build directory is located in `/build` and is ready for automated deployment via Cloudflare Pages.