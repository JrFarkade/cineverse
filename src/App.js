import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./Home";
import SingleMovie from "./SingleMovie";
import Navbar from "./Navbar";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import Watchlist from "./Watchlist";
import SocialFeed from "./SocialFeed";
import Profile from "./Profile";
import AdminDashboard from "./AdminDashboard";
import ScrollToTop from "./ScrollToTop";
import { useGlobalContext } from "./context";
import "./App.css";

const App = () => {
  const { isLoadingAuth, userProfile, logoutUser } = useGlobalContext();

  useEffect(() => {
    if (userProfile && userProfile.isSuspended) {
      logoutUser();
      alert("Your account has been suspended by an administrator.");
    }
  }, [userProfile, logoutUser]);

  if (isLoadingAuth) {
    return <div className="loading" style={{ margin: "10rem auto" }}>Initializing CineVerse...</div>;
  }

  const AdminRoute = ({ children }) => {
    const isAdmin = userProfile?.username === "@Jrfarkade" || userProfile?.role === "admin";
    return isAdmin ? children : <Navigate to="/" replace />;
  };

  return (
    <>
      <Navbar />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/social" element={<SocialFeed />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/:type/:id" element={<SingleMovie />} />
      </Routes>
    </>
  );
};

export default App;
