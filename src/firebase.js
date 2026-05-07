import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDLGr2IadyNdJEaFR0h6djM6xdxgSNPLOw",
  authDomain: "ipl-trump-game.firebaseapp.com",
  projectId: "ipl-trump-game",
  storageBucket: "ipl-trump-game.firebasestorage.app",
  messagingSenderId: "541405417153",
  appId: "1:541405417153:web:05b40b08b64c506c1dce40",
  measurementId: "G-KDKENETCW8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
