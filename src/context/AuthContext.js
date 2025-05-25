import React, { createContext, useContext, useState } from 'react';

// AuthContext to manage the user's authentication state
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// AuthProvider to wrap around your app and provide the authentication state
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const login = (username, password) => {
    // Assume some authentication logic here, such as calling an API
    // For now, we'll simulate successful login
    setIsAuthenticated(true);
    setUser({ username });
  };

  const logout = () => {
    // Clear the authentication state
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
