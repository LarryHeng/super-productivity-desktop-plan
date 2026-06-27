export const getPlannerWeekStart = (relativeDate: Date): Date => {
  const start = new Date(
    relativeDate.getFullYear(),
    relativeDate.getMonth(),
    relativeDate.getDate(),
  );
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
};
