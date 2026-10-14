import { useState, useEffect, useRef } from 'react';

/**
 * useParallax
 * High-performance scroll & mouse move parallax hook.
 * Uses requestAnimationFrame and passive listeners for 60fps responsiveness.
 */
export function useParallax({
  scrollSpeed = 0.2,
  mouseSensitivity = 14,
  enableMouse = true,
  enableScroll = true,
} = {}) {
  const containerRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0, tiltX: 0, tiltY: 0 });

  useEffect(() => {
    if (!enableScroll) return;

    let rafId = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          // Distance of top of container from top of viewport
          const offset = (window.innerHeight - rect.top) * scrollSpeed;
          setScrollOffset(offset * 0.4);
        } else {
          setScrollOffset(window.scrollY * scrollSpeed);
        }
        rafId = null;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scrollSpeed, enableScroll]);

  const handleMouseMove = (e) => {
    if (!enableMouse || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5;

    setMouseOffset({
      x: -nx * mouseSensitivity,
      y: -ny * mouseSensitivity,
      tiltX: -ny * 4,
      tiltY: nx * 4,
    });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0, tiltX: 0, tiltY: 0 });
  };

  return {
    containerRef,
    scrollOffset,
    mouseOffset,
    handleMouseMove,
    handleMouseLeave,
    parallaxBgStyle: {
      transform: `translate3d(${mouseOffset.x}px, ${scrollOffset * -0.6 + mouseOffset.y}px, 0) scale(1.08)`,
      transition: 'transform 0.12s cubic-bezier(0.2, 0, 0.2, 1)',
      willChange: 'transform',
    },
    mouseBgStyle: {
      transform: `translate3d(${mouseOffset.x}px, ${mouseOffset.y}px, 0) scale(1.06)`,
      transition: 'transform 0.15s cubic-bezier(0.2, 0, 0.2, 1)',
      willChange: 'transform',
    },
    cardTiltStyle: {
      transform: `perspective(1000px) rotateX(${mouseOffset.tiltX}deg) rotateY(${mouseOffset.tiltY}deg) translateZ(10px)`,
      transition: 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)',
      willChange: 'transform',
    },
  };
}

export default useParallax;
