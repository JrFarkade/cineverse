import React, { useState, useEffect } from "react";
import { useGlobalContext } from "./context";

const Profile = () => {
  const { currentUser, userProfile, watchlist, updateProfile, uploadAvatar } = useGlobalContext();

  const profile = userProfile || {
    username: "User",
    email: currentUser ? currentUser.email : "",
    avatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=User",
    createdAt: "2026-06-01",
    bio: ""
  };

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState(profile.username);
  const [editBio, setEditBio] = useState(profile.bio || "");
  const [editAvatar, setEditAvatar] = useState(profile.avatar);
  const [avatarFile, setAvatarFile] = useState(null);
  const [fileError, setFileError] = useState("");

  // Sync edits when userProfile changes
  useEffect(() => {
    setEditUsername(profile.username);
    setEditBio(profile.bio || "");
    setEditAvatar(profile.avatar);
    setAvatarFile(null);
    setFileError("");
  }, [profile.username, profile.bio, profile.avatar]);

  if (!currentUser) {
    return (
      <div className="container" style={{ textAlign: "center", margin: "5rem auto" }}>
        <h3>Please log in to view your profile.</h3>
      </div>
    );
  }

  // 1. Core Counts
  const totalItems = watchlist.length;
  const watchingCount = watchlist.filter(i => i.status === "Watching").length;
  const completedCount = watchlist.filter(i => i.status === "Completed").length;
  const onHoldCount = watchlist.filter(i => i.status === "On Hold").length;
  const droppedCount = watchlist.filter(i => i.status === "Dropped").length;
  const planCount = watchlist.filter(i => i.status === "Plan to Watch").length;

  const moviesCount = watchlist.filter(i => i.type === "movie").length;
  const tvCount = watchlist.filter(i => i.type === "tv").length;
  const animeCount = watchlist.filter(i => i.type === "anime").length;
  const kdramasCount = watchlist.filter(i => i.type === "kdrama").length;

  // 2. Compute Hours Watched & Episode stats
  const totalEpisodesWatched = watchlist
    .filter(i => i.type === "tv" || i.type === "kdrama" || (i.type === "anime" && i.originalType === "tv"))
    .reduce((acc, curr) => acc + (curr.episodesWatched || 0), 0);

  const tvHours = (totalEpisodesWatched * 30) / 60;

  const movieHours = watchlist
    .filter(i => i.type === "movie" || (i.type === "anime" && i.originalType === "movie"))
    .reduce((acc, curr) => {
      if (curr.status === "Completed") return acc + 2;
      if (curr.status === "Watching") return acc + 1;
      return acc;
    }, 0);

  const totalHours = Math.round(movieHours + tvHours);

  // 3. Compute Ratings statistics
  const ratedMovies = watchlist.filter(i => i.personalRating && i.personalRating > 0);
  const averageScore = ratedMovies.length > 0
    ? (ratedMovies.reduce((acc, curr) => acc + curr.personalRating, 0) / ratedMovies.length).toFixed(1)
    : "N/A";

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit: 1.5 MB
    const maxSize = 1.5 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileError("File size exceeds 1.5MB. Please upload a smaller image.");
      return;
    }
    setFileError("");
    setAvatarFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (fileError) return;

    let finalAvatarUrl = editAvatar;

    if (avatarFile) {
      try {
        finalAvatarUrl = await uploadAvatar(currentUser.uid, avatarFile);
      } catch (err) {
        setFileError("Failed to upload image. Please try again.");
        return;
      }
    }

    await updateProfile({
      username: editUsername,
      bio: editBio,
      avatar: finalAvatarUrl
    });
    setIsEditing(false);
    setAvatarFile(null);
  };

  return (
    <div className="container">
      <div className="profile-layout">
        {/* Profile Card / Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSave} className="profile-card-large profile-edit-form" style={{ textAlign: "left" }}>
            <h3 style={{ fontSize: "2rem", marginBottom: "2rem", color: "var(--text-clr)", textAlign: "center" }}>Edit Profile</h3>
            
            {/* Avatar Preview */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "2rem" }}>
              <img src={editAvatar} alt="Preview" className="profile-avatar-large" style={{ margin: "0 0 1rem 0", objectFit: "cover" }} />
              <label className="file-upload-btn" style={{
                cursor: "pointer",
                padding: "0.6rem 1.2rem",
                background: "var(--bg-clr)",
                border: "1px solid var(--border-clr)",
                borderRadius: "0.5rem",
                fontSize: "1.2rem",
                color: "var(--text-clr)",
                fontWeight: "600",
                display: "inline-block"
              }}>
                Choose Image
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  onChange={handleFileChange} 
                  style={{ display: "none" }} 
                />
              </label>
              {fileError && <p style={{ color: "red", fontSize: "1.1rem", marginTop: "0.5rem", textAlign: "center" }}>{fileError}</p>}
            </div>

            {/* Username Field */}
            <div className="form-group" style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "1.3rem", fontWeight: "600", color: "var(--text-clr)" }}>Username</label>
              <input 
                type="text" 
                value={editUsername} 
                onChange={(e) => setEditUsername(e.target.value)} 
                required 
                style={{ width: "100%", marginTop: "0.5rem", fontSize: "1.4rem" }}
              />
            </div>

            {/* Biography Field */}
            <div className="form-group" style={{ marginBottom: "2rem" }}>
              <label style={{ fontSize: "1.3rem", fontWeight: "600", color: "var(--text-clr)" }}>Biography</label>
              <textarea 
                value={editBio} 
                onChange={(e) => setEditBio(e.target.value)} 
                placeholder="Tell us about yourself..."
                rows="4"
                style={{
                  width: "100%",
                  marginTop: "0.5rem",
                  padding: "1rem",
                  fontSize: "1.4rem",
                  borderRadius: "0.8rem",
                  border: "1px solid var(--border-clr)",
                  outline: "none",
                  resize: "vertical"
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "1rem" }}>
              <button type="submit" className="save-track-btn" style={{ flex: 1, padding: "1rem" }}>Save</button>
              <button 
                type="button" 
                onClick={() => {
                  setIsEditing(false);
                  setEditUsername(profile.username);
                  setEditBio(profile.bio || "");
                  setEditAvatar(profile.avatar);
                  setFileError("");
                }} 
                className="delete-track-btn" 
                style={{ flex: 1, padding: "1rem" }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-card-large">
            <img src={profile.avatar} alt={profile.username} className="profile-avatar-large" style={{ objectFit: "cover" }} />
            <h2>{profile.username}</h2>
            <p className="profile-email">{profile.email}</p>
            
            {profile.bio ? (
              <p className="profile-bio" style={{ 
                fontSize: "1.3rem", 
                margin: "1.5rem 0", 
                color: "#555", 
                lineHeight: "1.5", 
                background: "var(--bg-clr)", 
                padding: "1.5rem", 
                borderRadius: "0.8rem",
                textAlign: "left",
                whiteSpace: "pre-wrap"
              }}>
                {profile.bio}
              </p>
            ) : (
              <p className="profile-bio" style={{ fontSize: "1.3rem", margin: "1.5rem 0", color: "#999", fontStyle: "italic" }}>
                No biography added yet.
              </p>
            )}

            <div className="profile-meta" style={{ marginBottom: "2rem" }}>
              <span>Joined: <strong>{profile.createdAt}</strong></span>
            </div>
            
            <button 
              onClick={() => setIsEditing(true)} 
              className="save-track-btn" 
              style={{ width: "100%", padding: "1rem" }}
            >
              Edit Profile
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="profile-stats-container">
          <h3 className="profile-section-title">Library Statistics</h3>
          
          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-number">{totalHours}</span>
              <span className="stat-label">Hours Watched</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{totalItems}</span>
              <span className="stat-label">Total Titles</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{moviesCount}</span>
              <span className="stat-label">Movies Watched</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{tvCount}</span>
              <span className="stat-label">TV Series Watched</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{kdramasCount}</span>
              <span className="stat-label">K-Dramas Watched</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{animeCount}</span>
              <span className="stat-label">Anime Watched</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{totalEpisodesWatched}</span>
              <span className="stat-label">Episodes Watched</span>
            </div>
          </div>

          <h3 className="profile-section-title" style={{ marginTop: "4rem" }}>Watch List Progress</h3>
          <div className="progress-bars-container">
            <div className="progress-bar-row">
              <div className="progress-bar-labels">
                <span>Watching ({watchingCount})</span>
                <span>{totalItems ? Math.round((watchingCount / totalItems) * 100) : 0}%</span>
              </div>
              <div className="bar-bg">
                <div className="bar-fill watching" style={{ width: `${totalItems ? (watchingCount / totalItems) * 100 : 0}%` }}></div>
              </div>
            </div>

            <div className="progress-bar-row">
              <div className="progress-bar-labels">
                <span>Completed ({completedCount})</span>
                <span>{totalItems ? Math.round((completedCount / totalItems) * 100) : 0}%</span>
              </div>
              <div className="bar-bg">
                <div className="bar-fill completed" style={{ width: `${totalItems ? (completedCount / totalItems) * 100 : 0}%` }}></div>
              </div>
            </div>

            <div className="progress-bar-row">
              <div className="progress-bar-labels">
                <span>On Hold ({onHoldCount})</span>
                <span>{totalItems ? Math.round((onHoldCount / totalItems) * 100) : 0}%</span>
              </div>
              <div className="bar-bg">
                <div className="bar-fill onhold" style={{ width: `${totalItems ? (onHoldCount / totalItems) * 100 : 0}%` }}></div>
              </div>
            </div>

            <div className="progress-bar-row">
              <div className="progress-bar-labels">
                <span>Dropped ({droppedCount})</span>
                <span>{totalItems ? Math.round((droppedCount / totalItems) * 100) : 0}%</span>
              </div>
              <div className="bar-bg">
                <div className="bar-fill dropped" style={{ width: `${totalItems ? (droppedCount / totalItems) * 100 : 0}%` }}></div>
              </div>
            </div>

            <div className="progress-bar-row">
              <div className="progress-bar-labels">
                <span>Plan to Watch ({planCount})</span>
                <span>{totalItems ? Math.round((planCount / totalItems) * 100) : 0}%</span>
              </div>
              <div className="bar-bg">
                <div className="bar-fill plan" style={{ width: `${totalItems ? (planCount / totalItems) * 100 : 0}%` }}></div>
              </div>
            </div>
          </div>

          <div className="average-rating-container" style={{ marginTop: "4rem" }}>
            <div className="stat-box" style={{ width: "100%", maxWidth: "300px" }}>
              <span className="stat-number" style={{ color: "#f39c12" }}>⭐ {averageScore}</span>
              <span className="stat-label">Your Mean Score</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
 