import React, { useState, useEffect } from "react";
import axios from "axios";
import "./History.css";

const History = () => {
    const [history, setHistory] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Get User ID & Session ID from Local Storage
    const user = JSON.parse(localStorage.getItem("user"));
    const userId = user?.user_id || "";  
    const sessionId = user?.session_id || "";

    useEffect(() => {
        if (userId && sessionId) {
            fetchHistory(userId, sessionId);
        } else {
            setError("User not logged in or session missing.");
        }
    }, [userId, sessionId]);

    const fetchHistory = async (userId, sessionId) => {
        setLoading(true);
        setError("");

        try {
            const response = await axios.get("http://127.0.0.1:5000/history", {
                params: { user_id: userId }, // Remove session_id
            });
            

            console.log("API Response:", response.data); // ✅ Debugging log

            if (response.data && response.data.history.length > 0) {
                setHistory(groupHistoryByDate(response.data.history));
            } else {
                setError("No chat history available.");
            }
        } catch (error) {
            setError("Error fetching history.");
            console.error("History fetch error:", error);
        }

        setLoading(false);
    };

    const groupHistoryByDate = (historyList) => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

        const categories = {
            Today: [],
            Yesterday: [],
            "This Week": [],
            "Last Month": [],
            Older: [],
        };

        historyList.forEach((item) => {
            const itemDate = new Date(item.timestamp);

            if (isNaN(itemDate.getTime())) {
                console.warn("Invalid timestamp detected:", item.timestamp);
                return;
            }

            if (itemDate.toDateString() === today.toDateString()) {
                categories.Today.push(item);
            } else if (itemDate.toDateString() === yesterday.toDateString()) {
                categories.Yesterday.push(item);
            } else if (itemDate >= startOfWeek) {
                categories["This Week"].push(item);
            } else if (itemDate >= startOfLastMonth && itemDate <= endOfLastMonth) {
                categories["Last Month"].push(item);
            } else {
                categories.Older.push(item);
            }
        });

        return categories;
    };

    return (
        <div className="history-section">
            <h3>Chat History</h3>
            {loading ? (
                <p>Loading...</p>
            ) : error ? (
                <p className="error-message">{error}</p>
            ) : Object.keys(history).length === 0 ? (
                <p>No chat history found.</p>
            ) : (
                <div className="history-scrollable">
                    {Object.entries(history).map(([category, items]) =>
                        items.length > 0 ? (
                            <div key={category} className="history-category">
                                <h4>{category}</h4>
                                <ul>
                                    {items.map((item) => (
                                        <li key={item.id}>
                                            {item.user_request}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null
                    )}
                </div>
            )}
        </div>
    );
};

export default History;
