import React from "react";

function OpponentLeftModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>👋</div>
        <h2 style={{ color: "#ffd700", margin: "0 0 8px" }}>Opponent Left</h2>
        <p style={{ color: "#ccc", marginBottom: 24 }}>
          Your opponent has disconnected from the game.
        </p>
        <button
          className="home-btn"
          style={{ width: "100%" }}
          onClick={onClose}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default OpponentLeftModal;
