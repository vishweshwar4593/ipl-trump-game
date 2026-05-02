import { io } from "socket.io-client";

const SOCKET_URL = "https://ipl-trump-game.onrender.com";
console.log("Connecting to:", SOCKET_URL); // ✅ debug

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