// Lets parts of the dashboard tell each other that budgets or goals changed,
// e.g. so the welcome checklist can tick off "Set a budget" straight away.
const EVENT = "money-mitra:data-changed";

export const announceDataChange = () => window.dispatchEvent(new Event(EVENT));

export function onDataChange(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
