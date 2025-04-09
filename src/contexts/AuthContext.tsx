import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated on mount
    const checkAuth = async () => {
      try {
        console.log('Checking auth status...'); // Debug log
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/check-auth`, {
          credentials: 'include',
        });
        const data = await response.json();
        console.log('Auth check response:', data); // Debug log
        setIsAuthenticated(data.authenticated);
      } catch (error) {
        console.error('Auth check error:', error); // Debug log
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  const login = () => {
    console.log('Setting authenticated state to true'); // Debug log
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      console.log('Logging out...'); // Debug log
      await fetch(`${import.meta.env.VITE_API_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      console.log('Logout successful'); // Debug log
    } catch (error) {
      console.error('Error logging out:', error);
    }
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 