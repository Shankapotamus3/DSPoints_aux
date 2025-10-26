import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { subscribeToPushNotifications, isPushNotificationSupported } from "@/lib/pushNotifications";

export default function PushTest() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  const testPushSupport = () => {
    addLog('=== Testing Push Support ===');
    addLog(`ServiceWorker: ${'serviceWorker' in navigator}`);
    addLog(`PushManager: ${'PushManager' in window}`);
    addLog(`Notification: ${'Notification' in window}`);
    addLog(`isPushNotificationSupported(): ${isPushNotificationSupported()}`);
    addLog(`Current permission: ${Notification.permission}`);
  };

  const testSubscribe = async () => {
    addLog('=== Attempting Subscription ===');
    try {
      await subscribeToPushNotifications();
      addLog('✅ Subscription succeeded!');
    } catch (error) {
      addLog(`❌ Subscription failed: ${error}`);
    }
  };

  const testNotificationPermission = async () => {
    addLog('=== Requesting Permission ===');
    try {
      const permission = await Notification.requestPermission();
      addLog(`Permission result: ${permission}`);
    } catch (error) {
      addLog(`❌ Permission request failed: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Push Notification Diagnostics</h1>

        <Card className="p-4 space-y-4">
          <h2 className="text-lg font-semibold">Test Controls</h2>
          
          <div className="flex flex-wrap gap-2">
            <Button onClick={testPushSupport} data-testid="button-test-support">
              Test Support
            </Button>
            <Button onClick={testNotificationPermission} data-testid="button-test-permission">
              Request Permission
            </Button>
            <Button onClick={testSubscribe} data-testid="button-test-subscribe">
              Subscribe to Push
            </Button>
            <Button onClick={() => setLogs([])} variant="outline" data-testid="button-clear-logs">
              Clear Logs
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Diagnostic Logs</h2>
          <div className="bg-muted rounded p-3 font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">No logs yet. Click a test button above.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-xs break-all">{log}</div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Click "Test Support" to check if your browser supports push notifications</li>
            <li>Click "Request Permission" to trigger the notification permission prompt</li>
            <li>Click "Subscribe to Push" to attempt subscribing to push notifications</li>
            <li>Check the logs below for any errors</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
