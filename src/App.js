import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";
import Login from "./components/Login";
import UserProfile from "./components/UserProfile";
import Signup from "./components/Signup";
import "./App.css";

const MainApp = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const location = useLocation(); // ✅ Now useLocation() is inside Router context

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
        }
    }, []);

    // ✅ Handle Google login data from URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const user_id = params.get("user_id");
        const username = params.get("username");
        const email = params.get("email");
        const session_id = params.get("session_id");

        if (user_id && email && session_id) {
            const userData = { user_id, username, email, session_id };
            localStorage.setItem("user", JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            
            // ✅ Redirect to chat after login
            window.location.href = "/chat"; 
        }
    }, []);

    const toggleSidebar = () => {
        setIsSidebarOpen((prev) => !prev);
    };

    const isLoginPage = location.pathname === "/login" || location.pathname === "/signup";

    return (
        <div className="app">
            {!isLoginPage && isAuthenticated && <UserProfile user={user} />} 

            <div className="chat-container">
                {!isLoginPage && isAuthenticated && (
                    <>
                        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
                        <button className="sidebar-toggle" onClick={toggleSidebar}>
                            {isSidebarOpen ? "" : "☰"}
                        </button>
                    </>
                )}

                <Routes>
                    <Route path="/" element={isAuthenticated ? <Chat /> : <Navigate to="/login" />} />
                    <Route path="/chat" element={isAuthenticated ? <Chat /> : <Navigate to="/login" />} />
                    <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />} />
                    <Route path="/signup" element={<Signup />} />
                </Routes>
            </div>
        </div>
    );
};

const App = () => (
    <Router>
        <MainApp />
    </Router>
);

export default App;
