import React from 'react';
import { useUIMode } from '@/pages/progress-connect/context';
import { AppNotification } from '@/pages/progress-connect/components/AppNotification';
import { AppFullscreen } from '@/pages/progress-connect/components/AppFullScreen';

export default function App() {
  const mode = useUIMode();

  React.useEffect(() => {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const container = document.getElementById('container')!;
    container.style.height = mode === 'fullscreen' ? '100vh' : 'auto';
    document.body.style.backgroundColor =
      mode === 'fullscreen' ? 'rgba(255, 255, 255, 0.95)' : 'white';
  }, [mode]);

  if (mode === 'fullscreen') {
    return <AppFullscreen />;
  }

  return <AppNotification />;
}
