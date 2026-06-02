-- Users table (supports password logins and Google OAuth logins)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NULL,
  avatar TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user',
  is_suspended INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY, -- Formatted as user_id_media_id
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,          -- movie, tv, kdrama, anime
  original_type TEXT NOT NULL, -- movie, tv
  poster_path TEXT,
  status TEXT NOT NULL,
  personal_rating INTEGER DEFAULT 0,
  episodes_watched INTEGER DEFAULT 0,
  total_episodes INTEGER DEFAULT 1,
  seasons_completed INTEGER DEFAULT 0,
  rewatch_count INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  completion_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_title TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Review Likes table (many-to-many junction)
CREATE TABLE IF NOT EXISTS review_likes (
  review_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (review_id, user_id),
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Review Comments table
CREATE TABLE IF NOT EXISTS review_comments (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Activities table (social feed logs)
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
 