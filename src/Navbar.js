import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useGlobalContext } from "./context";

const Navbar = () => {
  const { currentUser, userProfile, logoutUser } = useGlobalContext();
  const location = useLocation();
  const isAdmin = userProfile?.username === "@Jrfarkade" || userProfile?.role === "admin";

  return (
    <>
      {/* Top Navbar Header */}
      <nav className="navbar">
        <NavLink to="/" className="logo-link">
          <img src="/logo192.png" alt="CineVerse Logo" className="logo-img" /> CineVerse
        </NavLink>

        {/* Desktop Navigation Links */}
        <div className="nav-links desktop-only">
          <NavLink to="/dashboard" className="nav-item">Discovery Hub</NavLink>
          <NavLink to="/" end className="nav-item">Search</NavLink>
          
          {currentUser ? (
            <>
              {isAdmin && <NavLink to="/admin" className="nav-item" style={{ color: "#e74c3c", fontWeight: "bold" }}>Admin Dashboard</NavLink>}
              <NavLink to="/watchlist" className="nav-item">Watchlist</NavLink>
              <NavLink to="/social" className="nav-item">Social</NavLink>
              <NavLink to="/profile" className="nav-item">Profile</NavLink>
              <button onClick={logoutUser} className="logout-btn">Logout</button>
            </>
          ) : (
            <NavLink to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} className="nav-item auth-nav-btn">Login / Register</NavLink>
          )}
        </div>

        {/* Mobile-Only Top Actions */}
        <div className="mobile-only-header-actions">
          {currentUser ? (
            <>
              {isAdmin && (
                <NavLink to="/admin" className="admin-icon-btn" title="Admin Control Center">
                  🛠️
                </NavLink>
              )}
              <button onClick={logoutUser} className="mobile-logout-btn" title="Logout">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </>
          ) : (
            <NavLink to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} className="mobile-auth-btn">
              Login
            </NavLink>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className="mobile-nav-item">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className="mobile-nav-label">Home</span>
        </NavLink>

        <NavLink to="/dashboard" className="mobile-nav-item">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          <span className="mobile-nav-label">Discovery</span>
        </NavLink>

        <NavLink to="/watchlist" className="mobile-nav-item">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <span className="mobile-nav-label">Library</span>
        </NavLink>

        <NavLink to="/social" className="mobile-nav-item">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span className="mobile-nav-label">Social</span>
        </NavLink>

        <NavLink to="/profile" className="mobile-nav-item">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span className="mobile-nav-label">Profile</span>
        </NavLink>
      </nav>
    </>
  );
};

export default Navbar;
 