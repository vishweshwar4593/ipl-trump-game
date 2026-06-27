import React from "react";

function ExitConfirmationModal({ isOpen, gameMode, aiTeam, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Are you sure?</h2>
        <p>
          {gameMode === "tournament" && aiTeam
            ? "Exiting mid-game will count as an automatic loss."
            : "Your current game will be lost."}
        </p>
        <div className="modal-actions" style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
          <button className="confirm-btn" onClick={onConfirm}>Yes</button>
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default ExitConfirmationModal;
