import { apiRequest } from "./queryClient";

// Check if push notifications are supported
export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Convert base64 URL-safe string to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported');
  }

  return await Notification.requestPermission();
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(): Promise<void> {
  console.log('subscribeToPushNotifications: Starting subscription process...');
  
  // Helper to report progress/errors to server for debugging
  const reportStep = async (step: string, data: any = {}) => {
    try {
      await fetch('/api/debug/push-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          data,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (e) {
      // Ignore reporting errors
    }
  };
  
  const reportError = async (step: string, error: any) => {
    try {
      await fetch('/api/debug/push-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          error: error?.message || String(error),
          stack: error?.stack,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (e) {
      // Ignore reporting errors
    }
  };
  
  try {
    await reportStep('start', {});
    
    // Check if already granted
    console.log('subscribeToPushNotifications: Current permission:', Notification.permission);
    await reportStep('check_permission', { permission: Notification.permission });
    
    if (Notification.permission !== 'granted') {
      console.log('subscribeToPushNotifications: Requesting permission...');
      await reportStep('requesting_permission', {});
      
      try {
        const permission = await requestNotificationPermission();
        console.log('subscribeToPushNotifications: Permission result:', permission);
        await reportStep('permission_result', { permission });
        
        if (permission !== 'granted') {
          console.log('Push notification permission denied');
          await reportError('permission_denied', new Error(`Permission: ${permission}`));
          return;
        }
      } catch (error) {
        console.error('Error requesting permission:', error);
        await reportError('request_permission', error);
        throw error;
      }
    }

    // Get service worker registration
    console.log('subscribeToPushNotifications: Checking service worker registration...');
    await reportStep('checking_service_worker', {});
    
    // First, check if service worker is registered at all
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      const error = new Error('No service worker registered');
      await reportError('no_service_worker', error);
      throw error;
    }
    
    await reportStep('service_worker_found', { 
      active: !!registration.active,
      installing: !!registration.installing,
      waiting: !!registration.waiting,
    });
    
    // If not active yet, wait for it with a timeout
    if (!registration.active) {
      console.log('subscribeToPushNotifications: Waiting for service worker to activate...');
      await reportStep('waiting_activation', {});
      
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Service worker activation timeout')), 5000)
        )
      ]).catch(async (error) => {
        await reportError('activation_timeout', error);
        throw error;
      });
    }
    
    console.log('subscribeToPushNotifications: Service worker ready');
    await reportStep('service_worker_ready', {});

    // Get existing subscription
    console.log('subscribeToPushNotifications: Checking for existing subscription...');
    await reportStep('checking_existing_subscription', {});
    let subscription = await registration.pushManager.getSubscription();
    console.log('subscribeToPushNotifications: Existing subscription:', subscription ? 'found' : 'not found');
    await reportStep('existing_subscription_check', { found: !!subscription });

    // If no subscription, create one
    if (!subscription) {
      console.log('subscribeToPushNotifications: Fetching VAPID public key...');
      await reportStep('fetching_vapid_key', {});
      try {
        // Get VAPID public key from server
        const response = await fetch('/api/push/vapid-public-key');
        if (!response.ok) {
          throw new Error(`VAPID key fetch failed: ${response.status}`);
        }
        const { publicKey } = await response.json();
        console.log('subscribeToPushNotifications: VAPID key received, length:', publicKey?.length);
        await reportStep('vapid_key_received', { length: publicKey?.length });

        // Subscribe to push
        console.log('subscribeToPushNotifications: Creating push subscription...');
        await reportStep('creating_push_subscription', {});
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        console.log('subscribeToPushNotifications: Push subscription created');
        await reportStep('push_subscription_created', {});
      } catch (error) {
        console.error('Error creating push subscription:', error);
        await reportError('create_subscription', error);
        throw error;
      }
    }

    // Send subscription to server
    if (subscription) {
      console.log('subscribeToPushNotifications: Sending subscription to server...');
      await reportStep('sending_to_server', {});
      try {
        const subscriptionJSON = subscription.toJSON();
        await apiRequest('POST', '/api/push/subscribe', {
          endpoint: subscriptionJSON.endpoint,
          p256dh: subscriptionJSON.keys?.p256dh,
          auth: subscriptionJSON.keys?.auth,
        });

        console.log('Successfully subscribed to push notifications');
        await reportStep('subscription_complete', {});
      } catch (error) {
        console.error('Error sending subscription to server:', error);
        await reportError('send_to_server', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    await reportError('general', error);
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await apiRequest('POST', '/api/push/unsubscribe', {
        endpoint: subscription.endpoint,
      });
      console.log('Successfully unsubscribed from push notifications');
    }
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
  }
}
