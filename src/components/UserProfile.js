import React from "react";
import "./UserProfile.css"; // Import styles

const UserProfile = ({ user }) => {
    if (!user) return null;

    const getInitials = (name) => {
        return name ? name.charAt(0).toUpperCase() : "U";
    };

    return (
        <div className="user-profile">
            <div className="user-icon">{getInitials(user.username)}</div>
            <span className="user-name">{user.username}</span>
        </div>
    );
};

export default UserProfile;
