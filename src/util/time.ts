export function parseDuration(durationStr: string): number | null {
  const match = durationStr.match(/^(\d+)([mhd])$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  let minutes: number;
  switch (unit) {
    case "m":
      minutes = value;
      break;
    case "h":
      minutes = value * 60;
      break;
    case "d":
      minutes = value * 1440;
      break;
    default:
      return null;
  }
  if (minutes < 1 || minutes > 43200 * 13) return null;
  return minutes * 60 * 1000;
}
