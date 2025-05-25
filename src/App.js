import React from 'react';
import './App.css';
import { Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Dashboard from './components/Dashboard';
import PaymentForm from './components/PaymentForm';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import backgroundImage from './image/building.jpg';

const stripePromise = loadStripe('your_stripe_publishable_key_here');

const App = () => {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="app-wrapper" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="app-overlay" />
      <div className="app-content">
        {/* Navbar - always visible */}
        <nav className="navbar">
          <div className="app-name">CPP</div>
          <div className="navbar-links">
            <Link to="/payment">Payment</Link>
            <Link to="/dashboard">Dashboard</Link>
            {!isAuthenticated ? (
              <>
                <Link to="/login">Login</Link>
                <Link to="/register">Register</Link>
              </>
            ) : (
              <button onClick={logout}>Logout</button>
            )}
          </div>
        </nav>

        {/* Main Content with Routes */}
        <div className="main-content">
          <Routes>
            {/* Home page route */}
            <Route
              path="/"
              element={
                <section className="hero">
                  <h1>Customer Payment Portal</h1>
                  <p>
                    This platform allows customers to securely view their dashboard, manage
                    transactions, and make payments with ease.
                  </p>
                </section>
              }
            />

            {/* Other pages */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/payment"
              element={
                <Elements stripe={stripePromise}>
                  <PaymentForm />
                </Elements>
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default App;
