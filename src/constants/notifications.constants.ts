/** Selector options for the time-of-day notification time picker (15-minute increments). */
export const NOTIFICATION_TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const hour = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const minuteStr = minute === 0 ? '00' : String(minute);
  return {
    value: `${hour}:${minute}`,
    text: `${displayHour}:${minuteStr} ${suffix}`,
  };
});

/** Common IANA timezone options shown in the notification settings picker. */
export const NOTIFICATION_TIMEZONES = [
  { value: 'Pacific/Honolulu',    text: 'Honolulu (UTC−10)' },
  { value: 'America/Anchorage',   text: 'Anchorage (UTC−9)' },
  { value: 'America/Los_Angeles', text: 'Los Angeles (UTC−8/−7)' },
  { value: 'America/Denver',      text: 'Denver (UTC−7/−6)' },
  { value: 'America/Chicago',     text: 'Chicago (UTC−6/−5)' },
  { value: 'America/New_York',    text: 'New York (UTC−5/−4)' },
  { value: 'America/Halifax',     text: 'Halifax (UTC−4/−3)' },
  { value: 'America/Sao_Paulo',   text: 'São Paulo (UTC−3)' },
  { value: 'Atlantic/Azores',     text: 'Azores (UTC−1/0)' },
  { value: 'Europe/London',       text: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris',        text: 'Paris (UTC+1/+2)' },
  { value: 'Europe/Helsinki',     text: 'Helsinki (UTC+2/+3)' },
  { value: 'Europe/Moscow',       text: 'Moscow (UTC+3)' },
  { value: 'Asia/Dubai',          text: 'Dubai (UTC+4)' },
  { value: 'Asia/Karachi',        text: 'Karachi (UTC+5)' },
  { value: 'Asia/Kolkata',        text: 'Mumbai (UTC+5:30)' },
  { value: 'Asia/Dhaka',          text: 'Dhaka (UTC+6)' },
  { value: 'Asia/Bangkok',        text: 'Bangkok (UTC+7)' },
  { value: 'Asia/Singapore',      text: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo',          text: 'Tokyo (UTC+9)' },
  { value: 'Australia/Sydney',    text: 'Sydney (UTC+10/+11)' },
  { value: 'Pacific/Auckland',    text: 'Auckland (UTC+12/+13)' },
  { value: 'UTC',                 text: 'UTC (UTC+0)' },
];
