import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App parser integration", () => {
  it("parses edits, displays diagnostics and keeps the last valid preview", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "消防設備月檢表" })).toBeTruthy();
    const editor = screen.getByLabelText(".cup 原始碼");
    fireEvent.change(editor, { target: { value: "@version(2)\n| 日期 | $date(日期)" } });

    expect(screen.getByText("CUP010")).toBeTruthy();
    expect(screen.getByText(/L2:C3/)).toBeTruthy();
    expect(screen.getByText(/預覽保留最近一次成功解析的文件/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "消防設備月檢表" })).toBeTruthy();
  });

  it("shows the parser document in the debug tab", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: "Parsed Output" }));
    expect(screen.getByLabelText("Parser JSON 輸出").textContent).toContain('"version": 2');
    expect(screen.getByLabelText("Parser JSON 輸出").textContent).toContain('"kind": "table"');
  });
});
