import React, { useState } from "react";
import axios from "axios";
import "./Chat.css";

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [feedback, setFeedback] = useState({});
    const [loading, setLoading] = useState(false);
    const user = JSON.parse(localStorage.getItem("user"));

    const sendMessage = async () => {
        if (!input.trim()) return;
    
        const userMessage = { text: input, sender: "user" };
        const loadingMessage = { id: `loading_${Date.now()}`, sender: "loading" };
    
        setMessages((prevMessages) => [...prevMessages, userMessage, loadingMessage]);
        setInput("");
        setLoading(true);  // 🔥 Start glowing
    
        try {
            const response = await axios.post("http://localhost:5000/chat", {
                user_id: user.user_id,
                session_id: user.session_id,
                prompt: input,
            });
    
            const newMessage = {
                id: response.data.id || `msg_${Date.now()}`,
                text: response.data.response || "No response received.",
                sender: "bot",
                inputTokens: response.data.inputTokens || 0,
                outputTokens: response.data.outputTokens || 0,
            };
    
            setMessages((prevMessages) =>
                prevMessages
                    .filter((msg) => msg.id !== loadingMessage.id)
                    .concat(newMessage)
            );
    
            setFeedback((prevFeedback) => ({
                ...prevFeedback,
                [newMessage.id]: null,
            }));
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages((prevMessages) =>
                prevMessages
                    .filter((msg) => msg.id !== loadingMessage.id)
                    .concat({ text: "Error generating response.", sender: "bot" })
            );
        } finally {
            setLoading(false);  // 💡 Stop glowing
        }
    };
    

    const sendFeedback = async (messageId, type) => {
        try {
            await axios.post("http://localhost:5000/feedback", {
                history_id: parseInt(messageId.replace("msg_", ""), 10), 
                feedback: type,
            });
    
            setFeedback((prevFeedback) => ({
                ...prevFeedback,
                [messageId]: type, // Store using messageId as key (string)
            }));
        } catch (error) {
            console.error("Error submitting feedback:", error);
        }
    };    

    return (
        <div className="chat-container">
            <div className="chat-box">
            {messages.map((msg, index) => (
    <div key={index} className={`message ${msg.sender}`}>
        {msg.sender === "user" && <p>User: {msg.text}</p>}
        {msg.sender === "bot" && (
            <>
                <p>AI: {msg.text}</p>
                {msg.id && (
                    <div className="token-info">
                        <span>Input Tokens: {msg.inputTokens}</span> | 
                        <span> Output Tokens: {msg.outputTokens}</span>

                        <div className="feedback-buttons">
                            <button
                                className={`like-button ${feedback[msg.id] === "like" ? "selected-like" : ""}`}
                                onClick={() => sendFeedback(msg.id, "like")}
                            >
                                👍
                            </button>
                            <button
                                className={`dislike-button ${feedback[msg.id] === "dislike" ? "selected-dislike" : ""}`}
                                onClick={() => sendFeedback(msg.id, "dislike")}
                            >
                                👎
                            </button>
                        </div>
                    </div>
                )}
            </>
        )}
        {msg.sender === "loading" && (
            <img src="/generating.gif" alt="Generating..." className="generating-gif" />
        )}
    </div>
))}

            </div>
            <div className={`input-container ${loading ? "glowing" : ""}`}>
                <input 
                    type="text" 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    placeholder="Type your message..." 
                    disabled={loading}
                />
                <button 
                    className={loading ? "loading-button" : ""}
                    onClick={sendMessage}
                    disabled={loading}
                >
                    <span>{loading ? "✦₊⁺" : '✧'}</span>
                </button>
            </div>
        </div>
    );
};

export default Chat;
