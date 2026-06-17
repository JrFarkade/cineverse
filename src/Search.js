import React from "react";
import { useGlobalContext } from "./context";

const Search = () => {
  const { query, setQuery, isError } = useGlobalContext();

  return (
    <>
      <section className="search-section">
        <h2>Discover Something Amazing</h2>
        <form action="#" onSubmit={(e) => e.preventDefault()}>
          <div>
            <input
              type="text"
              placeholder="Search movies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </form>
        <div className="card-error">
          <p>{isError.show === "true" && isError.msg}</p>
        </div>
      </section>
    </>
  );
};

export default Search;
 