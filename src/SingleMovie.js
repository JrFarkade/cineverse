import React, { useState, useEffect } from "react";
import { NavLink, useParams, useLocation, useNavigate } from "react-router-dom";
import { useGlobalContext } from "./context";

const API_KEY = process.env.REACT_APP_TMDB_KEY || "96f53db154f4df124746c30c9823648c";
const API_URL = "https://api.tmdb.org/3";

const SingleMovie = () => {
  const { type, id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize movie state with passed basic details if available
  const [movie, setMovie] = useState(location.state?.mediaDetails || null);
  const [isError, setIsError] = useState({ show: "false", msg: "" });

  useEffect(() => {
    const fetchDetails = async () => {
      // If we already have the full details (e.g. genres is populated), we don't need to load again
      if (movie && movie.genres && (movie.runtime || movie.number_of_episodes)) {
        return;
      }

      try {
        const res = await fetch(`${API_URL}/${type}/${id}?api_key=${API_KEY}`);
        if (res.ok) {
          const data = await res.json();
          setMovie((prev) => ({ ...prev, ...data }));
          setIsError({ show: "false", msg: "" });
        } else {
          const data = await res.json();
          if (!movie) {
            setIsError({ show: "true", msg: data.status_message || "Something went wrong." });
          }
        }
      } catch (err) {
        console.error("Fetch error details:", err);
        if (!movie) {
          setIsError({ show: "true", msg: "Failed to fetch data." });
        }
      }
    };

    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  // 2. Consume global watchlist & social actions from Context
  const { 
    currentUser, 
    watchlist, 
    addToWatchlist, 
    removeFromWatchlist,
    reviews,
    addReview,
    likeReview,
    addCommentToReview,
    deleteReview,
    editReview,
    editComment,
    deleteComment
  } = useGlobalContext();

  const watchlistItem = watchlist.find((item) => item.mediaId === String(id));

  // Tracking Panel States
  const [status, setStatus] = useState("Plan to Watch");
  const [personalRating, setPersonalRating] = useState(0);
  const [episodesWatched, setEpisodesWatched] = useState("");
  const [episodesError, setEpisodesError] = useState("");
  const [rewatchCount, setRewatchCount] = useState(0);

  // Review States
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(10);
  
  // Comment State Map (reviewId -> comment text)
  const [commentInputs, setCommentInputs] = useState({});

  // Image load tracking state
  const [imageLoaded, setImageLoaded] = useState(false);

  // Review Editing States
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editingReviewText, setEditingReviewText] = useState("");
  const [editingReviewRating, setEditingReviewRating] = useState(10);

  // Comment Editing States
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  useEffect(() => {
    setImageLoaded(false);
  }, [id]);

  useEffect(() => {
    if (watchlistItem) {
      setStatus(watchlistItem.status);
      setPersonalRating(watchlistItem.personalRating || 0);
      setEpisodesWatched(watchlistItem.episodesWatched !== undefined ? String(watchlistItem.episodesWatched) : "0");
      setRewatchCount(watchlistItem.rewatchCount || 0);
      if (watchlistItem.personalRating && watchlistItem.personalRating > 0) {
        setReviewRating(watchlistItem.personalRating);
      }
    } else {
      setStatus("Plan to Watch");
      setPersonalRating(0);
      setEpisodesWatched("0");
      setRewatchCount(0);
      setReviewRating(10);
    }
    setEpisodesError("");
  }, [watchlistItem, id]);

  if (isError.show === "true" && !movie) {
    return (
      <section className="movie-section">
        <div className="loading" style={{ color: "red" }}>{isError.msg || "Movie details not found."}</div>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a href="#" onClick={(e) => { e.preventDefault(); navigate(-1); }} className="back-btn">
          Go Back
        </a>
      </section>
    );
  }

  if (!movie) {
    return (
      <section className="detail-page-container">
        <div className="movie-detail-card" style={{ minHeight: "400px", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div className="loading" style={{ fontSize: "2rem" }}>Loading details...</div>
        </div>
      </section>
    );
  }

  // Determine media type (using the URL type parameter)
  const isTV = type === "tv";
  const totalEpisodes = movie.number_of_episodes || (isTV ? 12 : 1);

  const posterImg = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
    : "https://via.placeholder.com/500x750?text=No+Poster";

  const genresList = movie.genres 
    ? movie.genres.map((g) => g.name).join(", ") 
    : "N/A";

  const countriesList = movie.production_countries 
    ? movie.production_countries.map((c) => c.name).join(", ") 
    : "N/A";

  const languagesList = movie.spoken_languages 
    ? movie.spoken_languages.map((l) => l.english_name || l.name).join(", ") 
    : "N/A";

  const handleEpisodeChange = (val) => {
    if (val === "") {
      setEpisodesWatched("");
      setEpisodesError("");
      return;
    }

    const num = Number(val);
    if (isNaN(num)) return;

    if (num < 0) {
      setEpisodesError("Episode count cannot be negative");
      setEpisodesWatched(val);
    } else if (num > totalEpisodes) {
      setEpisodesError(`Cannot exceed total episodes (${totalEpisodes})`);
      setEpisodesWatched(val);
    } else {
      setEpisodesError("");
      setEpisodesWatched(num);
    }
  };

  const handleStatusChangeInForm = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === "Completed" && isTV) {
      setEpisodesWatched(String(totalEpisodes));
      setEpisodesError("");
    }
  };

  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    if (episodesError) return;
    const epCount = episodesWatched === "" ? 0 : Number(episodesWatched);
    await addToWatchlist(
      movie,
      status,
      personalRating,
      isTV ? epCount : 0,
      totalEpisodes,
      isTV ? (epCount >= totalEpisodes ? 1 : 0) : 0,
      rewatchCount
    );
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewText.trim()) return;
    await addReview(id, movie, reviewText, reviewRating);
    setReviewText("");
  };

  const handleCommentSubmit = async (e, reviewId) => {
    e.preventDefault();
    const commentText = commentInputs[reviewId];
    if (!commentText || !commentText.trim()) return;

    await addCommentToReview(reviewId, commentText);
    setCommentInputs((prev) => ({ ...prev, [reviewId]: "" }));
  };

  const handleReviewEditSubmit = async (e, reviewId) => {
    e.preventDefault();
    if (!editingReviewText.trim()) return;
    await editReview(reviewId, editingReviewText, editingReviewRating);
    setEditingReviewId(null);
  };

  const handleCommentEditSubmit = async (e, commentId) => {
    e.preventDefault();
    if (!editingCommentText.trim()) return;
    await editComment(commentId, editingCommentText);
    setEditingCommentId(null);
  };

  const movieReviews = reviews.filter((r) => r.mediaId === String(id));
  const isAnime = movie?.genres?.some(g => g.id === 16) && movie?.original_language === "ja";
  const isKdrama = type === "tv" && movie?.original_language === "ko";

  return (
    <section className="detail-page-container">
      {/* 1. Main Media Card */}
      <div className="movie-detail-card">
        <figure className="detail-poster-figure">
          {!imageLoaded && <div className="poster-skeleton"></div>}
          <img 
            src={posterImg} 
            alt={movie.title || movie.name || "Poster"} 
            onLoad={() => setImageLoaded(true)}
            style={{ 
              opacity: imageLoaded ? 1 : 0, 
              transition: "opacity 0.3s ease-in-out" 
            }} 
          />
        </figure>

        
        <div className="detail-info-content">
          <h2 className="detail-title">{movie.title || movie.name}</h2>
          {movie.tagline && <p className="detail-tagline">"{movie.tagline}"</p>}
          
          <p className="detail-overview">{movie.overview}</p>
          
          <div className="detail-metadata-grid">
            <p><strong>Type:</strong> {isAnime ? "Anime" : (isKdrama ? "K-Drama" : (isTV ? "TV Series" : "Movie"))}</p>
            <p><strong>Release Date:</strong> {movie.release_date || movie.first_air_date || "N/A"}</p>
            <p><strong>Status:</strong> {movie.status || "N/A"}</p>
            <p><strong>Genres:</strong> {genresList}</p>
            <p><strong>Rating:</strong> ⭐ {movie.vote_average ? `${movie.vote_average.toFixed(1)} / 10` : "N/A"}</p>
            <p><strong>Country:</strong> {countriesList}</p>
            <p><strong>Runtime:</strong> {movie.runtime ? `${movie.runtime} min` : "N/A"}</p>
            <p><strong>Language:</strong> {languagesList}</p>
            {isTV && <p><strong>Total Episodes:</strong> {totalEpisodes}</p>}
          </div>

          <div style={{ marginTop: "2rem" }}>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a href="#" onClick={(e) => { e.preventDefault(); navigate(-1); }} className="back-btn" style={{ display: "inline-block", padding: "1rem 2.5rem" }}>
              Go Back
            </a>
          </div>
        </div>
      </div>

      {/* 2. Track & Organize Panel */}
      <div className="tracking-panel">
        <h3>Track progress</h3>
        {currentUser ? (
          <form onSubmit={handleTrackSubmit} className="track-form">
            <div className="track-grid">
              {/* Status */}
              <div className="track-field">
                <label>Status</label>
                <select value={status} onChange={(e) => handleStatusChangeInForm(e.target.value)}>
                  <option value="Watching">Currently Watching</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Dropped">Dropped</option>
                  <option value="Plan to Watch">Plan to Watch</option>
                </select>
              </div>

              {/* Personal Rating */}
              <div className="track-field">
                <label>My Score (1-10)</label>
                <select
                  value={personalRating}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPersonalRating(val);
                    if (val > 0) {
                      setReviewRating(val);
                    }
                  }}
                >
                  <option value="0">Unrated</option>
                  {[...Array(10).keys()].map((n) => (
                    <option key={n + 1} value={n + 1}>⭐ {n + 1}</option>
                  ))}
                </select>
              </div>

              {/* TV Specific Fields */}
              {isTV && (
                <div className="track-field">
                  <label>Episodes Watched</label>
                  <div className="episode-input-row">
                    <input
                      type="number"
                      min="0"
                      max={totalEpisodes}
                      value={episodesWatched}
                      onChange={(e) => handleEpisodeChange(e.target.value)}
                    />
                    <span>/ {totalEpisodes}</span>
                  </div>
                  {episodesError && (
                    <p style={{ color: "red", fontSize: "1.1rem", marginTop: "0.5rem" }}>
                      {episodesError}
                    </p>
                  )}
                </div>
              )}

              {/* Rewatch Count */}
              <div className="track-field">
                <label>Rewatches</label>
                <input
                  type="number"
                  min="0"
                  value={rewatchCount}
                  onChange={(e) => setRewatchCount(Number(e.target.value))}
                  style={{ width: "80px" }}
                />
              </div>
            </div>

            <div className="track-actions-row">
              <button type="submit" className="save-track-btn" disabled={!!episodesError}>
                {watchlistItem ? "Update Progress" : "Add to Library"}
              </button>
              {watchlistItem && (
                <button
                  type="button"
                  className="delete-track-btn"
                  onClick={() => removeFromWatchlist(id)}
                >
                  Remove Title
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="auth-prompt-tracking">
            <p>Please log in to manage your tracking list, rate, and review.</p>
            <NavLink to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} className="auth-link-btn">Login / Register</NavLink>
          </div>
        )}
      </div>

      {/* 3. Community Reviews Section */}
      <div className="reviews-section">
        <h3>Community Reviews</h3>

        {/* Add Review Form */}
        {currentUser && (
          <form onSubmit={handleReviewSubmit} className="add-review-form">
            <h4 style={{ marginBottom: "1rem" }}>Write a Review</h4>
            <div className="review-rating-row">
              <label>My Review Score:</label>
              <select
                value={reviewRating}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setReviewRating(val);
                  setPersonalRating(val);
                }}
              >
                {[...Array(10).keys()].map((n) => (
                  <option key={n + 1} value={n + 1}>⭐ {n + 1}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Write your review here. What did you think of the characters, the plot, the pacing?"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows="4"
              required
            ></textarea>
            <button type="submit" className="submit-review-btn">Publish Review</button>
          </form>
        )}

        {/* Reviews List */}
        <div className="reviews-list" style={{ marginTop: "3rem" }}>
          {movieReviews.length === 0 ? (
            <p className="no-reviews-msg">No reviews yet. Be the first to share your thoughts!</p>
          ) : (
            movieReviews.map((rev) => (
              <div className="review-item-card" key={rev.id}>
                <div className="review-user-header">
                  <img src={rev.avatar} alt={rev.username} className="review-avatar" />
                  <div className="review-user-meta">
                    <span className="review-username">{rev.username}</span>
                    <span className="review-score">Rated ⭐ {rev.rating}</span>
                  </div>
                  <span className="review-date">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                {editingReviewId === rev.id ? (
                  <form onSubmit={(e) => handleReviewEditSubmit(e, rev.id)} className="add-review-form" style={{ marginTop: "1rem" }}>
                    <div className="review-rating-row">
                      <label>Edit Review Score:</label>
                      <select
                        value={editingReviewRating}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingReviewRating(val);
                          setPersonalRating(val);
                        }}
                      >
                        {[...Array(10).keys()].map((n) => (
                          <option key={n + 1} value={n + 1}>⭐ {n + 1}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={editingReviewText}
                      onChange={(e) => setEditingReviewText(e.target.value)}
                      rows="4"
                      required
                    ></textarea>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                      <button type="submit" className="submit-review-btn">Save</button>
                      <button type="button" onClick={() => setEditingReviewId(null)} className="back-btn" style={{ padding: "0.5rem 1.5rem", fontSize: "1.3rem" }}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="review-text-content">{rev.content}</p>

                    <div className="review-actions-bar">
                      <button 
                        className={`like-btn-style ${rev.likes?.includes(currentUser?.uid) ? "liked" : ""}`}
                        onClick={() => likeReview(rev.id)}
                        disabled={!currentUser}
                      >
                        👍 Like ({rev.likes?.length || 0})
                      </button>
                      {currentUser && (rev.userId === currentUser.uid || currentUser.role === "admin") && (
                        <div style={{ display: "flex", gap: "1rem" }}>
                          {rev.userId === currentUser.uid && (
                            <button 
                              className="btn-edit-action"
                              onClick={() => {
                                setEditingReviewId(rev.id);
                                setEditingReviewText(rev.content);
                                setEditingReviewRating(rev.rating);
                              }}
                            >
                              ✏️ Edit
                            </button>
                          )}
                          <button 
                            className="btn-delete-action"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this review?")) {
                                deleteReview(rev.id);
                              }
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Comments block */}
                <div className="comments-block">
                  <h5>Comments ({rev.comments?.length || 0})</h5>
                  
                  {rev.comments && rev.comments.map((c, idx) => (
                    <div className="comment-item" key={c.id || idx}>
                      <img src={c.avatar} alt={c.username} className="comment-avatar" />
                      <div className="comment-details" style={{ width: "100%" }}>
                        <span className="comment-user">{c.username}</span>
                        {editingCommentId === c.id ? (
                          <form onSubmit={(e) => handleCommentEditSubmit(e, c.id)} style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", width: "100%" }}>
                            <input
                              type="text"
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              required
                              style={{ flexGrow: 1, padding: "0.5rem 1rem", fontSize: "1.3rem" }}
                            />
                            <button type="submit" style={{ padding: "0.3rem 1rem", fontSize: "1.2rem", background: "#2ecc71", color: "white", border: "none", borderRadius: "0.4rem", cursor: "pointer" }}>Save</button>
                            <button type="button" onClick={() => setEditingCommentId(null)} style={{ padding: "0.3rem 1rem", fontSize: "1.2rem", background: "#95a5a6", color: "white", border: "none", borderRadius: "0.4rem", cursor: "pointer" }}>Cancel</button>
                          </form>
                        ) : (
                          <>
                            <p className="comment-text">{c.text}</p>
                            {currentUser && (c.userId === currentUser.uid || currentUser.role === "admin") && (
                              <div style={{ display: "flex", gap: "1rem", marginTop: "0.3rem" }}>
                                {c.userId === currentUser.uid && (
                                  <button 
                                    className="btn-edit-action"
                                    style={{ fontSize: "1.1rem", padding: "0.1rem 0.4rem" }}
                                    onClick={() => {
                                      setEditingCommentId(c.id);
                                      setEditingCommentText(c.text);
                                    }}
                                  >
                                    Edit
                                  </button>
                                )}
                                <button 
                                  className="btn-delete-action"
                                  style={{ fontSize: "1.1rem", padding: "0.1rem 0.4rem" }}
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to delete this comment?")) {
                                      deleteComment(c.id);
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {currentUser && (
                    <form onSubmit={(e) => handleCommentSubmit(e, rev.id)} className="comment-form">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={commentInputs[rev.id] || ""}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [rev.id]: e.target.value })}
                        required
                      />
                      <button type="submit">Reply</button>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Sleek inline styles for Edit/Delete buttons */}
      <style>{`
        .btn-edit-action, .btn-delete-action {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.2rem;
          font-weight: 600;
          padding: 0.3rem 0.6rem;
          border-radius: 0.4rem;
          transition: all 0.2s;
        }
        .btn-edit-action {
          color: #3498db;
        }
        .btn-edit-action:hover {
          background: rgba(52, 152, 219, 0.1);
        }
        .btn-delete-action {
          color: #e74c3c;
        }
        .btn-delete-action:hover {
          background: rgba(231, 76, 60, 0.1);
        }
        .comment-details {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
      `}</style>
    </section>
  );
};

export default SingleMovie;
 