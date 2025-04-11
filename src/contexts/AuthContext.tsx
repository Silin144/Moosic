import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  logout: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  checkAuthStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Use this to prevent multiple auth checks in a short period
let lastAuthCheck = 0;
let lastAuthResult = false;
const AUTH_CHECK_THROTTLE = 5000; // 5 seconds

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // Check authentication status on mount, but only once
  useEffect(() => {
    const now = Date.now();
    // If we've checked auth recently, use the cached result
    if (now - lastAuthCheck < AUTH_CHECK_THROTTLE) {
      console.log('Using cached auth status', lastAuthResult);
      setIsAuthenticated(lastAuthResult);
      return;
    }
    checkAuthStatus();
  }, []);
  
  const checkAuthStatus = async (): Promise<boolean> => {
    const now = Date.now();
    
    // If we've checked auth recently, use the cached result
    if (now - lastAuthCheck < AUTH_CHECK_THROTTLE) {
      console.log('Using cached auth status', lastAuthResult);
      return lastAuthResult;
    }
    
    try {
      console.log('Checking auth status from server...');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/check-auth`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error('Auth check failed with status:', response.status);
        setIsAuthenticated(false);
        
        // Update cache
        lastAuthCheck = now;
        lastAuthResult = false;
        
        return false;
      }
      
      const data = await response.json();
      console.log('Auth check response:', data);
      
      const isAuth = !!data.authenticated;
      setIsAuthenticated(isAuth);
      
      // Update cache
      lastAuthCheck = now;
      lastAuthResult = isAuth;
      
      return isAuth;
    } catch (err) {
      console.error('Auth check error:', err);
      setIsAuthenticated(false);
      
      // Update cache
      lastAuthCheck = now;
      lastAuthResult = false;
      
      return false;
    }
  };
  
  // Custom fetch wrapper that always includes credentials
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const defaultOptions: RequestInit = {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };
    
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...(options.headers || {})
      }
    };
    
    console.log(`Making authenticated request to ${url}`);
    const response = await fetch(url, mergedOptions);
    
    // If we get a 401 Unauthorized, update auth state and throw error
    if (response.status === 401) {
      console.error('Received 401 Unauthorized response');
      setIsAuthenticated(false);
      
      // Update cache
      lastAuthCheck = Date.now();
      lastAuthResult = false;
      
      throw new Error('Not authenticated');
    }
    
    return response;
  };

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/logout`, {
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
    
    setIsAuthenticated(false);
    
    // Update cache
    lastAuthCheck = Date.now();
    lastAuthResult = false;
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      setIsAuthenticated, 
      logout,
      fetchWithAuth,
      checkAuthStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 