import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "./context";

const Auth = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const { loginUser, registerUser, loginWithGoogle } = useGlobalContext();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      const success = await loginWithGoogle();
      if (success) {
        navigate("/");
      } else {
        setErrorMsg("Google Sign-In failed.");
      }
    } catch (err) {
      setErrorMsg(err.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password || (isRegister && !username)) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const success = await registerUser(email, password, username);
        if (success) {
          navigate("/");
        } else {
          setErrorMsg("Registration failed. Email might already be in use.");
        }
      } else {
        const success = await loginUser(email, password);
        if (success) {
          navigate("/");
        } else {
          setErrorMsg("Invalid email or password.");
        }
      }
    } catch (err) {
      setErrorMsg(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-section">
      <div className="auth-card">
        <h2>{isRegister ? "Create Account" : "Welcome Back"}</h2>
        <p className="auth-subtitle">
          {isRegister ? "Join the CineVerse tracking community" : "Sign in to update your watchlists"}
        </p>

        {errorMsg && <div className="auth-error">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>{isRegister ? "Email Address" : "Email Address or Username"}</label>
            <input
              type={isRegister ? "email" : "text"}
              placeholder={isRegister ? "name@example.com" : "name@example.com or @username"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {isRegister && (
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Processing..." : isRegister ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button onClick={handleGoogleLogin} className="google-btn" type="button" disabled={loading}>
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.12h4.02c2.35-2.16 3.7-5.35 3.7-8.74z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.02-3.12c-1.12.75-2.54 1.19-3.94 1.19-3.04 0-5.61-2.05-6.53-4.82H1.31v3.2A12.002 12.002 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.47 14.34a7.16 7.16 0 0 1 0-2.68V8.46H1.31a12.002 12.002 0 0 0 0 7.08l4.16-3.2z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.96 1.19 15.24 0 12 0 7.31 0 3.25 2.71 1.31 6.66l4.16 3.2c.92-2.77 3.49-4.82 6.53-4.82z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="auth-toggle">
          {isRegister ? "Already have an account?" : "New to CineVerse?"}{" "}
          <button onClick={() => { setIsRegister(!isRegister); setErrorMsg(""); }} className="toggle-link">
            {isRegister ? "Sign In" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
