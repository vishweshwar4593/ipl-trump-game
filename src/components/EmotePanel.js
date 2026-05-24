import React, { useState, useEffect, useRef } from "react";
import socket from "../socket";
import "../index.css"; // Ensure styles are available

const EMOTES = ["😎", "🏏", "😭", "😢", "🔥", "🤦‍♂️", "👏", "😱", "🏆", "🤔"];
const QUICK_TEXTS = [
    "Good play!", 
    "Oops!", 
    "Well played!", 
    "Lucky!", 
    "Let's go!", 
    "What a stat!", 
    "Too good!", 
    "My turn!"
];

function EmotePanel({ roomId, playStyle }) {
    const [activeEmote, setActiveEmote] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (playStyle !== "online") return;

        const handleReceiveEmote = (emote) => {
            console.log("Emote received from server:", emote);
            setActiveEmote({ text: emote, isSelf: false });
            
            // Clear any existing timeout before setting a new one
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setActiveEmote(null);
            }, 3000);
        };

        socket.on("receiveEmote", handleReceiveEmote);

        return () => {
            socket.off("receiveEmote", handleReceiveEmote);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [playStyle]);

    if (playStyle !== "online") return null;

    const handleSendEmote = (emote) => {
        const currentRoomId = localStorage.getItem("roomId");
        console.log("Attempting to send emote:", emote, "to room:", currentRoomId);
        if (!currentRoomId) {
            console.error("No room ID found in localStorage!");
            return;
        }

        // Send to server (will display on opponent's screen)
        socket.emit("sendEmote", { roomId: currentRoomId, emote });
        
        // Show on self screen
        setActiveEmote({ text: emote, isSelf: true });

        // Clear any existing timeout before setting a new one
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setActiveEmote(null);
        }, 3000);

        setIsOpen(false);
    };

    return (
        <>
            {/* The Floating Emote Toast */}
            {activeEmote && (
                <div className={`emote-toast ${activeEmote.isSelf ? 'self' : 'opponent'}`}>
                    <div className="emote-bubble">
                        {activeEmote.text}
                    </div>
                </div>
            )}

            {/* The Chat UI Panel */}
            <div className="chat-panel-container">
                <button 
                    className="chat-toggle-btn" 
                    onClick={() => setIsOpen(!isOpen)}
                    title="Send Emote or Chat"
                >
                    💬
                </button>
                
                {isOpen && (
                    <div className="chat-menu">
                        <div className="chat-emojis">
                            {EMOTES.map((emoji, index) => (
                                <button 
                                    key={index} 
                                    className="chat-emoji-btn"
                                    onClick={() => handleSendEmote(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <div className="chat-texts">
                            {QUICK_TEXTS.map((text, index) => (
                                <button 
                                    key={index} 
                                    className="chat-text-btn"
                                    onClick={() => handleSendEmote(text)}
                                >
                                    {text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default EmotePanel;
