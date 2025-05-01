from flask import Flask, request, jsonify, redirect, url_for, session
import mysql.connector
from flask_cors import CORS
from datetime import datetime
from google import genai
from pydantic import BaseModel
import json
import bcrypt
import time
import secrets
from authlib.integrations.flask_client import OAuth
from flask_session import Session


app = Flask(__name__)
app.secret_key = 'your_secret_key'
app.config['SESSION_TYPE'] = 'filesystem'
CORS(app)
Session(app)

client = genai.Client(api_key='YOUR_GEMINI_API_KEY')

# Configure MySQL Database
mysql_config = {
    'host': '',
    'user': '',
    'password': '',
    'database': ''
}

oauth = OAuth(app)
app.config['GOOGLE_CLIENT_ID'] = ''
app.config['GOOGLE_CLIENT_SECRET'] = ''
app.config['GOOGLE_DISCOVERY_URL'] = ""

google = oauth.register(
    name='google',
    client_id=app.config['GOOGLE_CLIENT_ID'],
    client_secret=app.config['GOOGLE_CLIENT_SECRET'],
    access_token_url='https://oauth2.googleapis.com/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params={'prompt': 'consent', 'access_type': 'offline'},
    jwks_uri='https://www.googleapis.com/oauth2/v3/certs',
    userinfo_endpoint='https://openidconnect.googleapis.com/v1/userinfo',
    client_kwargs={'scope': 'openid email profile'},
)
# Hash password function
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Check password function
def check_password(password, hashed):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

@app.route('/google-login')
def google_login():
    redirect_uri = url_for('google_callback', _external=True)
    nonce = secrets.token_urlsafe(16)  # Generate a secure nonce
    session['nonce'] = nonce  # Store nonce in session

    return google.authorize_redirect(redirect_uri, nonce=nonce)


@app.route('/google-callback')
def google_callback():
    token = google.authorize_access_token()
    nonce = session.pop('nonce', None)

    if not nonce:
        return jsonify({"error": "Nonce missing"}), 400

    user_info = google.parse_id_token(token, nonce)

    if not user_info:
        return jsonify({"error": "Failed to fetch user info"}), 400

    email = user_info['email']
    username = user_info.get('name', email.split('@')[0])

    conn = mysql.connector.connect(**mysql_config)
    cursor = conn.cursor()

    cursor.execute("SELECT user_id FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if not user:
        cursor.execute("INSERT INTO users (username, email, password) VALUES (%s, %s, %s)",
                       (username, email, 'oauth_user'))
        conn.commit()
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

    user_id = user[0]
    session_id = f"session_{user_id}_{int(time.time())}"

    cursor.execute("INSERT INTO session (session_id, user_id, prompt_count, active_status) VALUES (%s, %s, 0, TRUE)",
                   (session_id, user_id))
    conn.commit()
    cursor.close()
    conn.close()

    session['user'] = {'user_id': user_id, 'session_id': session_id, 'email': email, 'username': username}
    
    print("Session Data:", session['user'])  # Debugging
    
    return redirect('http://localhost:3000/')  # Redirect to chat page

# Pydantic model for AI response
class AIResponse(BaseModel):
    response: str
    inputTokens: int
    outputTokens: int

def get_ai_response(prompt):
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=prompt,
        config={'response_mime_type': 'application/json', 'response_schema': AIResponse.model_json_schema()}
    )
    try:
        parsed_response = json.loads(response.candidates[0].content.parts[0].text)
        ai_response = AIResponse(**parsed_response)
        return ai_response.response
    except (json.JSONDecodeError, AttributeError, IndexError):
        return "Sorry, I couldn't process your request."

@app.route('/signup', methods=["POST"])
def signup():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required"}), 400

    hashed_password = hash_password(password)

    conn = mysql.connector.connect(**mysql_config)
    cursor = conn.cursor()

    try:
        # Insert user
        cursor.execute("INSERT INTO users (username, email, password) VALUES (%s, %s, %s)", (username, email, hashed_password))
        conn.commit()

        # Retrieve new user_id
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user:
            user_id = user[0]
            return jsonify({"message": "Signup successful", "user_id": user_id, "username": username}), 201
        else:
            return jsonify({"error": "Signup failed"}), 500

    except mysql.connector.IntegrityError:
        return jsonify({"error": "Email already exists"}), 400
    finally:
        cursor.close()
        conn.close()

