import React, { useState } from "react";
import { useGlobalContext } from "./context";

const getBadgeClass = (status = "") => {
  const s = status.toLowerCase();
  if (s.includes("completed")) return "status-completed";
  if (s.includes("watching")) return "status-watching";
  if (s.includes("plan")) return "status-plan";
  if (s.includes("hold")) return "status-on-hold";
  if (s.includes("dropped")) return "status-dropped";
  return "status-default";
};

const renderActivityMessage = (rawDescription, username) => {
  if (!rawDescription) return null;

  let text = rawDescription;
  // Strip redundant leading username if present
  if (username) {
    text = text.replace(new RegExp(`^\\*\\*${username}\\*\\*\\s*`, "i"), "");
    text = text.replace(new RegExp(`^${username}\\s+`, "i"), "");
  }

  // Check if it's "added **Title** to **Status**"
  const addMatch = text.match(/^(?:added|added to library)\s+\*\*(.*?)\*\*\s+to\s+\*\*(.*?)\*\*/i);
  if (addMatch) {
    const [, title, status] = addMatch;
    const badgeClass = getBadgeClass(status);
    return (
      <span className="activity-phrase">
        Added <strong className="activity-media-title">{title}</strong> to{" "}
        <span className={`status-badge ${badgeClass}`}>{status}</span>
      </span>
    );
  }

  // Check if it's "updated **Title** status to **Status**"
  const updateMatch = text.match(/^updated\s+\*\*(.*?)\*\*\s+status to\s+\*\*(.*?)\*\*/i);
  if (updateMatch) {
    const [, title, status] = updateMatch;
    const badgeClass = getBadgeClass(status);
    return (
      <span className="activity-phrase">
        Updated <strong className="activity-media-title">{title}</strong> status to{" "}
        <span className={`status-badge ${badgeClass}`}>{status}</span>
      </span>
    );
  }

  // Check if it's "reviewed **Title** and rated it **Rating**"
  const reviewMatch = text.match(/^reviewed\s+\*\*(.*?)\*\*\s+and rated it\s+\*\*(.*?)\*\*/i);
  if (reviewMatch) {
    const [, title, rating] = reviewMatch;
    return (
      <span className="activity-phrase">
        Reviewed <strong className="activity-media-title">{title}</strong> and rated it{" "}
        <span className="status-badge status-rating">⭐ {rating}</span>
      </span>
    );
  }

  // Fallback: replace any remaining **text** with <strong>text</strong> cleanly
  const htmlFormatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  return <span className="activity-phrase" dangerouslySetInnerHTML={{ __html: htmlFormatted }} />;
};

const SocialFeed = () => {
  const { currentUser, getSocialFeed, fetchActivities } = useGlobalContext();
  const [feedScope, setFeedScope] = useState("personal");

  if (!currentUser) {
    return (
      <div className="container" style={{ textAlign: "center", margin: "5rem auto" }}>
        <h3>Please log in to view the social feed.</h3>
      </div>
    );
  }

  const activities = getSocialFeed();

  const handleScopeChange = (scope) => {
    setFeedScope(scope);
    if (fetchActivities) {
      fetchActivities(scope);
    }
  };

  const formatTimestamp = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container">
      <h2 style={{ textAlign: "center", marginBottom: "3rem", fontSize: "3rem" }}>CineVerse Social Hub</h2>

      <div className="social-layout">
        {/* Timeline Feed */}
        <div className="timeline-container">
          <div className="feed-scope-tabs">
            <button
              className={`feed-scope-btn ${feedScope === "personal" ? "active" : ""}`}
              onClick={() => handleScopeChange("personal")}
            >
              My Activity
            </button>
            <button
              className={`feed-scope-btn ${feedScope === "community" ? "active" : ""}`}
              onClick={() => handleScopeChange("community")}
            >
              Community
            </button>
          </div>

          <h3 className="social-section-title">
            {feedScope === "personal" ? "My Activity Log" : "Community Activity"}
          </h3>
          
          {activities.length === 0 ? (
            <div className="empty-message">
              {feedScope === "personal"
                ? "You haven't logged any activities yet. Start adding movies, shows, or reviews to your list!"
                : "No community activity yet. Start tracking items to log updates!"}
            </div>
          ) : (
            <div className="timeline">
              {activities.map((activity) => (
                <div className="timeline-item" key={activity.id}>
                  <img
                    src={activity.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=User"}
                    alt={activity.username}
                    className="timeline-avatar"
                  />
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-user">{activity.username}</span>
                      <span className="timeline-time">{formatTimestamp(activity.timestamp)}</span>
                    </div>
                    <div className="timeline-desc">
                      {renderActivityMessage(activity.description, activity.username)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialFeed;
