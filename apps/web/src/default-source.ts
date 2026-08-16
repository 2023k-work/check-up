export const defaultSource = `@version(2)
@title(消防設備月檢表)
@info(每月確認消防設備狀態)

| $month(月份)
| 2026-08

@repeat(month)
@help(逐欄確認設備狀態)
| $day(日) | $time(時間) | $check(正常)
| 1 | 09:00 | 正常
| 2 | 09:15 | 異常

@help(請記錄異常狀況)
| $text(備註) | $photo(現場照片) | $signature(檢查人員)
| 2 樓滅火器壓力偏低 | images/floor-2.png | 王小明`;
