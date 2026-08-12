import { parseCup } from "@checkup/parser";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckUpPreview } from "./CheckUpPreview.js";

describe("CheckUpPreview", () => {
  it("renders title, info, table and supported fields from CupDocument", () => {
    const result = parseCup(`@version(2)
@title(測試巡檢表)
@info(只讀取 parser document)
| $date(日期) | $month(月份)
| $day(日) | $time(時間)
| $check(正常) | $text(備註)
| $number(壓力)`);

    render(<CheckUpPreview document={result.document} />);

    expect(screen.getByRole("heading", { name: "測試巡檢表" })).toBeTruthy();
    expect(screen.getByText("只讀取 parser document")).toBeTruthy();
    expect(screen.getByLabelText("日期").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("月份").getAttribute("type")).toBe("month");
    expect(screen.getByLabelText("日").getAttribute("type")).toBe("number");
    expect(screen.getByLabelText("時間").getAttribute("type")).toBe("time");
    expect(screen.getByLabelText("正常").getAttribute("type")).toBe("checkbox");
    expect(screen.getByLabelText("備註").getAttribute("type")).toBe("text");
    expect(screen.getByLabelText("壓力").getAttribute("type")).toBe("number");
  });
});
