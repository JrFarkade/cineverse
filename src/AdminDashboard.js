import React, { useState } from "react";
import { useGlobalContext } from "./context";

const AdminDashboard = () => {
  const { 
    usersList, 
    reviews, 
    getSocialFeed, 
    getUserWatchlist, 
    updateUserStatus, 
    deleteUser,
    allWatchlists,
    deleteReview
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserWatchlist, setSelectedUserWatchlist] = useState([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("watchlist"); // watchlist, reviews, activity

  const handleDeleteReview = async (reviewId, mediaTitle) => {
    if (window.confirm(`Are you sure you want to delete the review for "${mediaTitle}"? This action cannot be undone.`)) {
      try {
        await deleteReview(reviewId);
      } catch (err) {
        console.error("Error deleting review:", err);
      }
    }
  };

  // Global Database Statistics
  const globalTotalUsers = usersList.filter(u => u.username !== "@Jrfarkade").length;
  const globalActiveUsers = usersList.filter(u => u.username !== "@Jrfarkade" && !u.isSuspended).length;
  const globalSuspendedUsers = usersList.filter(u => u.username !== "@Jrfarkade" && u.isSuspended).length;
  
  const todayStr = new Date().toISOString().split("T")[0];
  const globalNewUsersToday = usersList.filter(u => u.username !== "@Jrfarkade" && u.createdAt === todayStr).length;

  const globalMoviesCount = (allWatchlists || []).filter(i => i.type === "movie").length;
  const globalTvCount = (allWatchlists || []).filter(i => i.type === "tv").length;
  const globalKdramasCount = (allWatchlists || []).filter(i => i.type === "kdrama").length;
  const globalAnimeCount = (allWatchlists || []).filter(i => i.type === "anime").length;
  const globalTotalReviews = (reviews || []).length;
  const globalTotalTracked = (allWatchlists || []).length;

  const filteredUsers = usersList.filter(u => 
    u.username !== "@Jrfarkade" && (
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setLoadingWatchlist(true);
    try {
      const list = await getUserWatchlist(user.uid);
      setSelectedUserWatchlist(list);
    } catch (err) {
      console.error("Error fetching user watchlist:", err);
    } finally {
      setLoadingWatchlist(false);
    }
  };

  const handleToggleSuspend = async (user) => {
    const nextSuspended = !user.isSuspended;
    const actionText = nextSuspended ? "suspend" : "reactivate";
    if (window.confirm(`Are you sure you want to ${actionText} user ${user.username}?`)) {
      await updateUserStatus(user.uid, nextSuspended);
      if (selectedUser && selectedUser.uid === user.uid) {
        setSelectedUser(prev => ({ ...prev, isSuspended: nextSuspended }));
      }
    }
  };

  const handleDelete = async (user) => {
    if (window.confirm(`WARNING: Are you sure you want to permanently delete user ${user.username}? This will remove all their tracking lists and data. This action cannot be undone.`)) {
      await deleteUser(user.uid);
      if (selectedUser && selectedUser.uid === user.uid) {
        setSelectedUser(null);
        setSelectedUserWatchlist([]);
      }
    }
  };

  // 1. Calculate Selected User Statistics
  const totalItems = selectedUserWatchlist.length;

  const moviesCount = selectedUserWatchlist.filter(i => i.type === "movie").length;
  const tvCount = selectedUserWatchlist.filter(i => i.type === "tv").length;
  const animeCount = selectedUserWatchlist.filter(i => i.type === "anime").length;
  const kdramasCount = selectedUserWatchlist.filter(i => i.type === "kdrama").length;

  const totalEpisodesWatched = selectedUserWatchlist
    .filter(i => i.type === "tv" || i.type === "kdrama" || (i.type === "anime" && i.originalType === "tv"))
    .reduce((acc, curr) => acc + (curr.episodesWatched || 0), 0);

  const tvHours = (totalEpisodesWatched * 30) / 60;

  const movieHours = selectedUserWatchlist
    .filter(i => i.type === "movie" || (i.type === "anime" && i.originalType === "movie"))
    .reduce((acc, curr) => {
      if (curr.status === "Completed") return acc + 2;
      if (curr.status === "Watching") return acc + 1;
      return acc;
    }, 0);

  const totalHours = Math.round(movieHours + tvHours);

  const ratedMovies = selectedUserWatchlist.filter(i => i.personalRating && i.personalRating > 0);
  const averageScore = ratedMovies.length > 0
    ? (ratedMovies.reduce((acc, curr) => acc + curr.personalRating, 0) / ratedMovies.length).toFixed(1)
    : "N/A";

  // Filter reviews and activities for selected user
  const userReviews = reviews.filter(r => r.userId === selectedUser?.uid);
  const userActivities = getSocialFeed().filter(a => a.userId === selectedUser?.uid);

  return (
    <div className="container">
      {/* Scope Component Styling */}
      <style>{`
        .admin-layout {
          display: grid;
          grid-template-columns: 32rem 1fr;
          gap: 3rem;
          margin-top: 2rem;
        }
        .admin-sidebar {
          background: white;
          padding: 2.5rem;
          border-radius: 1.5rem;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          align-self: start;
        }
        .admin-content {
          background: white;
          padding: 3rem;
          border-radius: 1.5rem;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          min-height: 50rem;
        }
        .admin-search-input {
          width: 100%;
          margin-bottom: 2rem;
          margin-top: 0.5rem;
          padding: 0.8rem 1.5rem;
          font-size: 1.4rem;
        }
        .admin-user-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 50rem;
          overflow-y: auto;
          padding-right: 0.5rem;
        }
        .admin-user-list::-webkit-scrollbar {
          width: 4px;
        }
        .admin-user-list::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 4px;
        }
        .admin-user-card {
          display: flex;
          align-items: center;
          gap: 1.2rem;
          padding: 1rem;
          border-radius: 0.8rem;
          background: var(--bg-clr);
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }
        .admin-user-card:hover {
          background: #e2e8f0;
        }
        .admin-user-card.active {
          border-color: var(--text-clr);
          background: rgba(74, 92, 108, 0.1);
        }
        .admin-user-card-avatar {
          width: 4rem;
          height: 4rem;
          border-radius: 50%;
        }
        .admin-user-card-info {
          flex-grow: 1;
          overflow: hidden;
        }
        .admin-user-card-info h4 {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-clr);
          margin-bottom: 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .admin-user-card-info p {
          font-size: 1.1rem;
          color: #666;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .status-badge {
          padding: 0.2rem 0.6rem;
          font-size: 1rem;
          font-weight: 600;
          border-radius: 0.4rem;
          text-transform: uppercase;
        }
        .status-badge.suspended {
          background: #fee2e2;
          color: #ef4444;
        }
        .status-badge.active-status {
          background: rgba(46, 204, 113, 0.15);
          color: #2ecc71;
        }
        .admin-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #f2f4fc;
          padding-bottom: 2rem;
          margin-bottom: 3rem;
        }
        .admin-detail-actions {
          display: flex;
          gap: 1.2rem;
        }
        .admin-action-btn {
          padding: 0.8rem 1.6rem;
          font-size: 1.3rem;
          font-weight: 600;
          border-radius: 0.6rem;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .btn-suspend {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fca5a5;
        }
        .btn-suspend:hover {
          background: #ef4444;
          color: white;
        }
        .btn-reactivate {
          background: rgba(46, 204, 113, 0.15);
          color: #2ecc71;
          border-color: #a7f3d0;
        }
        .btn-reactivate:hover {
          background: #2ecc71;
          color: white;
        }
        .btn-delete {
          background: #f1f5f9;
          color: #64748b;
          border-color: #cbd5e1;
        }
        .btn-delete:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .admin-sub-tabs {
          display: flex;
          gap: 1.5rem;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 2.5rem;
          padding-bottom: 1rem;
        }
        .admin-sub-tab-btn {
          padding: 0.8rem 1.5rem;
          font-size: 1.4rem;
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
          border-bottom: 2px solid transparent;
          margin-bottom: -1.2rem;
          transition: all 0.2s ease;
        }
        .admin-sub-tab-btn.active {
          color: var(--text-clr);
          font-weight: 700;
          border-bottom-color: var(--text-clr);
        }
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 1.3rem;
        }
        .admin-table th, .admin-table td {
          padding: 1.2rem;
          text-align: left;
          border-bottom: 1px solid #f1f5f9;
        }
        .admin-table th {
          font-weight: 600;
          color: #555;
          background: #f8fafc;
        }
        @media (max-width: 998px) {
          .admin-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <h2 style={{ fontSize: "2.8rem", marginBottom: "3rem", fontWeight: "700" }}>Admin Control Center</h2>

      <div className="admin-layout">
        {/* Left Sidebar: Users Search & List */}
        <div className="admin-sidebar">
          <h3 style={{ fontSize: "1.6rem", fontWeight: "600", marginBottom: "1.5rem" }}>Users Accounts ({filteredUsers.length})</h3>
          <input 
            type="text" 
            placeholder="Search username/email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search-input"
          />
          <div className="admin-user-list">
            {filteredUsers.length === 0 ? (
              <p style={{ fontSize: "1.3rem", color: "#888", textAlign: "center", marginTop: "2rem" }}>No users found.</p>
            ) : (
              filteredUsers.map(u => (
                <div 
                  key={u.uid} 
                  onClick={() => handleSelectUser(u)}
                  className={`admin-user-card ${selectedUser?.uid === u.uid ? "active" : ""}`}
                >
                  <img src={u.avatar} alt={u.username} className="admin-user-card-avatar" />
                  <div className="admin-user-card-info">
                    <h4>{u.username}</h4>
                    <p>{u.email}</p>
                  </div>
                  {u.isSuspended ? (
                    <span className="status-badge suspended">Suspended</span>
                  ) : (
                    <span className="status-badge active-status">Active</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar: Selected User Audit Details */}
        <div className="admin-content">
          {!selectedUser ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", borderBottom: "2px solid #f2f4fc", paddingBottom: "1.5rem" }}>
                <span style={{ fontSize: "3rem" }}>📊</span>
                <div>
                  <h3 style={{ fontSize: "2.2rem", fontWeight: "700", color: "var(--text-clr)" }}>System Overview</h3>
                  <p style={{ fontSize: "1.3rem", color: "#666" }}>Real-time statistics across CineVerse database</p>
                </div>
              </div>

              {/* Global Stats Grid */}
              <div className="stats-grid">
                <div className="stat-box" style={{ padding: "2rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.8rem", color: "var(--text-clr)" }}>{globalTotalUsers}</span>
                  <span className="stat-label" style={{ fontSize: "1.2rem", fontWeight: "600" }}>Total Users</span>
                </div>
                <div className="stat-box" style={{ padding: "2rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.8rem", color: "var(--text-clr)" }}>{globalTotalTracked}</span>
                  <span className="stat-label" style={{ fontSize: "1.2rem", fontWeight: "600" }}>Total Tracked</span>
                </div>
                <div className="stat-box" style={{ padding: "2rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.8rem", color: "#e74c3c" }}>{globalMoviesCount}</span>
                  <span className="stat-label" style={{ fontSize: "1.2rem", fontWeight: "600" }}>Movies Tracked</span>
                </div>
                <div className="stat-box" style={{ padding: "2rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.8rem", color: "#3498db" }}>{globalTvCount}</span>
                  <span className="stat-label" style={{ fontSize: "1.2rem", fontWeight: "600" }}>TV Shows Tracked</span>
                </div>
                <div className="stat-box" style={{ padding: "2rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.8rem", color: "#9b59b6" }}>{globalKdramasCount}</span>
                  <span className="stat-label" style={{ fontSize: "1.2rem", fontWeight: "600" }}>K-Dramas Tracked</span>
                </div>
                <div className="stat-box" style={{ padding: "2rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.8rem", color: "#2ecc71" }}>{globalAnimeCount}</span>
                  <span className="stat-label" style={{ fontSize: "1.2rem", fontWeight: "600" }}>Anime Tracked</span>
                </div>
                <div className="stat-box" style={{ padding: "2rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.8rem", color: "#f39c12" }}>{globalTotalReviews}</span>
                  <span className="stat-label" style={{ fontSize: "1.2rem", fontWeight: "600" }}>Total Reviews</span>
                </div>
              </div>

              {/* User Account Breakdown */}
              <div style={{ background: "var(--bg-clr)", padding: "2rem", borderRadius: "1.2rem" }}>
                <h4 style={{ fontSize: "1.6rem", fontWeight: "700", marginBottom: "1.5rem", color: "var(--text-clr)" }}>User Account Breakdown</h4>
                <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "1.3rem" }}>
                    🟢 Active Accounts: <strong style={{ color: "#2ecc71", fontSize: "1.5rem" }}>{globalActiveUsers}</strong>
                  </div>
                  <div style={{ fontSize: "1.3rem" }}>
                    🔴 Suspended Accounts: <strong style={{ color: "#e74c3c", fontSize: "1.5rem" }}>{globalSuspendedUsers}</strong>
                  </div>
                  <div style={{ fontSize: "1.3rem" }}>
                    📅 Registered Today: <strong style={{ color: "#3498db", fontSize: "1.5rem" }}>{globalNewUsersToday}</strong>
                  </div>
                </div>
              </div>

              {/* Recent Reviews Moderation Hub */}
              <div>
                <h4 style={{ fontSize: "1.6rem", fontWeight: "700", marginBottom: "1.5rem", color: "var(--text-clr)" }}>Recent Reviews (Moderation Hub)</h4>
                {reviews.length === 0 ? (
                  <p style={{ fontSize: "1.4rem", color: "#888", padding: "2.5rem", background: "var(--bg-clr)", borderRadius: "1rem", textAlign: "center" }}>No reviews written on the platform yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {reviews.slice(0, 10).map((rev) => (
                      <div key={rev.id} style={{ background: "var(--bg-clr)", padding: "1.5rem", borderRadius: "1rem", position: "relative" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem", fontSize: "1.2rem", color: "#666" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                            <img src={rev.avatar} alt={rev.username} style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", objectFit: "cover", margin: 0 }} />
                            <strong style={{ color: "var(--text-clr)" }}>@{rev.username}</strong>
                            <span>on</span>
                            <strong style={{ color: "var(--text-clr)" }}>{rev.mediaTitle}</strong>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                            <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
                            <button 
                              onClick={() => handleDeleteReview(rev.id, rev.mediaTitle)}
                              style={{ 
                                background: "#fee2e2", 
                                color: "#ef4444", 
                                border: "1px solid #fca5a5", 
                                borderRadius: "0.4rem", 
                                padding: "0.2rem 0.6rem", 
                                cursor: "pointer",
                                fontSize: "1.1rem",
                                fontWeight: "600"
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: "1.3rem", color: "#333", lineHeight: "1.4", margin: "0.5rem 0" }}>"{rev.content}"</p>
                        <div style={{ marginTop: "0.8rem", fontSize: "1.2rem", color: "#f39c12", fontWeight: "600" }}>
                          Score: ⭐ {rev.rating}/10
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructions Helper */}
              <div style={{ color: "#94a3b8", textAlign: "center", borderTop: "1px solid #e2e8f0", paddingTop: "2rem", fontSize: "1.3rem", marginTop: "1rem" }}>
                💡 Select a user from the sidebar list to inspect their individual profile data, watchlist progress, and activities.
              </div>
            </div>
          ) : (
            <div>
              {/* Header Info */}
              <div className="admin-detail-header">
                <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
                  <img 
                    src={selectedUser.avatar} 
                    alt={selectedUser.username} 
                    style={{ width: "7rem", height: "7rem", borderRadius: "50%", objectFit: "cover" }} 
                  />
                  <div>
                    <h3 style={{ fontSize: "2.2rem", fontWeight: "700" }}>{selectedUser.username}</h3>
                    <p style={{ fontSize: "1.3rem", color: "#666" }}>{selectedUser.email}</p>
                    <p style={{ fontSize: "1.2rem", color: "#999", marginTop: "0.2rem" }}>Account Created: <strong>{selectedUser.createdAt || "N/A"}</strong></p>
                  </div>
                </div>

                <div className="admin-detail-actions">
                  <button 
                    onClick={() => handleToggleSuspend(selectedUser)} 
                    className={`admin-action-btn ${selectedUser.isSuspended ? "btn-reactivate" : "btn-suspend"}`}
                  >
                    {selectedUser.isSuspended ? "Reactivate User" : "Suspend User"}
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedUser)} 
                    className="admin-action-btn btn-delete"
                  >
                    Delete User
                  </button>
                </div>
              </div>

              {/* Biography Summary */}
              {selectedUser.bio && (
                <div style={{ background: "var(--bg-clr)", padding: "1.5rem", borderRadius: "0.8rem", marginBottom: "3.5rem", fontSize: "1.3rem" }}>
                  <h4 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>User Biography:</h4>
                  <p style={{ fontStyle: "italic", color: "#555", whiteSpace: "pre-wrap" }}>"{selectedUser.bio}"</p>
                </div>
              )}

              {/* Stats Overview */}
              <div className="stats-grid" style={{ marginBottom: "4rem" }}>
                <div className="stat-box" style={{ padding: "1.5rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.4rem" }}>{totalHours}</span>
                  <span className="stat-label" style={{ fontSize: "1.1rem" }}>Hours Watched</span>
                </div>
                <div className="stat-box" style={{ padding: "1.5rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.4rem" }}>{totalItems}</span>
                  <span className="stat-label" style={{ fontSize: "1.1rem" }}>Tracked Titles</span>
                </div>
                <div className="stat-box" style={{ padding: "1.5rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.4rem" }}>{moviesCount}</span>
                  <span className="stat-label" style={{ fontSize: "1.1rem" }}>Movies</span>
                </div>
                <div className="stat-box" style={{ padding: "1.5rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.4rem" }}>{tvCount}</span>
                  <span className="stat-label" style={{ fontSize: "1.1rem" }}>TV Shows</span>
                </div>
                <div className="stat-box" style={{ padding: "1.5rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.4rem" }}>{kdramasCount}</span>
                  <span className="stat-label" style={{ fontSize: "1.1rem" }}>K-Dramas</span>
                </div>
                <div className="stat-box" style={{ padding: "1.5rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.4rem" }}>{animeCount}</span>
                  <span className="stat-label" style={{ fontSize: "1.1rem" }}>Anime</span>
                </div>
                <div className="stat-box" style={{ padding: "1.5rem" }}>
                  <span className="stat-number" style={{ fontSize: "2.4rem" }}>{averageScore}</span>
                  <span className="stat-label" style={{ fontSize: "1.1rem" }}>Mean Score</span>
                </div>
              </div>

              {/* Audit Content Tabs */}
              <div className="admin-sub-tabs">
                <button 
                  onClick={() => setActiveSubTab("watchlist")} 
                  className={`admin-sub-tab-btn ${activeSubTab === "watchlist" ? "active" : ""}`}
                >
                  Watchlist Library ({totalItems})
                </button>
                <button 
                  onClick={() => setActiveSubTab("reviews")} 
                  className={`admin-sub-tab-btn ${activeSubTab === "reviews" ? "active" : ""}`}
                >
                  Ratings & Reviews ({userReviews.length})
                </button>
                <button 
                  onClick={() => setActiveSubTab("activity")} 
                  className={`admin-sub-tab-btn ${activeSubTab === "activity" ? "active" : ""}`}
                >
                  Activity History ({userActivities.length})
                </button>
              </div>

              {/* Tab Contents */}
              <div style={{ marginTop: "1rem" }}>
                {activeSubTab === "watchlist" && (
                  <div>
                    {loadingWatchlist ? (
                      <p style={{ fontSize: "1.4rem", color: "#888", textAlign: "center", padding: "4rem" }}>Loading user watchlist...</p>
                    ) : selectedUserWatchlist.length === 0 ? (
                      <p style={{ fontSize: "1.4rem", color: "#888", textAlign: "center", padding: "4rem" }}>This user watchlist is empty.</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Media Poster</th>
                              <th>Title</th>
                              <th>Type</th>
                              <th>List Status</th>
                              <th>Score</th>
                              <th>Progress</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedUserWatchlist.map((item) => (
                              <tr key={item.mediaId}>
                                <td>
                                  <img 
                                    src={item.posterPath ? `https://image.tmdb.org/t/p/w92${item.posterPath}` : "https://via.placeholder.com/45x68?text=No+Img"} 
                                    alt={item.title} 
                                    style={{ width: "4.5rem", height: "6.5rem", objectFit: "cover", margin: 0, borderRadius: "0.4rem" }} 
                                  />
                                </td>
                                <td>
                                  <span style={{ fontWeight: "600", fontSize: "1.4rem", color: "var(--text-clr)" }}>{item.title}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: "1.1rem", textTransform: "uppercase", fontWeight: "600", color: "#777" }}>
                                    {item.type}
                                  </span>
                                </td>
                                <td>
                                  <span className={`status-badge ${item.status === "Completed" ? "active-status" : ""}`} style={{ fontSize: "1.1rem", textTransform: "none" }}>
                                    {item.status}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: "bold" }}>{item.personalRating > 0 ? `⭐ ${item.personalRating}/10` : "Unrated"}</span>
                                </td>
                                <td>
                                  <span>
                                    {item.type === "tv" || (item.type === "anime" && item.originalType === "tv")
                                      ? `${item.episodesWatched} / ${item.totalEpisodes || "N/A"} ep`
                                      : "1 / 1 movie"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeSubTab === "reviews" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {userReviews.length === 0 ? (
                      <p style={{ fontSize: "1.4rem", color: "#888", textAlign: "center", padding: "4rem" }}>No reviews written by this user.</p>
                    ) : (
                      userReviews.map((rev) => (
                        <div key={rev.id} style={{ background: "var(--bg-clr)", padding: "2rem", borderRadius: "1rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", fontSize: "1.2rem", color: "#666" }}>
                            <span style={{ fontWeight: "700", color: "var(--text-clr)", fontSize: "1.4rem" }}>
                              {rev.mediaTitle}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                              <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
                              <button 
                                onClick={() => handleDeleteReview(rev.id, rev.mediaTitle)}
                                style={{ 
                                  background: "#fee2e2", 
                                  color: "#ef4444", 
                                  border: "1px solid #fca5a5", 
                                  borderRadius: "0.4rem", 
                                  padding: "0.3rem 0.8rem", 
                                  cursor: "pointer",
                                  fontSize: "1.1rem",
                                  fontWeight: "600"
                                }}
                              >
                                Delete Review
                              </button>
                            </div>
                          </div>
                          <p style={{ fontSize: "1.3rem", color: "#333", lineHeight: "1.5", margin: "1rem 0" }}>"{rev.content}"</p>
                          <div style={{ display: "flex", gap: "2rem", fontSize: "1.2rem", fontWeight: "600", color: "#555" }}>
                            <span style={{ color: "#f39c12" }}>Score Given: ⭐ {rev.rating}/10</span>
                            <span>👍 Likes: {rev.likes?.length || 0}</span>
                            <span>💬 Comments: {rev.comments?.length || 0}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeSubTab === "activity" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {userActivities.length === 0 ? (
                      <p style={{ fontSize: "1.4rem", color: "#888", textAlign: "center", padding: "4rem" }}>No activities recorded for this user.</p>
                    ) : (
                      userActivities.map((act) => (
                        <div key={act.id} style={{ display: "flex", gap: "1.5rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "1.2rem" }}>
                          <span style={{ fontSize: "1.2rem", color: "#888", alignSelf: "center", minWidth: "8rem" }}>
                            {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div style={{ fontSize: "1.3rem" }}>
                            <span dangerouslySetInnerHTML={{ __html: act.description }}></span>
                            <span style={{ fontSize: "1.1rem", color: "#999", marginLeft: "1rem" }}>
                              ({new Date(act.timestamp).toLocaleDateString()})
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
