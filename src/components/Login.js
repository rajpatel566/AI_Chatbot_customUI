import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Login = ({ setIsAuthenticated, setUser }) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        // ✅ Check if user is already logged in
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
            navigate("/chat");
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post("http://localhost:5000/login", { email, password });

            if (response.status === 200) {
                const { user_id, username, session_id, email } = response.data;

                const userData = { user_id, username, session_id, email };
                localStorage.setItem("user", JSON.stringify(userData)); // ✅ Store correctly
                setUser(userData); // ✅ Update user state
                setIsAuthenticated(true);
                navigate("/chat");
            }
        } catch (err) {
            setError("Invalid email or password");
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = "http://localhost:5000/google-login";  
    };

    return (
        <div className="auth-container">
            <h2>Login</h2>
            {error && <p className="error">{error}</p>}
            <form onSubmit={handleLogin}>
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="submit">Login</button>
            </form>
            <button onClick={handleGoogleLogin} className="google-login-btn">
                Login with Google
            </button>
            <p>Don't have an account? <a href="/signup">Sign up</a></p>
        </div>
    );
};

export default Login;
