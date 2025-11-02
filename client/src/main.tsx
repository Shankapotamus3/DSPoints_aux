import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('PWA: Service Worker registered successfully');
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          console.log('PWA: New service worker version found');
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New version available - auto-update instead of prompting
                  console.log('PWA: New version available, updating automatically');
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                } else {
                  // First time installation
                  console.log('PWA: App cached for offline use');
                }
              }
            });
          }
        });
      })
      .catch((registrationError) => {
        console.error('PWA: Service Worker registration failed:', registrationError);
      });

    // Listen for service worker controller changes (updates)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('PWA: Service Worker updated, reloading page');
      window.location.reload();
    });

    // Listen for push notifications received while app is in foreground
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'PUSH_RECEIVED') {
        console.log('PWA: Push notification received in foreground', event.data);
        
        // The service worker will still show the system notification
        // But we could also trigger an in-app notification here if needed
        // For now, we rely on the system notification which the service worker shows
        
        // Optionally, you could play a sound or show a toast here
        // Example: showToast(event.data.title, event.data.message);
      } else if (event.data && event.data.type === 'NAVIGATE') {
        // Handle navigation from notification click
        window.location.href = event.data.url;
      }
    });
  });
} else {
  console.warn('PWA: Service Worker not supported in this browser');
}

createRoot(document.getElementById("root")!).render(<App />);
