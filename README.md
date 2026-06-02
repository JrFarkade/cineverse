# CineVerse: Media Tracking and Discovery Platform

CineVerse is a media tracking and discovery platform similar to MyAnimeList, Letterboxd, or IMDb. It allows users to search for movies, TV shows, and anime, track their watching progress, write reviews, and follow other users to see their activities.

This project was built using React.js for the frontend, Firebase (Auth + Firestore) for cloud data syncing, and LocalStorage as a fallback database mode for zero-configuration testing.

## 🚀 Key Features

* **Discovery Hub**: Shows trending movies, trending TV shows, upcoming releases, and currently airing anime (via MyAnimeList Jikan API) with smooth carousel scrolling.
* **Personal Watchlists**: Organize movies/TV shows into custom lists: *Watching*, *Completed*, *On Hold*, *Dropped*, and *Plan to Watch*.
* **Watch Progress Tracking**: Track watched episode counts, rewatches, ratings (1-10), and completion dates.
* **Community Reviews & Social Hub**: Write reviews, like reviews, comment on them, and search/follow other users to view their activity feed.
* **User Accounts**: Registration and login using Firebase Auth, with profile pages showing watch stats (hours watched, ratings distribution).
* **Multi-Search Routing**: Seamlessly searches both movies and TV shows and routes to the correct details pages automatically.
* **Hybrid Storage**: Syncs with Firestore if Firebase API keys are provided; otherwise, it falls back to browser LocalStorage.

## 🛠️ Tech Stack

* **Frontend**: React (v18), React Router (v6), HTML5, Vanilla CSS3 Custom variables.
* **APIs**: TMDB (The Movie Database) API, Jikan (MyAnimeList) API.
* **Backend (BaaS)**: Firebase Authentication and Cloud Firestore (optional).
* **Local Fallback**: LocalStorage.

## 📂 File Structure

* `src/App.js` - Routing configuration.
* `src/context.js` - Global states (Auth, watchlist, review hooks, social logs).
* `src/Dashboard.js` - Discovery hub sections and scrollable carousels.
* `src/SingleMovie.js` - Dynamic details view, progress log panel, and comments.
* `src/Watchlist.js` - Categorized personal watchlist panel.
* `src/Profile.js` - User stats calculation (total hours, ratings average).
* `src/SocialFeed.js` - Community updates feed and follow directory.
* `src/Auth.js` - Register and login form module.
* `src/firebase.js` - Firebase client configs.

## ⚙️ Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Setup and Running
1. Clone this project folder.
2. In the folder terminal, run:
   ```bash
   npm install
   ```
3. (Optional) Create a `.env` file in the root directory to customize API keys:
   ```env
   REACT_APP_TMDB_KEY=your_tmdb_api_key
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   ```
   *Note: If Firebase credentials are not provided, the app will run in LocalStorage mode automatically.*

4. Launch the local dev server:
   ```bash
   npm start
   ```
5. Build for production (optional):
   ```bash
   npm run build
   ```
