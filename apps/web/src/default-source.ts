export const defaultSource = `@version(2)
@title(Monthly Fire Equipment Inspection)
@info(Check the condition of fire equipment each month)

| $month(Month)
| 2026-08

@repeat(month)
@help(Check the condition of each item)
| $day(Day) | $time(Time) | $check(In good condition)
| 1 | 09:00 | Yes
| 2 | 09:15 | No

@help(Record any issues)
| $text(Notes) | $photo(Site photo) | $signature(Inspector)
| Low pressure in the second-floor fire extinguisher | images/floor-2.png | Alex Chen`;