@app.route('/login', methods=["POST"])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email:
        return jsonify({"error": "Email is required"}), 400

    conn = mysql.connector.connect(**mysql_config)
    cursor = conn.cursor()

    cursor.execute("SELECT user_id, password, username FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if user:
        user_id, stored_password, username = user

        # If the user signed up via Google, they don’t have a password
        if stored_password == "oauth_user":
            session_id = f"session_{user_id}_{int(time.time())}"
            cursor.execute("INSERT INTO session (session_id, user_id, prompt_count, active_status) VALUES (%s, %s, 0, TRUE)", (session_id, user_id))
            conn.commit()
            cursor.close()
            conn.close()

            return jsonify({
                "message": "Google login successful",
                "user_id": user_id,
                "session_id": session_id,
                "email": email,
                "username": username
            }), 200

        # Regular login
        elif check_password(password, stored_password):
            session_id = f"session_{user_id}_{int(time.time())}"
            cursor.execute("INSERT INTO session (session_id, user_id, prompt_count, active_status) VALUES (%s, %s, 0, TRUE)", (session_id, user_id))
            conn.commit()
            cursor.close()
            conn.close()

            return jsonify({
                "message": "Login successful",
                "user_id": user_id,
                "session_id": session_id,
                "email": email,
                "username": username
            }), 200

    return jsonify({"error": "Invalid email or password"}), 401


@app.route('/logout', methods=["POST"])
def logout():
    data = request.json
    user_id = data.get('user_id')
    session_id = data.get('session_id')

    conn = mysql.connector.connect(**mysql_config)
    cursor = conn.cursor()

    cursor.execute("UPDATE session SET active_status = FALSE WHERE user_id = %s AND session_id = %s", (user_id, session_id))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Logout successful"}), 200


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_id = data.get('user_id')
    session_id = data.get('session_id')
    user_prompt = data.get('prompt')
    timestamp = datetime.now()

    conn = mysql.connector.connect(**mysql_config)
    cursor = conn.cursor()

    # Validate active session
    cursor.execute("SELECT session_id FROM session WHERE user_id = %s AND session_id = %s AND active_status = TRUE", (user_id, session_id))
    result = cursor.fetchone()

    if not result:
        return jsonify({"error": "Invalid or expired session"}), 403

    # Generate AI response
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=user_prompt,
        config={'response_mime_type': 'application/json', 'response_schema': AIResponse.model_json_schema()}
    )

    try:
        parsed_response = json.loads(response.candidates[0].content.parts[0].text)
        ai_response = AIResponse(**parsed_response)
    except (json.JSONDecodeError, AttributeError, IndexError) as e:
        ai_response = AIResponse(response="Error: Could not retrieve response.", inputTokens=0, outputTokens=0)

    # Save chat history with NULL feedback
    # cursor.execute("""
    #     INSERT INTO historys (user_id, user_request, system_response, session_id, timestamp, feedback)
    #     VALUES (%s, %s, %s, %s, %s, NULL)
    # """, (user_id, user_prompt, ai_response.response, session_id, timestamp))

    #update prompt count
    cursor.execute("UPDATE session SET prompt_count = prompt_count + 1 WHERE user_id = %s AND session_id = %s", (user_id, session_id))

    history_id = cursor.lastrowid
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({
        "response": ai_response.response,
        "inputTokens": ai_response.inputTokens,
        "outputTokens": ai_response.outputTokens,
        "id": history_id,
        "feedback": None
    })

@app.route('/feedback', methods=['POST'])
def feedback():
    data = request.json
    history_id = data.get('history_id')
    feedback = data.get('feedback')  # Expecting "like" or "dislike"

    if feedback not in ['like', 'dislike']:
        return jsonify({"error": "Invalid feedback"}), 400

    conn = mysql.connector.connect(**mysql_config)
    cursor = conn.cursor()

    # Update feedback in history
    cursor.execute("UPDATE historys SET feedback = %s WHERE id = %s", (feedback, history_id))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Feedback submitted successfully"})


@app.route("/history", methods=["GET"])
def get_history():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    conn = mysql.connector.connect(**mysql_config)
    cursor = conn.cursor()

    # Fetch chat history
    cursor.execute("""
        SELECT id, user_request, system_response, timestamp, feedback 
        FROM historys WHERE user_id = %s ORDER BY timestamp DESC
    """, (user_id,))

    history_data = cursor.fetchall()
    cursor.close()
    conn.close()

    # Convert to JSON format
    history_list = [{
        "id": row[0],
        "user_request": row[1],
        "system_response": row[2],
        "timestamp": row[3].strftime('%Y-%m-%d %H:%M:%S'),
        "feedback": row[4]  # Can be "like", "dislike", or NULL
    } for row in history_data]

    return jsonify({"history": history_list})

if __name__ == '__main__':
    app.run(debug=True)
