import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useGlobalContext } from "./context";
import QuickTrackButton from "./QuickTrackButton";
import QuickTrackModal from "./QuickTrackModal";

const placeholderImg = "https://via.placeholder.com/300x450?text=No+Poster";

const Movie = () => {
  const { movie, isLoading } = useGlobalContext();
  const [trackModalItem, setTrackModalItem] = useState(null);

  const preloadPoster = (posterPath) => {
    if (!posterPath) return;
    const img = new Image();
    img.src = `https://image.tmdb.org/t/p/w500${posterPath}`;
  };

  if (isLoading) {
    return <div className="loading">Loading....</div>;
  }

  // Filter out people or invalid items from multi-search results
  const filteredList = (movie && Array.isArray(movie) ? movie : []).filter(
    (item) => item.media_type === "movie" || item.media_type === "tv" || !item.media_type
  );

  return (
    <>
      <section className="movie-page">
        <div className="grid grid-4-col">
          {filteredList.map((curMovieElem) => {
            const { id, title, name, poster_path, media_type } = curMovieElem;
            const displayTitle = title || name || "";
            const movieName = displayTitle ? displayTitle.substring(0, 15) : "";
            const moviePoster = poster_path 
              ? `https://image.tmdb.org/t/p/w300${poster_path}` 
              : placeholderImg;

            const concreteType = media_type || "movie";

            return (
              <NavLink 
                to={`/${concreteType}/${id}`} 
                state={{ mediaDetails: curMovieElem }} 
                key={id}
                onMouseEnter={() => preloadPoster(poster_path)}
                onFocus={() => preloadPoster(poster_path)}
              >
                <div className="card">
                  <div className="card-info">
                    <h2>
                      {movieName.length > 13
                        ? `${movieName}...`
                        : movieName}
                    </h2>
                    <div className="card-poster-wrap">
                      <img src={moviePoster} alt={displayTitle || "media"} />
                      <QuickTrackButton
                        mediaItem={{ ...curMovieElem, media_type: concreteType }}
                        onOpenModal={setTrackModalItem}
                      />
                    </div>
                  </div>
                </div>
              </NavLink>
            );
          })}
        </div>
      </section>

      {/* Quick Track Modal */}
      <QuickTrackModal
        isOpen={Boolean(trackModalItem)}
        onClose={() => setTrackModalItem(null)}
        mediaItem={trackModalItem}
      />
    </>
  );
};

export default Movie;
 