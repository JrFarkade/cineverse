import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useGlobalContext } from "./context";

const placeholderImg = "https://via.placeholder.com/150x225?text=No+Poster";

const Watchlist = () => {
  const { watchlist, updateWatchlistProgress, removeFromWatchlist } = useGlobalContext();
  const [activeTab, setActiveTab] = useState("All");
  const [filterType, setFilterType] = useState("All"); // All, movie, tv, kdrama, anime

  const tabs = ["All", "Watching", "Completed", "On Hold", "Dropped", "Plan to Watch"];

  const handleIncrementEpisode = async (item) => {
    const nextEpisode = (item.episodesWatched || 0) + 1;
    const isCompleted = nextEpisode >= (item.totalEpisodes || 1);
    
    await updateWatchlistProgress(item.mediaId, {
      episodesWatched: nextEpisode,
      status: isCompleted ? "Completed" : item.status
    });
  };

  const handleStatusChange = async (item, newStatus) => {
    const fields = { status: newStatus };
    if (newStatus === "Completed" && (item.type === "tv" || item.type === "kdrama" || (item.type === "anime" && item.originalType === "tv"))) {
      fields.episodesWatched = item.totalEpisodes || 1;
    }
    await updateWatchlistProgress(item.mediaId, fields);
  };

  const handleRatingChange = async (mediaId, rating) => {
    await updateWatchlistProgress(mediaId, { personalRating: Number(rating) });
  };

  // Filter elements
  const filteredList = watchlist.filter((item) => {
    const matchesTab = activeTab === "All" || item.status.toLowerCase() === activeTab.toLowerCase();
    const matchesType = filterType === "All" || item.type === filterType;
    return matchesTab && matchesType;
  });

  return (
    <div className="container">
      <h2 style={{ textAlign: "center", marginBottom: "3rem", fontSize: "3rem" }}>My Tracked Library</h2>

      {/* Media Type Filters */}
      <div className="filter-buttons">
        <button className={filterType === "All" ? "btn-active" : ""} onClick={() => setFilterType("All")}>All Media</button>
        <button className={filterType === "movie" ? "btn-active" : ""} onClick={() => setFilterType("movie")}>Movies</button>
        <button className={filterType === "tv" ? "btn-active" : ""} onClick={() => setFilterType("tv")}>TV Shows</button>
        <button className={filterType === "kdrama" ? "btn-active" : ""} onClick={() => setFilterType("kdrama")}>K-Dramas</button>
        <button className={filterType === "anime" ? "btn-active" : ""} onClick={() => setFilterType("anime")}>Anime</button>
      </div>

      {/* Tabs */}
      <div className="watchlist-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "tab-btn-active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* List items */}
      <div className="watchlist-container">
        {filteredList.length === 0 ? (
          <div className="empty-message">No titles tracked under "{activeTab}" for the selected filter.</div>
        ) : (
          <div className="watchlist-list">
            {filteredList.map((item) => {
              const poster = item.posterPath
                ? `https://image.tmdb.org/t/p/w154${item.posterPath}`
                : placeholderImg;

              return (
                <div className="watchlist-item" key={item.mediaId}>
                  <img src={poster} alt={item.title} className="watchlist-poster" />
                  
                  <div className="watchlist-details">
                    <NavLink 
                      to={`/${item.originalType || (item.type === "anime" || item.type === "kdrama" ? "tv" : item.type)}/${item.mediaId}`} 
                      state={{ mediaDetails: { id: item.mediaId, title: item.title, type: item.type, poster_path: item.posterPath } }} 
                      className="watchlist-title-link"
                    >
                      <h3>{item.title}</h3>
                    </NavLink>
                    <p className="watchlist-type">{item.type.toUpperCase()}</p>
                    
                    <div className="watchlist-progress-row">
                      <span><strong>Status:</strong></span>
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item, e.target.value)}
                        className="watchlist-select"
                      >
                        <option value="Watching">Watching</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Dropped">Dropped</option>
                        <option value="Plan to Watch">Plan to Watch</option>
                      </select>
                    </div>

                    {(item.type === "tv" || item.type === "kdrama" || (item.type === "anime" && item.originalType === "tv")) && (
                      <div className="watchlist-episodes">
                        <span><strong>Episodes:</strong></span>
                        <span>{item.episodesWatched} / {item.totalEpisodes || "N/A"}</span>
                        {item.status !== "Completed" && (
                          <button
                            className="ep-inc-btn"
                            onClick={() => handleIncrementEpisode(item)}
                          >
                            +1 Ep
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="watchlist-scoring">
                    <div className="personal-rating-select">
                      <span><strong>Score:</strong></span>
                      <select
                        value={item.personalRating || 0}
                        onChange={(e) => handleRatingChange(item.mediaId, e.target.value)}
                        className="watchlist-rating-select"
                      >
                        <option value="0">Select Score</option>
                        {[...Array(10).keys()].map((n) => (
                          <option key={n + 1} value={n + 1}>
                            ({n + 1}) {n === 9 ? "Masterpiece" : n === 8 ? "Great" : n === 6 ? "Good" : n === 4 ? "Average" : n === 0 ? "Appalling" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="watchlist-remove-btn"
                      onClick={() => removeFromWatchlist(item.mediaId)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Watchlist;
