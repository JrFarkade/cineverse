import React, { useContext, useState, useEffect } from "react";
import useFetch from "./useFetch";

const AppContext = React.createContext();

export const AppProvider = ({ children }) => {
  const [queryVal, setQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [allWatchlists, setAllWatchlists] = useState([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [activitiesList, setActivitiesList] = useState([]);

  // Discovery Hub Caching States
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingTV, setTrendingTV] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [airingAnime, setAiringAnime] = useState([]);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);

  // Dynamic TMDB Search Toggle
  const endpoint = queryVal.trim() ? `search/multi?query=${queryVal}` : "movie/popular";
  const { isLoading, isError, movie } = useFetch(endpoint);

  // 1. Initial Authentication Restoration Check
  const checkAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setCurrentUser({ uid: data.user.uid, email: data.user.email });
          setUserProfile(data.user);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setCurrentUser(null);
      setUserProfile(null);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // 2. Fetch Handlers for Database Aggregates
  const fetchWatchlist = async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
      }
    } catch (err) {
      console.error("Error fetching watchlist:", err);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/reviews");
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch("/api/activities");
      if (res.ok) {
        const data = await res.json();
        setActivitiesList(data);
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
    }
  };

  const fetchUsersList = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error("Error fetching users list:", err);
    }
  };

  const fetchAllWatchlists = async () => {
    try {
      const res = await fetch("/api/watchlist?all=true");
      if (res.ok) {
        const data = await res.json();
        setAllWatchlists(data);
      }
    } catch (err) {
      console.error("Error fetching all watchlists:", err);
    }
  };

  // Sync state data on mount / auth change
  useEffect(() => {
    if (currentUser) {
      fetchWatchlist();
      fetchReviews();
      fetchActivities();

      if (userProfile?.role === "admin") {
        fetchUsersList();
        fetchAllWatchlists();
      }

      // Start 10-second polling interval for live feed updates
      const interval = setInterval(() => {
        fetchReviews();
        fetchActivities();
        if (userProfile?.role === "admin") {
          fetchUsersList();
          fetchAllWatchlists();
        }
      }, 10000);

      return () => clearInterval(interval);
    } else {
      setWatchlist([]);
      setUsersList([]);
      setAllWatchlists([]);
    }
  }, [currentUser, userProfile?.role]);

  // 3. Authentication Operations
  const registerUser = async (email, password, username) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Registration failed.");
    }

    const data = await res.json();
    setCurrentUser({ uid: data.uid, email: data.email });
    setUserProfile(data);
    return true;
  };

  const loginUser = async (emailOrUsername, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrUsername, password })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed.");
    }

    const data = await res.json();
    setCurrentUser({ uid: data.uid, email: data.email });
    setUserProfile(data);
    return true;
  };

  const loginWithGoogle = async (redirectPath = "/") => {
    // Standard OAuth redirect to endpoints with state query parameter
    window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirectPath)}`;
    return true;
  };

  const logoutUser = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setUserProfile(null);
    setWatchlist([]);
  };

  // 4. Storage Operations (R2)
  const uploadAvatar = async (userId, file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to upload file");
    }

    const data = await res.json();
    return data.url; // Returns dynamic self-hosted /api/profile/avatar?key=xxx URL
  };

  const updateProfile = async (fields) => {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update profile");
    }

    setUserProfile((prev) => ({ ...prev, ...fields }));
  };

  // 5. Watchlist CRUD
  const addToWatchlist = async (
    media, 
    status, 
    personalRating = 0, 
    episodesWatched = 0, 
    totalEpisodes = 1, 
    seasonsCompleted = 0, 
    rewatchCount = 0
  ) => {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media,
        status,
        personalRating,
        episodesWatched,
        totalEpisodes,
        seasonsCompleted,
        rewatchCount
      })
    });

    if (res.ok) {
      fetchWatchlist();
      fetchActivities();
    }
  };

  const updateWatchlistProgress = async (mediaId, fields) => {
    const res = await fetch("/api/watchlist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId, fields })
    });

    if (res.ok) {
      fetchWatchlist();
      fetchActivities();
    }
  };

  const removeFromWatchlist = async (mediaId) => {
    const res = await fetch(`/api/watchlist?mediaId=${encodeURIComponent(mediaId)}`, {
      method: "DELETE"
    });

    if (res.ok) {
      fetchWatchlist();
    }
  };

  // 6. Review Actions
  const addReview = async (mediaId, media, content, rating) => {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId, mediaTitle: media.title || media.name, media, content, rating })
    });

    if (res.ok) {
      fetchReviews();
      fetchWatchlist();
      fetchActivities();
    }
  };

  const likeReview = async (reviewId) => {
    const res = await fetch("/api/reviews/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId })
    });

    if (res.ok) {
      fetchReviews();
    }
  };

  const addCommentToReview = async (reviewId, commentText) => {
    const res = await fetch("/api/reviews/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, text: commentText })
    });

    if (res.ok) {
      fetchReviews();
    }
  };

  // 7. Review & Comment Modification Controls
  const deleteReview = async (reviewId) => {
    const res = await fetch(`/api/reviews?id=${encodeURIComponent(reviewId)}`, {
      method: "DELETE"
    });

    if (res.ok) {
      fetchReviews();
    }
  };

  const editReview = async (reviewId, content, rating) => {
    const res = await fetch("/api/reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, content, rating })
    });

    if (res.ok) {
      fetchReviews();
      fetchWatchlist();
      fetchActivities();
    }
  };

  const editComment = async (commentId, text) => {
    const res = await fetch("/api/reviews/comment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, text })
    });

    if (res.ok) {
      fetchReviews();
    }
  };

  const deleteComment = async (commentId) => {
    const res = await fetch(`/api/reviews/comment?id=${encodeURIComponent(commentId)}`, {
      method: "DELETE"
    });

    if (res.ok) {
      fetchReviews();
    }
  };

  const getUserWatchlist = async (userId) => {
    const res = await fetch(`/api/watchlist?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      return await res.json();
    }
    return [];
  };

  const updateUserStatus = async (userId, isSuspended) => {
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isSuspended })
    });

    if (res.ok) {
      fetchUsersList();
    }
  };

  const deleteUser = async (userId) => {
    const res = await fetch(`/api/users?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE"
    });

    if (res.ok) {
      fetchUsersList();
    }
  };

  const getSocialFeed = () => {
    return activitiesList;
  };

  return (
    <AppContext.Provider value={{ 
      query: queryVal, 
      movie, 
      setQuery, 
      isLoading, 
      isError,
      currentUser,
      userProfile,
      watchlist,
      reviews,
      usersList,
      allWatchlists,
      isLoadingAuth,
      registerUser,
      loginUser,
      logoutUser,
      loginWithGoogle,
      uploadAvatar,
      updateProfile,
      addToWatchlist,
      updateWatchlistProgress,
      removeFromWatchlist,
      addReview,
      likeReview,
      addCommentToReview,
      deleteReview,
      editReview,
      editComment,
      deleteComment,
      getUserWatchlist,
      updateUserStatus,
      deleteUser,
      getSocialFeed,
      trendingMovies,
      setTrendingMovies,
      trendingTV,
      setTrendingTV,
      upcoming,
      setUpcoming,
      airingAnime,
      setAiringAnime,
      dashboardLoaded,
      setDashboardLoaded
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useGlobalContext = () => {
  return useContext(AppContext);
};
 