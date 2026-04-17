/** Selector options for the hour-of-day notification time picker (12-hour display). */
export const NOTIFICATION_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const suffix = i < 12 ? 'AM' : 'PM';
  const display = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { value: String(i), text: `${display}:00 ${suffix}` };
});

/** Common IANA timezone options shown in the notification settings picker. */
export const NOTIFICATION_TIMEZONES = [
  { value: 'Pacific/Honolulu',    text: 'Hawaii (UTC−10)' },
  { value: 'America/Anchorage',   text: 'Alaska (UTC−9)' },
  { value: 'America/Los_Angeles', text: 'Pacific (UTC−8/−7)' },
  { value: 'America/Denver',      text: 'Mountain (UTC−7/−6)' },
  { value: 'America/Chicago',     text: 'Central (UTC−6/−5)' },
  { value: 'America/New_York',    text: 'Eastern (UTC−5/−4)' },
  { value: 'America/Halifax',     text: 'Atlantic (UTC−4/−3)' },
  { value: 'America/Sao_Paulo',   text: 'Brasilia (UTC−3)' },
  { value: 'Atlantic/Azores',     text: 'Azores (UTC−1/0)' },
  { value: 'Europe/London',       text: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris',        text: 'Central Europe (UTC+1/+2)' },
  { value: 'Europe/Helsinki',     text: 'Eastern Europe (UTC+2/+3)' },
  { value: 'Europe/Moscow',       text: 'Moscow (UTC+3)' },
  { value: 'Asia/Dubai',          text: 'Gulf (UTC+4)' },
  { value: 'Asia/Karachi',        text: 'Pakistan (UTC+5)' },
  { value: 'Asia/Kolkata',        text: 'India (UTC+5:30)' },
  { value: 'Asia/Dhaka',          text: 'Bangladesh (UTC+6)' },
  { value: 'Asia/Bangkok',        text: 'Indochina (UTC+7)' },
  { value: 'Asia/Singapore',      text: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo',          text: 'Japan (UTC+9)' },
  { value: 'Australia/Sydney',    text: 'Sydney (UTC+10/+11)' },
  { value: 'Pacific/Auckland',    text: 'New Zealand (UTC+12/+13)' },
  { value: 'UTC',                 text: 'UTC' },
];
