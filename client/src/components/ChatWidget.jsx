/**
 * ChatWidget.jsx
 *
 * Role-Aware AI Chatbot Assistant for RescueLink.
 *
 * Capabilities:
 * - Citizen / Guest: emergency triage reporting walkthrough, case status tracking, GPS location help.
 * - Rescuer: assigned case lookups, active workload check (max 3), release procedure, proof requirements.
 * - Administrator: live system metrics, pending/escalated counts, export & analytics assistance.
 * - Real-time emergency detection with immediate report redirection banner.
 * - Fallback resilience: works seamlessly even if external AI provider is offline.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const DEFAULT_PROMPTS = {
  citizen: [
    'How do I report an injured animal?',
    'Explain urgency categories and SLAs',
    'How do I set my location using GPS or map pins?',
    'What happens if an emergency is escalated?',
  ],
  responder: [
    'What are my active cases and workload?',
    'How do I release an assigned case?',
    'What evidence is required to mark a case rescued?',
    'How does automated escalation work?',
  ],
  admin: [
    'Show live system metrics and overview',
    'How many pending and escalated cases exist?',
    'What reports can I export?',
    'Explain duplicate report detection',
  ],
};

const ChatWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'citizen';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [emergencyAlert, setEmergencyAlert] = useState(null);

  const messagesEndRef = useRef(null);

  // Initialize initial greeting when role changes or opens
  useEffect(() => {
    if (messages.length === 0) {
      let welcomeText = `Hello! I'm the **RescueLink AI Assistant**.\n\nI can help you report an animal emergency, track a case status with your case ID (e.g., \`RC-...\`), or answer questions about RescueLink's response system.`;
      if (role === 'responder') {
        welcomeText = `Welcome, **Rescuer ${user?.name || ''}**!\n\nI can retrieve your assigned cases, check your current workload capacity (max 3), or review case release and evidence guidelines.`;
      } else if (role === 'admin') {
        welcomeText = `Greetings, **Administrator ${user?.name || ''}**!\n\nI can summarize live platform metrics, check pending/escalated queues, and guide you through administrative report exports.`;
      }

      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: welcomeText,
          timestamp: new Date(),
          actions: role === 'responder'
            ? [{ label: 'Rescuer Dashboard', path: '/rescuer' }]
            : role === 'admin'
            ? [{ label: 'Admin Dashboard', path: '/admin' }]
            : [{ label: 'Report Emergency', path: '/report' }],
        },
      ]);
    }
  }, [role, user, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const res = await api.post('/chat', { message: text });
      const data = res.data.data;

      if (data.emergencyAlert) {
        setEmergencyAlert(data.emergencyAlert);
      }

      const botMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply,
        timestamp: new Date(),
        actions: data.suggestedActions || [],
        liveData: data.liveContext?.queriedCase || null,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const errMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'I am momentarily unable to reach the rescue coordinator service. If you are reporting a critical life-threatening emergency, please click the button below to submit the incident directly.',
        timestamp: new Date(),
        actions: [{ label: 'Emergency Report', path: '/report' }],
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickPrompts = DEFAULT_PROMPTS[role] || DEFAULT_PROMPTS.citizen;

  return (
    <>
      {/* ── Floating Launcher Button ── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!isOpen && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-900/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md border border-slate-700/50 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Need Help? Ask AI</span>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle RescueLink Chatbot"
          className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-emerald-500/25 active:scale-95 border-2 border-white/20 cursor-pointer"
        >
          {isOpen ? (
            <span className="text-2xl font-bold">✕</span>
          ) : (
            <div className="relative flex items-center justify-center">
              <span className="text-2xl">🐾</span>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-300 border-2 border-emerald-600 rounded-full" />
            </div>
          )}
        </button>
      </div>

      {/* ── Chat Modal Window ── */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 w-[94vw] sm:w-[420px] max-h-[82vh] h-[620px] bg-slate-900/95 text-slate-100 rounded-3xl shadow-2xl border border-slate-700/60 flex flex-col z-50 backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
          style={{ boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6)' }}
        >
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-md border border-emerald-400/30">
                🐾
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white tracking-wide">RescueLink Assistant</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {role.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Operational Guidance
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Emergency Alert Banner */}
          {emergencyAlert && (
            <div className="bg-red-950/80 border-b border-red-500/50 p-3.5 flex items-start gap-3 text-red-200 text-xs animate-pulse">
              <span className="text-lg">🚨</span>
              <div className="flex-1">
                <p className="font-semibold leading-relaxed">{emergencyAlert.message}</p>
                <button
                  onClick={() => {
                    navigate(emergencyAlert.actionPath);
                    setIsOpen(false);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-xl shadow-md text-xs cursor-pointer transition-colors"
                >
                  ⚡ {emergencyAlert.actionLabel} &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-sm'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/50 rounded-bl-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>

                  {/* Actions / Interactive Pills */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-wrap gap-2">
                      {m.actions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            navigate(act.path);
                            setIsOpen(false);
                          }}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          🔗 {act.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 bg-slate-800/50 rounded-2xl w-fit border border-slate-700/40">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                <span>Checking live records…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Question Chips */}
          <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={loading}
                className="whitespace-nowrap px-3 py-1 rounded-full text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={role === 'responder' ? 'Ask about workload, release, or RC-...' : 'Ask a question or enter Case ID...'}
              className="flex-1 bg-slate-800/90 text-white placeholder-slate-400 text-xs sm:text-sm rounded-2xl px-4 py-2.5 border border-slate-700/70 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={loading || !inputValue.trim()}
              className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md transition-all cursor-pointer shrink-0"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
