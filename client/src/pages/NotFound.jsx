import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NotFound = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative z-10">
        <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-4xl mx-auto mb-5 shadow-lg">
          🐾
        </div>

        <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500 mb-2">
          404
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Page Not Found</h1>

        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          The dispatch link or route you requested does not exist or has moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="btn-secondary py-3 text-xs justify-center bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            🏠 Public Home
          </Link>
          <Link
            to={user ? (user.role === 'responder' ? '/rescuer' : user.role === 'admin' ? '/admin' : '/dashboard') : '/login'}
            className="btn-emergency py-3 text-xs justify-center"
          >
            {user ? '🚀 My Dashboard' : '🔐 Sign In'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
