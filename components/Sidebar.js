import React from "react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import History from "./History";
import "./Sidebar.css";

const Sidebar = ({ isOpen, toggleSidebar }) => {
    const [showHistory, setShowHistory] = useState(false);

    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("user");
        navigate("/login");
    };

    
    return (
            <div className={`sidebar ${isOpen ? "open" : ""}`}>
            <button className="close-btn" onClick={toggleSidebar}>✖</button>
            <h2>Menu</h2>

            <ul>
                <li onClick={toggleSidebar}>Home</li>
                <li onClick={() => setShowHistory(!showHistory)}>
                    {showHistory ? "Hide History" : "Show History"}
                </li>
            </ul>

            {showHistory && <History />}
            <h2><div onClick={handleLogout} className="logout-btn">Logout</div></h2>
        </div>
    );
};

export default Sidebar;
