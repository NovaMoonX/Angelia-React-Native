import type * as Notifications from 'expo-notifications';
import {
  consumeNotificationResponse,
  releaseNotificationResponse,
} from '@/lib/notificationResponseDedup';
import { pushRouteWhenNavigatorReady } from '@/lib/pushRouteWhenReady';
import { navigateFromNotification } from '@/lib/notification/navigateFromNotification';
import { extractNotificationData } from '@/lib/notification/notificationRouting';

/**
 * Handles a tapped notification exactly once: claims it (so the module-level listener
 * and the cold-start fallback cannot both navigate), waits for the navigator, then
 * routes. If the navigator never became ready the claim is released so the other
 * handler can still try.
 */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const claimed = await consumeNotificationResponse(response);
  if (!claimed) {
    return;
  }

  const notification = response.notification;
  const identifier = notification.request.identifier;
  const data = extractNotificationData(notification);

  const didNavigate = await pushRouteWhenNavigatorReady(() => {
    navigateFromNotification(identifier, data);
  });

  if (!didNavigate) {
    await releaseNotificationResponse(response);
  }
}
