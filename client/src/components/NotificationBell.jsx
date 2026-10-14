/**
 * NotificationBell.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const pollRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const raw = res.data?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.notifications)
            ? raw.notifications
            : [];
      setNotifications(list);
      const count = typeof res.data?.unreadCount === 'number'
        ? res.data.unreadCount
        : typeof raw?.unreadCount === 'number'
          ? raw.unreadCount
          : list.filter((n) => !n.read).length;
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    pollRef.current = setInterval(() => {
      fetchNotifications();
    }, 15000); // Poll every 15s

    return () => clearInterval(pollRef.current);
  }, [user]);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    setIsOpen(false);
    if (!notification.read) {
      try {
        await api.patch(`/notifications/${notification._id}/read`);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          (Array.isArray(prev) ? prev : []).map((n) => (n._id === notification._id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.error('Failed to mark read', err);
      }
    }
    if (notification.rescueCase) {
      const caseId = typeof notification.rescueCase === 'object' ? notification.rescueCase._id : notification.rescueCase;
      navigate(`/rescues/${caseId}`);
    }
  };

  if (!user) return null;

  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-full hover:bg-gray-100 focus:outline-none"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full transform translate-x-1 -translate-y-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-50 border border-gray-100">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  try {
                    await api.patch('/notifications/read-all');
                    setUnreadCount(0);
                    setNotifications(safeNotifications.map((n) => ({ ...n, read: true })));
                  } catch (e) {
                    console.error('Failed to mark all as read');
                  }
                }}
                className="text-xs text-primary-600 hover:underline font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {safeNotifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                You don't have any notifications yet.
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {safeNotifications.slice(0, 5).map((n) => (
                  <li
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !n.read ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    <div className="flex gap-2">
                      <div className="mt-0.5">
                        {!n.read ? (
                          <span className="text-primary-600 text-xs">🔵</span>
                        ) : (
                          <span className="text-gray-300 text-xs">⚪</span>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setIsOpen(false)}
            className="block w-full p-2 text-center text-xs font-medium text-gray-600 hover:bg-gray-50 border-t border-gray-100 transition-colors"
          >
            View All Notifications
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
