import { Navigate } from 'react-router-dom';
import { useMobile } from '@/components/mobile';
import { MobileCommandCenter } from '@/components/mobile/MobileCommandCenter';

/**
 * Home route — renders the Mobile Command Center on small screens,
 * redirects to Observatory on desktop (preserving existing behavior).
 */
export function Home() {
  const isMobile = useMobile();

  if (!isMobile) {
    return <Navigate to="/observatory" replace />;
  }

  return <MobileCommandCenter />;
}
