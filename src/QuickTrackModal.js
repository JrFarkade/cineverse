import React, { useState, useEffect } from "react";
import { useGlobalContext } from "./context";
import { NavLink } from "react-router-dom";

const API_KEY = process.env.REACT_APP_TMDB_KEY || "96f53db154f4df124746c30c9823648c";
const API_URL = "https://api.tmdb.org/3";

const QuickTrackModal = ({ isOpen, onClose, mediaItem }) => {
  const { currentUser, watchlist, addToWatchlist, updateWatchlistProgress, removeFromWatchlist } = useGlobalContext();

  const [status, setStatus] = useState("Plan to Watch");
  const [personalRating, setPersonalRating] = useState(0);
  const [rewatchCount, setRewatchCount] = useState(0);
  const [episodesWatched, setEpisodesWatched] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mediaId = mediaItem ? String(mediaItem.id || mediaItem.mediaId) : null;
  const existingItem = watchlist.find((item) => String(item.mediaId) === mediaId);

  const concreteType = mediaItem
    ? (mediaItem.media_type || mediaItem.type || (mediaItem.title ? "movie" : "tv"))
    : "movie";
  const isTV = concreteType === "tv" || concreteType === "kdrama" || (concreteType === "anime" && (mediaItem?.originalType === "tv" || !mediaItem?.title));

  useEffect(() => {
    if (!isOpen || !mediaItem) return;

    const initialTotal = mediaItem.number_of_episodes || existingItem?.totalEpisodes || 0;
    setTotalEpisodes(initialTotal);

    if (existingItem) {
      const curStatus = existingItem.status || "Plan to Watch";
      setStatus(curStatus);
      setPersonalRating(existingItem.personalRating || 0);
      setRewatchCount(existingItem.rewatchCount || 0);

      if (curStatus === "Completed" && (!existingItem.episodesWatched || existingItem.episodesWatched === 0) && initialTotal > 0) {
        setEpisodesWatched(initialTotal);
      } else {
        setEpisodesWatched(existingItem.episodesWatched || 0);
      }
    } else {
      setStatus("Plan to Watch");
      setPersonalRating(0);
      setRewatchCount(0);
      setEpisodesWatched(0);
    }
  }, [existingItem, mediaItem, isOpen]);

  // Fetch TMDB TV details to get official number_of_episodes if not readily available
  useEffect(() => {
    if (!isOpen || !mediaId || !isTV) return;

    let isMounted = true;
    const fetchTvEpisodes = async () => {
      try {
        const res = await fetch(`${API_URL}/tv/${mediaId}?api_key=${API_KEY}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data && typeof data.number_of_episodes === "number" && data.number_of_episodes > 0) {
          const total = data.number_of_episodes;
          setTotalEpisodes(total);
          setStatus((curStatus) => {
            if (curStatus === "Completed") {
              setEpisodesWatched(total);
            }
            return curStatus;
          });
        }
      } catch (err) {
        console.error("Failed to fetch TV episode count:", err);
      }
    };

    fetchTvEpisodes();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mediaId, isTV]);

  if (!isOpen || !mediaItem) return null;

  const displayTitle = mediaItem.title || mediaItem.name || "Media Title";
  const posterUrl = mediaItem.poster_path
    ? `https://image.tmdb.org/t/p/w200${mediaItem.poster_path}`
    : "https://via.placeholder.com/150x225?text=No+Poster";

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (isTV) {
      if (newStatus === "Completed") {
        setEpisodesWatched(totalEpisodes > 0 ? totalEpisodes : 0);
      } else if (newStatus === "Plan to Watch") {
        setEpisodesWatched(0);
      }
      // For "Watching", "On Hold", "Dropped": preserve current episodes watched
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);

    const effectiveTotal = isTV ? (totalEpisodes || mediaItem.number_of_episodes || existingItem?.totalEpisodes || 1) : 1;
    let finalEpisodesWatched = isTV ? Number(episodesWatched) : 0;
    if (isTV && status === "Completed" && effectiveTotal > 0 && finalEpisodesWatched === 0) {
      finalEpisodesWatched = effectiveTotal;
    }

    try {
      if (existingItem) {
        await updateWatchlistProgress(mediaId, {
          status,
          personalRating: Number(personalRating),
          rewatchCount: Number(rewatchCount),
          episodesWatched: finalEpisodesWatched,
          totalEpisodes: effectiveTotal,
        });
      } else {
        await addToWatchlist({
          mediaId: String(mediaItem.id),
          title: displayTitle,
          poster_path: mediaItem.poster_path || "",
          type: concreteType,
          status,
          personalRating: Number(personalRating),
          rewatchCount: Number(rewatchCount),
          episodesWatched: finalEpisodesWatched,
          totalEpisodes: effectiveTotal,
        });
      }
      onClose();
    } catch (err) {
      console.error("Error saving quick track:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!existingItem || !window.confirm(`Remove "${displayTitle}" from your library?`)) return;
    setIsSubmitting(true);
    try {
      await removeFromWatchlist(mediaId);
      onClose();
    } catch (err) {
      console.error("Error removing from watchlist:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="quick-modal-backdrop" onClick={onClose}>
      <div className="quick-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="quick-modal-close-btn" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        <div className="quick-modal-header">
          <img src={posterUrl} alt={displayTitle} className="quick-modal-poster" />
          <div className="quick-modal-header-info">
            <span className="quick-modal-action-type">
              {existingItem ? "Edit Library Entry" : "Add to Library"}
            </span>
            <h3 className="quick-modal-title" title={displayTitle}>{displayTitle}</h3>
            <span className="quick-modal-type-tag">{isTV ? "TV Series" : "Movie"}</span>
          </div>
        </div>

        {!currentUser ? (
          <div className="quick-modal-auth-prompt">
            <p>Please log in to track movies and shows in your library.</p>
            <NavLink to="/auth" className="quick-modal-login-btn" onClick={onClose}>
              Log In / Register
            </NavLink>
          </div>
        ) : (
          <form onSubmit={handleSave} className="quick-modal-form">
            <div className="quick-modal-field">
              <label>Status</label>
              <select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
                <option value="Watching">Currently Watching</option>
                <option value="Completed">Completed</option>
                <option value="Plan to Watch">Plan to Watch</option>
                <option value="On Hold">On Hold</option>
                <option value="Dropped">Dropped</option>
              </select>
            </div>

            <div className="quick-modal-field">
              <label>My Rating</label>
              <select
                value={personalRating}
                onChange={(e) => setPersonalRating(Number(e.target.value))}
              >
                <option value="0">Unrated</option>
                {[...Array(10).keys()].map((n) => (
                  <option key={n + 1} value={n + 1}>⭐ {n + 1} / 10</option>
                ))}
              </select>
            </div>

            <div className={isTV ? "quick-modal-row-fields" : "quick-modal-field"}>
              {isTV && (
                <div className="quick-modal-field">
                  <label>Episodes Watched</label>
                  <div className="quick-modal-episode-row">
                    <input
                      type="number"
                      min="0"
                      max={totalEpisodes > 0 ? totalEpisodes : undefined}
                      value={episodesWatched}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setEpisodesWatched(totalEpisodes > 0 ? Math.min(val, totalEpisodes) : val);
                      }}
                    />
                    <span className="quick-modal-ep-total">
                      / {totalEpisodes > 0 ? `${totalEpisodes} eps` : "..."}
                    </span>
                  </div>
                </div>
              )}

              <div className="quick-modal-field">
                <label>Rewatches</label>
                <input
                  type="number"
                  min="0"
                  value={rewatchCount}
                  onChange={(e) => setRewatchCount(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>

            <div className="quick-modal-actions">
              {existingItem && (
                <button
                  type="button"
                  className="quick-modal-remove-btn"
                  onClick={handleRemove}
                  disabled={isSubmitting}
                >
                  Remove
                </button>
              )}
              <button
                type="submit"
                className="quick-modal-save-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : existingItem ? "Update Entry" : "Save to Library"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default QuickTrackModal;
