import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
  const { user, token, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Memuat sesi pengguna...</p>
      </div>
    );
  }

  // If no token or user is present, redirect to login but save the attempted location
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated, render the child routes (via Outlet)
  return <Outlet />;
}
