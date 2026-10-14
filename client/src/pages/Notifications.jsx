/**
 * Notifications.jsx
 *
 * Dedicated page to view all notifications.
 * Premium UI matching the RescueLink design system.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const TYPE_ICON = {
  CASE_CREATED:    '📋',
  CASE_ACCEPTED:   '✅',
  RESCUE_STARTED:  '🚀',
  CASE_RESCUED:    '🎉',
  CASE_CANCELLED:  '✕',
  STATUS_CHANGED:  '🔄',
  ESCALATED:       '⚡',
  NOTE:            '💬',
};

const Notifications = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState('');

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/notifications');
      const raw = res.data?.data;
      let list = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && Array.isArray(raw.data)) {
        list = raw.data;
      } else if (raw && Array.isArray(raw.notifications)) {
        list = raw.notifications;
      } else if (raw && Array.isArray(raw.items)) {
        list = raw.items;
      }
      setNotifications(list);
    } catch (err) {
      setError('Failed to load notifications.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        (Array.isArray(prev) ? prev : []).map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => (Array.isArray(prev) ? prev.map((n) => ({ ...n, read: true })) : []));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await handleMarkAsRead(notification._id, { stopPropagation: () => {} });
    }
    if (notification.rescueCase) {
      const caseId = typeof notification.rescueCase === 'object'
        ? notification.rescueCase._id
        : notification.rescueCase;
      navigate(`/rescues/${caseId}`);
    }
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 nav-glass">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white shadow-sm shadow-rose-500/25 group-hover:scale-110 transition-transform">
                🐾
              </div>
              <span className="font-extrabold text-slate-900 text-sm tracking-tight hidden sm:block">RescueLink</span>
            </Link>
            <span className="text-slate-300 hidden sm:block">/</span>
            <span className="text-xs font-semibold text-slate-500 hidden sm:block">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-black text-white bg-rose-500 px-2 py-0.5 rounded-full hidden sm:block">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="hidden sm:flex btn-secondary text-xs py-1.5 px-3.5">
              ← Dashboard
            </Link>
            <NotificationBell />
            <button onClick={handleLogout} className="btn-secondary text-xs py-1.5 px-3.5 cursor-pointer hidden sm:block">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">Notifications</h1>
            <p className="text-sm text-slate-500 mt-1">Stay updated on your rescue cases and alerts</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="btn-secondary text-xs py-2 px-4 cursor-pointer"
              >
                ✓ Mark all read
              </button>
            )}
            <button onClick={loadNotifications} className="btn-secondary text-xs py-2 px-4 cursor-pointer">
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-rose-500 animate-spin" />
            </div>
            <p className="text-sm text-slate-400 font-medium">Loading notifications…</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="rounded-2xl p-6 text-center mb-6"
            style={{ background: 'rgba(254,242,242,0.8)', border: '1px solid rgba(252,165,165,0.4)' }}>
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-red-700 text-sm font-medium mb-4">{error}</p>
            <button onClick={loadNotifications} className="btn-secondary text-xs py-2 px-4 cursor-pointer">
              Try Again
            </button>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && !error && safeNotifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-4xl">
              🔔
            </div>
            <h2 className="text-lg font-bold text-slate-800">No notifications yet</h2>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
              When there are updates on your rescue cases, they will appear here.
            </p>
            <Link to="/dashboard" className="btn-secondary text-sm px-6 py-2.5 mt-2">
              ← Back to Dashboard
            </Link>
          </div>
        )}

        {/* ── Notification List ── */}
        {!loading && !error && safeNotifications.length > 0 && (
          <div className="space-y-3">
            {safeNotifications.map((n, i) => {
              const icon = TYPE_ICON[n.type] || '🔔';
              return (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className="group relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    border: !n.read
                      ? '1px solid rgba(99,102,241,0.25)'
                      : '1px solid rgba(226,232,240,0.7)',
                    boxShadow: !n.read
                      ? '0 4px 20px rgba(99,102,241,0.08), 0 1px 4px rgba(15,23,42,0.04)'
                      : '0 2px 8px rgba(15,23,42,0.04)',
                    animationDelay: `${i * 0.04}s`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(15,23,42,0.1)'; }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = !n.read
                      ? '0 4px 20px rgba(99,102,241,0.08)'
                      : '0 2px 8px rgba(15,23,42,0.04)';
                  }}
                >
                  {/* Unread accent bar */}
                  {!n.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-l-2xl" />
                  )}

                  <div className={`p-5 flex gap-4 ${!n.read ? 'pl-6' : ''}`}>
                    {/* Icon */}
                    <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-xl ${
                      !n.read ? 'bg-indigo-50' : 'bg-slate-50'
                    }`}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className={`text-sm leading-snug ${!n.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {n.title}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          )}
                          <span className="text-[11px] text-slate-400 whitespace-nowrap font-mono-case">
                            {new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            {' '}
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>

                      {(n.rescueCase || !n.read) && (
                        <div className="mt-3 flex items-center gap-3">
                          {n.rescueCase && (
                            <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                              View Case Details ↗
                            </span>
                          )}
                          {!n.read && (
                            <button
                              onClick={(e) => handleMarkAsRead(n._id, e)}
                              className="text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Notifications;
