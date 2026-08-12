export const DEFAULT_CUP_SOURCE = `這是 CheckUp Web Editor 範例；一般文字只供編輯者閱讀，不會渲染。

@version(2)
@title(消防設備月檢表)
@info(每月確認消防設備狀態，異常時通知設備主管。)

| $month(月份) | $text(設備編號)

@repeat(month)
| $day(日) | $time(時間) | $check(正常)
| $number(壓力\\, MPa) | $text(備註 A\\|B)

| $date(填表日期)
`;
