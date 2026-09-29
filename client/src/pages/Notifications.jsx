/**
 * Notifications.jsx
 *
 * Dedicated page to view all notifications.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const Notifications = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data);
    } catch (err) {
      setError('Failed to load notifications.');
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
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await handleMarkAsRead(notification._id, { stopPropagation: () => {} });
    }
    if (notification.rescueCase) {
      const caseId = typeof notification.rescueCase === 'object' ? notification.rescueCase._id : notification.rescueCase;
      navigate(`/rescues/${caseId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-bold text-gray-900">RescueLink</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</Link>
            <NotificationBell />
            <button onClick={handleLogout} className="btn-secondary text-sm hidden sm:block">Logout</button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">Stay updated on your rescue cases</p>
          </div>
          <div className="flex gap-2">
            {notifications.some((n) => !n.read) && (
              <button onClick={handleMarkAllAsRead} className="btn-secondary text-sm bg-white">
                Mark all as read
              </button>
            )}
            <button onClick={loadNotifications} className="btn-secondary text-sm bg-white">
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="card bg-red-50 border-red-100 text-red-700 text-sm">
            {error}
          </div>
        ) : notifications.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-4xl mb-3">🔔</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">You don't have any notifications yet.</h2>
            <p className="text-sm text-gray-500">When there are updates to your rescue cases, they will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => handleNotificationClick(n)}
                className={`card p-4 flex gap-4 cursor-pointer transition-colors border-l-4 hover:shadow-md ${
                  !n.read ? 'border-l-primary-500 bg-white' : 'border-l-transparent bg-gray-50/50'
                }`}
              >
                <div className="shrink-0 mt-1">
                  {!n.read ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-sm" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className={`text-base ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </h3>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                  
                  {n.rescueCase && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-primary-600 flex items-center gap-1">
                        View Case Details ↗
                      </span>
                      {!n.read && (
                        <button
                          onClick={(e) => handleMarkAsRead(n._id, e)}
                          className="text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Notifications;
