import React from "react";

function ReconnectModal({ isOpen, timeLeft }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: "#ffc107", margin: "0 0 8px" }}>Connection Lost</h2>
        <p style={{ color: "#ccc", marginBottom: 24 }}>
          Opponent disconnected. Waiting for them to reconnect...
        </p>
        <div style={{ fontSize: 24, fontWeight: "bold", color: "#ffc107" }}>
          {timeLeft}s
        </div>
      </div>
    </div>
  );
}

export default ReconnectModal;
