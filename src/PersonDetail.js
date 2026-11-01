import React, { useState, useEffect } from "react";
import { useParams, NavLink, useNavigate } from "react-router-dom";

const API_KEY = process.env.REACT_APP_TMDB_KEY || "96f53db154f4df124746c30c9823648c";
const API_URL = "https://api.tmdb.org/3";
const placeholderPoster = "https://via.placeholder.com/300x450?text=No+Poster";
const placeholderProfile = "https://via.placeholder.com/400x600?text=No+Photo";

const PersonDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [person, setPerson] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showFullBio, setShowFullBio] = useState(false);

  useEffect(() => {
    const fetchPerson = async () => {
      setIsLoading(true);
      setIsError("");
      try {
        const res = await fetch(
          `${API_URL}/person/${id}?api_key=${API_KEY}&append_to_response=combined_credits`
        );
        if (res.ok) {
          const data = await res.json();
          setPerson(data);
        } else {
          const errData = await res.json();
          setIsError(errData.status_message || "Failed to load actor profile.");
        }
      } catch (err) {
        console.error("Error fetching person details:", err);
        setIsError("Unable to load actor information.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerson();
  }, [id]);

  if (isLoading) {
    return <div className="loading" style={{ margin: "10rem auto" }}>Loading Actor Profile...</div>;
  }

  if (isError || !person) {
    return (
      <div className="container" style={{ textAlign: "center", margin: "6rem auto" }}>
        <h2>{isError || "Actor profile not found"}</h2>
        <button 
          onClick={() => navigate(-1)} 
          className="back-btn" 
          style={{ marginTop: "2rem", display: "inline-block" }}
        >
          Go Back
        </button>
      </div>
    );
  }

  // Calculate age if birthday is provided
  const calculateAge = (birthday, deathday) => {
    if (!birthday) return null;
    const birth = new Date(birthday);
    const end = deathday ? new Date(deathday) : new Date();
    let age = end.getFullYear() - birth.getFullYear();
    const m = end.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(person.birthday, person.deathday);

  // Extract and process filmography from combined_credits
  const rawCredits = person.combined_credits?.cast || [];

  // Deduplicate and filter out entries without titles
  const seenIds = new Set();
  const credits = rawCredits.filter((item) => {
    const key = `${item.media_type || "movie"}-${item.id}`;
    if (seenIds.has(key)) return false;
    seenIds.add(key);
    return Boolean(item.title || item.name);
  });

  // Sort by release date descending
  credits.sort((a, b) => {
    const dateA = a.release_date || a.first_air_date || "";
    const dateB = b.release_date || b.first_air_date || "";
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB.localeCompare(dateA);
  });

  const movieCredits = credits.filter((c) => c.media_type === "movie");
  const tvCredits = credits.filter((c) => c.media_type === "tv");

  let displayedCredits = credits;
  if (activeTab === "movie") displayedCredits = movieCredits;
  if (activeTab === "tv") displayedCredits = tvCredits;

  const photoUrl = person.profile_path
    ? `https://image.tmdb.org/t/p/h632${person.profile_path}`
    : placeholderProfile;

  const bio = person.biography || "";
  const isBioLong = bio.length > 400;
  const displayedBio = isBioLong && !showFullBio ? `${bio.slice(0, 400)}...` : bio;

  return (
    <div className="container person-detail-container">
      {/* Back button */}
      <div style={{ marginBottom: "2rem" }}>
        <button 
          onClick={() => navigate(-1)} 
          className="back-btn" 
          style={{ padding: "0.8rem 2rem", fontSize: "1.4rem" }}
        >
          ← Back
        </button>
      </div>

      {/* Hero Person Profile Card */}
      <div className="person-hero-card">
        <div className="person-photo-wrapper">
          <img src={photoUrl} alt={person.name} className="person-photo" />
        </div>

        <div className="person-info-content">
          <h1 className="person-name">{person.name}</h1>

          <div className="person-meta-row">
            {person.known_for_department && (
              <span className="person-meta-badge department-badge">
                {person.known_for_department}
              </span>
            )}
            {credits.length > 0 && (
              <span className="person-meta-badge credits-badge">
                {credits.length} Projects
              </span>
            )}
          </div>

          <div className="person-meta-details">
            {person.birthday && (
              <p>
                <strong>Born:</strong> {person.birthday}
                {age !== null && (person.deathday ? ` (Died at age ${age})` : ` (${age} years old)`)}
              </p>
            )}
            {person.deathday && (
              <p>
                <strong>Died:</strong> {person.deathday}
              </p>
            )}
            {person.place_of_birth && (
              <p>
                <strong>Place of Birth:</strong> {person.place_of_birth}
              </p>
            )}
          </div>

          {bio && (
            <div className="person-biography">
              <h3>Biography</h3>
              <p className="bio-text">{displayedBio}</p>
              {isBioLong && (
                <button 
                  className="bio-toggle-btn" 
                  onClick={() => setShowFullBio(!showFullBio)}
                >
                  {showFullBio ? "Read Less ↑" : "Read More ↓"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filmography Section */}
      <div className="filmography-section">
        <div className="filmography-header-row">
          <h2 className="filmography-title">Filmography</h2>

          {/* Filter Tabs */}
          <div className="filmography-tabs">
            <button
              className={`filmography-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All ({credits.length})
            </button>
            <button
              className={`filmography-tab-btn ${activeTab === "movie" ? "active" : ""}`}
              onClick={() => setActiveTab("movie")}
            >
              Movies ({movieCredits.length})
            </button>
            <button
              className={`filmography-tab-btn ${activeTab === "tv" ? "active" : ""}`}
              onClick={() => setActiveTab("tv")}
            >
              TV Shows ({tvCredits.length})
            </button>
          </div>
        </div>

        {displayedCredits.length === 0 ? (
          <div className="empty-message">No titles found for this category.</div>
        ) : (
          <div className="filmography-grid">
            {displayedCredits.map((item) => {
              const concreteType = item.media_type || "movie";
              const title = item.title || item.name || "Untitled";
              const releaseDate = item.release_date || item.first_air_date || "";
              const year = releaseDate ? releaseDate.slice(0, 4) : "—";
              const poster = item.poster_path
                ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
                : placeholderPoster;

              return (
                <NavLink
                  to={`/${concreteType}/${item.id}`}
                  key={`${concreteType}-${item.id}`}
                  className="filmography-card-link"
                >
                  <div className="filmography-card">
                    <div className="filmography-poster-wrap">
                      <img src={poster} alt={title} loading="lazy" />
                      {item.vote_average > 0 && (
                        <span className="filmography-rating-badge">
                          ⭐ {item.vote_average.toFixed(1)}
                        </span>
                      )}
                      <span className={`filmography-type-pill ${concreteType}`}>
                        {concreteType === "tv" ? "TV" : "Movie"}
                      </span>
                    </div>

                    <div className="filmography-card-info">
                      <div className="filmography-card-year">{year}</div>
                      <h4 className="filmography-card-title" title={title}>{title}</h4>
                      {item.character && (
                        <p className="filmography-card-character" title={item.character}>
                          as {item.character}
                        </p>
                      )}
                    </div>
                  </div>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonDetail;
