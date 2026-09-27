// Lets parts of the dashboard tell each other that budgets or goals changed,
// e.g. so the welcome checklist can tick off "Set a budget" straight away.
const EVENT = "money-mitra:data-changed";

export const announceDataChange = () => window.dispatchEvent(new Event(EVENT));

export function onDataChange(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

// Notifications were read or changed, so the bell's count should refresh
const NOTIFICATIONS_EVENT = "money-mitra:notifications-changed";

export const announceNotificationsChange = () => window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));

export function onNotificationsChange(listener: () => void) {
  window.addEventListener(NOTIFICATIONS_EVENT, listener);
  return () => window.removeEventListener(NOTIFICATIONS_EVENT, listener);
}
