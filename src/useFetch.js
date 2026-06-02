import { useState, useEffect } from "react";

const API_KEY = process.env.REACT_APP_TMDB_KEY || "96f53db154f4df124746c30c9823648c";
export const API_URL = "https://api.tmdb.org/3";

const useFetch = (urlPath) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState({ show: "false", msg: "" });
  const [movie, setMovie] = useState(null);

  const getMovie = async (url) => {
    setIsLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok) {
        setIsLoading(false);
        const results = data.results || data;
        setMovie(results);

        if (data.results && data.results.length === 0) {
          setIsError({ show: "true", msg: "No movies found." });
        } else {
          setIsError({ show: "false", msg: "" });
        }
      } else {
        setIsLoading(false);
        setIsError({ show: "true", msg: data.status_message || "Something went wrong." });
      }
    } catch (error) {
      setIsLoading(false);
      setIsError({ show: "true", msg: "Failed to fetch data." });
      console.log(error);
    }
  };

  useEffect(() => {
    const separator = urlPath.includes("?") ? "&" : "?";
    const fullUrl = `${API_URL}/${urlPath}${separator}api_key=${API_KEY}`;

    let timeOut = setTimeout(() => {
      getMovie(fullUrl);
    }, 800);

    return () => clearTimeout(timeOut);
  }, [urlPath]);

  return { isLoading, isError, movie };
};

export default useFetch;
 