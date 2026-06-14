/** Financial year start = July 1. Returns the year the FY began. */
export function financialYear(date = new Date()): number {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
}
