import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import PublicCalendar from './components/PublicCalendar';
import AuthenticatedLayout from './components/AuthenticatedLayout';
import NotAuthorized from './components/NotAuthorized';
import Login from './components/Login';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthorized, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAuthorized) {
    return <Navigate to="/not-authorized" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isAuthorized } = useAuth();
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicCalendar />} />
      <Route path="/login" element={<Login />} />
      <Route 
        path="/not-authorized" 
        element={isAuthenticated && !isAuthorized ? <NotAuthorized /> : <Navigate to="/" replace />} 
      />
      
      {/* Protected routes */}
      <Route 
        path="/dashboard/*" 
        element={
          <ProtectedRoute>
            <AuthenticatedLayout />
          </ProtectedRoute>
        } 
      />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
