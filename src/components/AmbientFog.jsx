import { useEffect, useState } from 'react';

const ambientAssets = `${import.meta.env.BASE_URL}assets/ambient/`;

export default function AmbientFog() {
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(preference.matches);
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  return (
    <div className={`parchment-bg${reduceMotion ? ' still-only' : ''}`} aria-hidden="true">
      <div className="ambient-fog-still" style={{ backgroundImage: `url("${ambientAssets}golden-smoke-poster.webp")` }} />
      {!reduceMotion && (
        <video className="ambient-fog-video" autoPlay muted loop playsInline preload="metadata" poster={`${ambientAssets}golden-smoke-poster.webp`}>
          <source src={`${ambientAssets}golden-smoke.mp4`} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
