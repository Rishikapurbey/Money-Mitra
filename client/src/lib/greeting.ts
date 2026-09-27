// A greeting for the local time. Late at night a plain "Hello" reads better than
// "Good morning" (it isn't morning yet) or "Good night" (which sounds like goodbye).
export function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17) return "Good evening";
  return "Hello";
}
