import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

if (process.env.NODE_ENV === "development") {
  console.log("Connecting to:", SOCKET_URL);
}

const socket = io(SOCKET_URL, {
  transports: ["websocket"], // 🔥 VERY IMPORTANT FIX
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