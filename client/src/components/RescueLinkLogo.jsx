import React from 'react';

/**
 * RescueLinkLogo
 * Professional vector SVG logo representing compassionate animal emergency rescue.
 * Features a heart shield, protective paw print, and emergency medical cross lifeline.
 */
const RescueLinkLogo = ({ className = 'w-10 h-10', showText = false, textClassName = 'text-slate-900' }) => {
  return (
    <div className="flex items-center gap-3">
      <div className={`relative shrink-0 ${className} group-hover:scale-105 transition-transform duration-300`}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="rlLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e11d48" />
              <stop offset="50%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <linearGradient id="rlHeartGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#be123c" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
          </defs>

          {/* Protective Heart Shape Background */}
          <path
            d="M50 88 C20 68 8 50 8 32 C8 18 19 8 33 8 C41 8 47 12 50 17 C53 12 59 8 67 8 C81 8 92 18 92 32 C92 50 80 68 50 88 Z"
            fill="url(#rlLogoGrad)"
          />

          {/* Inner Paw Print Pad (Heart-shaped center) */}
          <path
            d="M50 64 C42 64 36 57 38 49 C39 44 44 41 50 41 C56 41 61 44 62 49 C64 57 58 64 50 64 Z"
            fill="#ffffff"
          />

          {/* Paw Toe 1 (Left-most) */}
          <ellipse cx="32" cy="36" rx="6.5" ry="9" transform="rotate(-20 32 36)" fill="#ffffff" />

          {/* Paw Toe 2 (Center-left) */}
          <ellipse cx="43" cy="27" rx="6.5" ry="9" transform="rotate(-6 43 27)" fill="#ffffff" />

          {/* Paw Toe 3 (Center-right) */}
          <ellipse cx="57" cy="27" rx="6.5" ry="9" transform="rotate(6 57 27)" fill="#ffffff" />

          {/* Paw Toe 4 (Right-most) */}
          <ellipse cx="68" cy="36" rx="6.5" ry="9" transform="rotate(20 68 36)" fill="#ffffff" />

          {/* Small Emergency Lifeline Cross inside central pad */}
          <path
            d="M48 48 H52 M50 46 V50"
            stroke="#e11d48"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`text-base font-extrabold tracking-tight ${textClassName}`}>RescueLink</span>
            <span className="text-[9px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
              24/7
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium -mt-0.5">Animal Emergency Network</span>
        </div>
      )}
    </div>
  );
};

export default RescueLinkLogo;
