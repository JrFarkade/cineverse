import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useGlobalContext } from "./context";

const Navbar = () => {
  const { currentUser, userProfile, logoutUser } = useGlobalContext();
  const location = useLocation();
  const isAdmin = userProfile?.username === "@Jrfarkade" || userProfile?.role === "admin";

  return (
    <nav className="navbar">
      <NavLink to="/" className="logo-link">
        <img src="/logo192.png" alt="CineVerse Logo" className="logo-img" /> CineVerse
      </NavLink>

      <div className="nav-links">
        <NavLink to="/dashboard" className="nav-item">Discovery Hub</NavLink>
        <NavLink to="/" className="nav-item">Search</NavLink>
        
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
    </nav>
  );
};

export default Navbar;
 