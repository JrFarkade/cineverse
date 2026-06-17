import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useGlobalContext } from "./context";

const API_KEY = process.env.REACT_APP_TMDB_KEY || "96f53db154f4df124746c30c9823648c";
const BASE_URL = "https://api.tmdb.org/3";
const placeholderImg = "https://via.placeholder.com/300x450?text=No+Poster";

// Reusable Carousel Section with dynamic scroll indicators (hiding/showing arrows on boundaries)
const CarouselSection = ({ title, items, mediaType, carouselId }) => {
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const carouselRef = useRef(null);

  const checkScroll = () => {
    const el = carouselRef.current;
    if (el) {
      const scrollLeft = el.scrollLeft;
      const scrollWidth = el.scrollWidth;
      const clientWidth = el.clientWidth;
      
      // Show left arrow if scrolled away from start
      setShowLeft(scrollLeft > 5);
      
      // Show right arrow if not reached the end (with 5px buffer)
      setShowRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (el) {
      // Check initial scroll bounds
      checkScroll();
      
      el.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
    }
    return () => {
      if (el) {
        el.removeEventListener("scroll", checkScroll);
      }
      window.removeEventListener("resize", checkScroll);
    };
  }, [items]);

  const scroll = (direction) => {
    const el = carouselRef.current;
    if (el) {
      const amount = 500;
      el.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth"
      });
    }
  };

  const preloadPoster = (posterPath) => {
    if (!posterPath) return;
    const img = new Image();
    img.src = `https://image.tmdb.org/t/p/w500${posterPath}`;
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="dashboard-section">
      <h3 className="section-title">{title}</h3>
      <div className="carousel-wrapper">
        {showLeft && (
          <button 
            className="carousel-nav-btn prev" 
            onClick={() => scroll("left")}
            aria-label="Scroll Left"
          >
            &#10094;
          </button>
        )}
        
        <div ref={carouselRef} id={carouselId} className="dashboard-carousel">
          {items.map((item) => {
            const posterUrl = item.poster_path
              ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
              : placeholderImg;
            
            const displayTitle = item.title || item.name;
            const shortTitle = displayTitle 
              ? (displayTitle.length > 22 ? `${displayTitle.substring(0, 19)}...` : displayTitle) 
              : "";
            
            const concreteType = mediaType || (item.title ? "movie" : "tv");

            return (
              <NavLink 
                to={`/${concreteType}/${item.id}`} 
                state={{ mediaDetails: item }} 
                key={item.id} 
                className="dashboard-card-link"
                onMouseEnter={() => preloadPoster(item.poster_path)}
                onFocus={() => preloadPoster(item.poster_path)}
              >
                <div className="dashboard-card">
                  <img src={posterUrl} alt={displayTitle} />
                  <div className="dashboard-card-info">
                    <h4>{shortTitle}</h4>
                    <div className="card-badge-row">
                      <span className="card-rating">⭐ {item.vote_average ? item.vote_average.toFixed(1) : "N/A"}</span>
                      {concreteType === "tv" && (
                        <span className="card-info-badge">Ongoing</span>
                      )}
                    </div>
                    {item.release_date && (
                      <p className="card-release-date">Release: {item.release_date}</p>
                    )}
                    {item.episode_count && (
                      <p className="card-episode-count">Episode: {item.episode_count}</p>
                    )}
                    {title.includes("Anime") && (
                      <p className="card-anime-status">Currently Airing</p>
                    )}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </div>

        {showRight && (
          <button 
            className="carousel-nav-btn next" 
            onClick={() => scroll("right")}
            aria-label="Scroll Right"
          >
            &#10095;
          </button>
        )}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const {
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
  } = useGlobalContext();

  const [loading, setLoading] = useState(!dashboardLoaded);

  // Helper to validate items and query details to make sure they load successfully (prevent 404s)
  const validateItems = async (items, type) => {
    const validated = await Promise.all(
      items.map(async (item) => {
        try {
          const res = await fetch(`${BASE_URL}/${type}/${item.id}?api_key=${API_KEY}`);
          if (res.ok) {
            const details = await res.json();
            return {
              ...item,
              vote_average: details.vote_average
            };
          }
        } catch (err) {
          console.error(`Validation failed for ${type} ${item.id}:`, err);
        }
        return null;
      })
    );
    return validated.filter((item) => item !== null);
  };

  // Dedicated Airing Anime Fetching (MAL API + TMDB title resolution and date filters)
  const fetchAiringAnimeList = async () => {
    try {
      console.log("Fetching genuinely airing seasonal anime from MAL Jikan API...");
      const res = await fetch("https://api.jikan.moe/v4/seasons/now?limit=20");
      if (!res.ok) throw new Error("MAL season/now API call failed");
      const data = await res.json();
      const animeList = data.data || [];

      // Resolve MAL title names to TMDB IDs in parallel
      const resolved = await Promise.all(
        animeList.map(async (anime) => {
          try {
            const title = anime.title_english || anime.title;
            const searchUrl = `${BASE_URL}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(title)}&with_original_language=ja`;
            const sRes = await fetch(searchUrl);
            if (sRes.ok) {
              const sData = await sRes.json();
              const tmdbItem = sData.results?.[0];
              if (tmdbItem) {
                return {
                  id: tmdbItem.id,
                  name: tmdbItem.name,
                  poster_path: tmdbItem.poster_path,
                  vote_average: anime.score || tmdbItem.vote_average,
                  episode_count: anime.episodes || null,
                  airing_status: "Currently Airing"
                };
              }
            }
          } catch (err) {
            console.error(`MAL resolution error for "${anime.title}":`, err);
          }
          return null;
        })
      );

      const filtered = resolved.filter((item) => item !== null);
      if (filtered.length > 0) {
        return filtered;
      }
      throw new Error("No Jikan anime matched on TMDB");
    } catch (err) {
      console.warn("Jikan fetching failed or was offline. Falling back to TMDB air date discovery...", err);
      // Fallback: TMDB Discover filtered by date
      const today = new Date();
      const priorDate = new Date(new Date().setDate(today.getDate() - 14)).toISOString().split("T")[0];
      const nextDate = new Date(new Date().setDate(today.getDate() + 14)).toISOString().split("T")[0];
      
      const fallbackUrl = `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja&air_date.gte=${priorDate}&air_date.lte=${nextDate}&sort_by=popularity.desc`;
      const res = await fetch(fallbackUrl);
      if (!res.ok) throw new Error("TMDB Discover fallback failed");
      const data = await res.json();
      const results = data.results || [];

      // Validate details and filter out non-airing shows
      const validated = await Promise.all(
        results.map(async (item) => {
          try {
            const dRes = await fetch(`${BASE_URL}/tv/${item.id}?api_key=${API_KEY}`);
            if (dRes.ok) {
              const details = await dRes.json();
              const isAiring = details.status === "Returning Series" || details.status === "In Production";
              if (!isAiring) return null;
              return {
                ...item,
                vote_average: details.vote_average,
                episode_count: details.last_episode_to_air?.episode_number || details.number_of_episodes || null,
                airing_status: "Currently Airing"
              };
            }
          } catch (err) {
            console.error(`Fallback validation failed for TV ID ${item.id}:`, err);
          }
          return null;
        })
      );
      return validated.filter((item) => item !== null);
    }
  };

  useEffect(() => {
    // If already loaded in context, don't refetch!
    if (dashboardLoaded) {
      setLoading(false);
      return;
    }

    const fetchDiscoveryData = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];

        // 1. Fetch Trending Movies
        const mRes = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
        const mData = await mRes.json();
        const validMovies = (mData.results || []).filter(
          (item) => item.id && item.title && item.poster_path
        );
        const verifiedMovies = await validateItems(validMovies, "movie");
        setTrendingMovies(verifiedMovies.slice(0, 12));

        // 2. Fetch Trending TV
        const tRes = await fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}`);
        const tData = await tRes.json();
        const validTV = (tData.results || []).filter(
          (item) => item.id && item.name && item.poster_path
        );
        const verifiedTV = await validateItems(validTV, "tv");
        setTrendingTV(verifiedTV.slice(0, 12));

        // 3. Fetch Upcoming Releases (Filter popular future releases)
        const uRes = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&primary_release_date.gte=${today}&sort_by=popularity.desc`);
        const uData = await uRes.json();
        const validUpcoming = (uData.results || [])
          .filter((item) => item.id && item.title && item.poster_path && item.release_date && item.release_date >= today)
          .slice(0, 15)
          .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
        const verifiedUpcoming = await validateItems(validUpcoming, "movie");
        setUpcoming(verifiedUpcoming.slice(0, 12));

        // 4. Fetch Top Airing Anime
        const validatedAnime = await fetchAiringAnimeList();
        setAiringAnime(validatedAnime.slice(0, 12));

        setDashboardLoaded(true);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoveryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardLoaded]);

  // Scroll tracking to save position
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem("dashboard_scroll_y", window.scrollY.toString());
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Scroll restoration after rendering content
  useEffect(() => {
    if (!loading) {
      const savedScroll = sessionStorage.getItem("dashboard_scroll_y");
      if (savedScroll) {
        const timer = setTimeout(() => {
          window.scrollTo(0, parseInt(savedScroll, 10));
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [loading]);

  if (loading) {
    return <div className="loading" style={{ margin: "5rem auto" }}>Loading Dashboard...</div>;
  }

  return (
    <div className="container" style={{ maxWidth: "1200px" }}>
      <h2 className="hub-title">
        CineVerse Discovery Hub
      </h2>
      
      <CarouselSection title="Trending Movies This Week" items={trendingMovies} mediaType="movie" carouselId="carousel-movies" />
      <CarouselSection title="Trending TV Shows" items={trendingTV} mediaType="tv" carouselId="carousel-tv" />
      <CarouselSection title="Upcoming Movie Releases" items={upcoming} mediaType="movie" carouselId="carousel-upcoming" />
      <CarouselSection title="Top Airing Anime" items={airingAnime} mediaType="tv" carouselId="carousel-anime" />
    </div>
  );
};

export default Dashboard;
 