const pad = (n) => String(n).padStart(2, '0');

export const getDayLabel = (date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (itemDay.getTime() === today.getTime()) return 'Today';
  if (itemDay.getTime() === yesterday.getTime()) return 'Yesterday';

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();

  if (date >= twelveMonthsAgo) return `${weekday} ${dd}/${mm}`;

  return `${weekday} ${dd}/${mm}/${yyyy}`;
};

export const makeDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d;
};

export const makeMonthAgo = (monthsAgo) => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setHours(12, 0, 0, 0);
  return d;
};
