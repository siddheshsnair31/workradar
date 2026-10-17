import { useEffect, useState } from 'react';

/** Tiny hash router: #/feed?tab=blocked, #/item/i-01, #/search?q=... */
export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const onChange = () => { setHash(window.location.hash || '#/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const [rawPath, qs] = hash.slice(1).split('?');
  const path = rawPath || '/';
  return { path, segments: path.split('/').filter(Boolean), params: new URLSearchParams(qs || '') };
}

export function navigate(to: string) {
  window.location.hash = to.startsWith('#') ? to : '#' + to;
}

export function href(to: string) {
  return '#' + to;
}
