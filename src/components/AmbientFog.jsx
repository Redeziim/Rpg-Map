import { useEffect, useState } from 'react';

const ambientAssets = `${import.meta.env.BASE_URL}assets/ambient/`;

export default function AmbientFog() {
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // The poster paints first; the 1.5 MB video waits for the page to finish loading and for an idle moment.
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(preference.matches);
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const connection = navigator.connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return undefined;
    let idle;
    const start = () => {
      idle = 'requestIdleCallback' in window
        ? window.requestIdleCallback(() => setVideoReady(true), { timeout: 3000 })
        : window.setTimeout(() => setVideoReady(true), 1500);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
    };
  }, []);

  return (
    <div className={`parchment-bg${reduceMotion ? ' still-only' : ''}`} aria-hidden="true">
      <div className="ambient-fog-still" style={{ backgroundImage: `url("${ambientAssets}golden-smoke-poster.webp")` }} />
      {!reduceMotion && videoReady && (
        <video className="ambient-fog-video" autoPlay muted loop playsInline preload="metadata" poster={`${ambientAssets}golden-smoke-poster.webp`}>
          <source src={`${ambientAssets}golden-smoke.mp4`} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
