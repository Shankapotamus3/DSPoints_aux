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
  
  try {
    // Check if already granted
    console.log('subscribeToPushNotifications: Current permission:', Notification.permission);
    if (Notification.permission !== 'granted') {
      console.log('subscribeToPushNotifications: Requesting permission...');
      const permission = await requestNotificationPermission();
      console.log('subscribeToPushNotifications: Permission result:', permission);
      if (permission !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }
    }

    // Get service worker registration
    console.log('subscribeToPushNotifications: Waiting for service worker...');
    const registration = await navigator.serviceWorker.ready;
    console.log('subscribeToPushNotifications: Service worker ready');

    // Get existing subscription
    console.log('subscribeToPushNotifications: Checking for existing subscription...');
    let subscription = await registration.pushManager.getSubscription();
    console.log('subscribeToPushNotifications: Existing subscription:', subscription ? 'found' : 'not found');

    // If no subscription, create one
    if (!subscription) {
      console.log('subscribeToPushNotifications: Fetching VAPID public key...');
      // Get VAPID public key from server
      const response = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await response.json();
      console.log('subscribeToPushNotifications: VAPID key received, length:', publicKey?.length);

      // Subscribe to push
      console.log('subscribeToPushNotifications: Creating push subscription...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log('subscribeToPushNotifications: Push subscription created');
    }

    // Send subscription to server
    if (subscription) {
      console.log('subscribeToPushNotifications: Sending subscription to server...');
      const subscriptionJSON = subscription.toJSON();
      await apiRequest('POST', '/api/push/subscribe', {
        endpoint: subscriptionJSON.endpoint,
        p256dh: subscriptionJSON.keys?.p256dh,
        auth: subscriptionJSON.keys?.auth,
      });

      console.log('Successfully subscribed to push notifications');
    }
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
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
