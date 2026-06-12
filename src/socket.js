import { io } from "socket.io-client";

const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
const SOCKET_URL = process.env.NODE_ENV === "development"
  ? `http://${host}:5000`
  : "https://ipl-trump-game.onrender.com";

if (process.env.NODE_ENV === "development") {
  console.log("Connecting to:", SOCKET_URL);
}

const socket = io(SOCKET_URL, {
  transports: ["polling", "websocket"], // Allow both polling and websocket in all environments
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 1000,
});

socket.on("connect_error", (err) => {
  console.warn("[Socket] Connection failed:", err.message);
  window.dispatchEvent(new CustomEvent("socket:connect_error", { detail: err.message }));
});

socket.on("connect", () => {
  console.log("[Socket] Connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.warn("[Socket] Disconnected:", reason);
});

export default socket;