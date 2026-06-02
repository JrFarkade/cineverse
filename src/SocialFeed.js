import React from "react";
import { useGlobalContext } from "./context";

const SocialFeed = () => {
  const { currentUser, getSocialFeed } = useGlobalContext();

  if (!currentUser) {
    return (
      <div className="container" style={{ textAlign: "center", margin: "5rem auto" }}>
        <h3>Please log in to view the social feed.</h3>
      </div>
    );
  }

  const activities = getSocialFeed();

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
          <h3 className="social-section-title">Community Activity</h3>
          
          {activities.length === 0 ? (
            <div className="empty-message">No community activity yet. Start tracking items to log updates!</div>
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
                    <p 
                      className="timeline-desc"
                      dangerouslySetInnerHTML={{ __html: activity.description }}
                    ></p>
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
 