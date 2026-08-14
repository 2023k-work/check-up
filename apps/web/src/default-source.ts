export const defaultSource = `@version(2)
@title(消防設備月檢表)
@info(每月確認消防設備狀態)

$month(月份)

@repeat(month)
@help(逐欄確認設備狀態)
| $day(日) | $time(時間) | $check(正常)

@help(請記錄異常狀況)
$text(備註)

$photo(現場照片)

$signature(檢查人員)`;
