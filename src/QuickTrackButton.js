import React from "react";
import { useGlobalContext } from "./context";

const QuickTrackButton = ({ mediaItem, onOpenModal }) => {
  const { watchlist } = useGlobalContext();

  const mediaId = mediaItem ? String(mediaItem.id || mediaItem.mediaId) : null;
  const isInLibrary = watchlist.some((item) => String(item.mediaId) === mediaId);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onOpenModal && mediaItem) {
      onOpenModal(mediaItem);
    }
  };

  return (
    <button
      className={`quick-track-btn ${isInLibrary ? "in-library" : "not-in-library"}`}
      onClick={handleClick}
      title={isInLibrary ? "Edit in Library (Watched / Rating)" : "Quick Add to Library"}
      aria-label={isInLibrary ? "Edit in Library" : "Quick Add to Library"}
      type="button"
    >
      {isInLibrary ? (
        // Clean Edit / Pencil SVG Icon
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ) : (
        // Clean Plus SVG Icon
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  );
};

export default QuickTrackButton;
