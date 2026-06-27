import React from "react";

function LoginConflictModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🚨</div>
        <h2 style={{ color: "#ff4b2b", margin: "0 0 8px" }}>Multiple Logins</h2>
        <p style={{ color: "#ccc", marginBottom: 24 }}>
          This account is already logged in on another device.
        </p>
        <button
          className="home-btn"
          style={{ width: "100%", background: "linear-gradient(135deg, #ff4b2b, #ff416c)", border: "none", color: "#fff", padding: "12px", borderRadius: "8px", fontWeight: "bold" }}
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default LoginConflictModal;
