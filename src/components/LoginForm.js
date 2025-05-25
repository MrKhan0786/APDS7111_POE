import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setUsername('');
    setPassword('');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      setIsSubmitting(false);

      if (response.ok) {
        alert(data.message || 'Login successful!');
        localStorage.setItem('token', data.token);
        navigate('/dashboard');
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred during login.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.overlay}></div>
      <form onSubmit={handleSubmit} style={styles.container}>
        <h2 style={styles.heading}>Welcome Back</h2>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          style={styles.input}
          autoComplete="username"
        />

        <div style={{ position: 'relative', width: '75%' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={styles.input}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            style={styles.toggleBtn}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button type="submit" style={styles.button} disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrapper: {
    backgroundImage: 'url(https://source.unsplash.com/featured/?nature)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    height: '100vh',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: '50px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Poppins', sans-serif",
  },
  container: {
    backgroundColor: 'rgba(30, 30, 30, 0.85)',
    padding: '35px 30px',
    borderRadius: '12px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
    width: '90%',
    maxWidth: '320px',
    zIndex: 1,
    position: 'relative',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginTop: '30px',
    alignItems: 'center',  // center inputs horizontally
  },
  heading: {
    marginBottom: '10px',
    textAlign: 'center',
    color: '#1f2937',
  },
  input: {
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    fontSize: '16px',
    width: '100%',  // full width inside their 75% container
    boxSizing: 'border-box',
  },
  button: {
    padding: '12px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '16px',
    width: '100%',  // full width of form container
  },
  toggleBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    color: '#d1d5db',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

export default LoginForm;
