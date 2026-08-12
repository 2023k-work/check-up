# Codex 任務指令：產生 CheckUp GitHub README

## 任務目標

為 CheckUp `.cup` Format v2 GitHub repository 建立或更新根目錄的 `README.md`。

README 的主要讀者是：

- 第一次接觸 CheckUp 的使用者；
- 準備實作 parser、validator 或 renderer 的開發者；
- 想快速複製 `.cup` 範例的人。

README 應先讓讀者理解 CheckUp 是什麼、看到一份合法範例，再引導開發者閱讀正式規格。README 不是正式規格本身，不要把整份規格逐字複製進去。

## 必讀來源

開始撰寫前，必須完整閱讀：

1. `CHECKUP_FORMAT_V2.md` — v2 的唯一正式語法與 canonical/hash 參考。
2. `examples/equipment-monthly-v2.cup` — README 中 `.cup` 範例的合法寫法基準。
3. `examples/assets/pressure-guide.png` — 範例中 `@help` 引用的同資料夾樹資源。

若現有 `README.md` 已存在，也必須先閱讀並保留仍正確且有價值的內容。

## 資料可信度與衝突處理

- `CHECKUP_FORMAT_V2.md` 的優先級最高。
- 範例若與規格衝突，以規格為準，先修正或回報衝突，不要把衝突複製到 README。
- 不要依照記憶、Markdown 習慣、舊版 CheckUp 對話或 v1 語法補寫規則。
- 不要自行新增 directive、field、escape、資料列語法、Hash 標籤或封裝格式。
- 規格沒有確立的功能，標示為尚未定義或完全省略，不得猜測。

## README 使用語言與風格

- 主要語言使用繁體中文。
- 專有名詞首次出現時可附英文，例如「指令（Directive）」。
- 語氣簡潔、明確，適合 GitHub 首頁閱讀。
- 先說用途和價值，再談語法細節。
- 避免行銷式誇張、未實作承諾及未經證實的相容性宣稱。
- 所有連結使用 repository-relative path。

## README 必須包含的內容

### 1. 專案名稱與一句話定位

標題使用 `CheckUp Format`。

定位應忠實表達：CheckUp 是以純文字描述檢查表的 `.cup` 格式；以表格安排版面、`@` 控制行為、`$` 宣告可填欄位，一般文字作為不渲染註解。

### 2. 核心特色

以短列表說明：

- 純文字、適合閱讀與版本控制；
- `@` Directive 與 `$` Field 分離；
- 表格語法極簡，不使用 Markdown 分隔列；
- 支援月度重複表格、說明圖片、照片與簽名資源；
- 定義可重現的 canonical SHA-256 計算規則。

不要聲稱尚未存在的官方 parser、CLI、套件或編輯器已經完成。

### 3. Quick Start

從 `examples/equipment-monthly-v2.cup` 擷取一段短而完整的合法範例。範例至少展示：

```cup
@version(2)
@title(...)
@info(...)

| $month(...) | $text(...)

@repeat(month)
| $day(...) | $time(...)
| $check(...)
```

程式碼區塊語言標記使用 `cup`。不得加入：

```text
| --- | ---
```

不得在表格宣告列末尾增加 `|`，也不得建立 `| 日期 | $date(日期)` 之類額外標籤欄。

### 4. 語法概覽

簡短解釋：

- `@version(2)`、`@title(...)`、`@info(...)`、`@repeat(month)`、`@help(text,path.png)`；
- `$date`、`$month`、`$day`、`$time`、`$check`、`$text`、`$number`、`$photo`、`$signature`；
- 一般文字完全不渲染；
- 表格列以 `|` 開始，多欄以未跳脫的 `|` 分隔，結尾不需要 `|`；
- `@repeat(month)` 只作用於下一個表格，月份取自第一個 `$month`；
- `@help` 的第二參數是可選說明圖片路徑，不是 `$photo` 的使用者資料。

可以用小型表格整理 directive 與 field，但 README 中的 Markdown 說明表格不得被誤稱為 `.cup` 語法。

### 5. Escape

只列出 frozen v2 escape：

```text
\@  \(  \)  \,  \|  \\
```

必須說明反斜線只跳脫緊接著的格式字元。不加入 `\$`、`\n`、`\t` 或 Unicode escape。

### 6. 資源引用

說明 `$photo`、`$signature` 與 `@help` 圖片使用相對於 `.cup` 文件的資源路徑，資源必須留在同一文件資料夾樹中。連結合法範例與圖片：

- `[完整 v2 範例](examples/equipment-monthly-v2.cup)`
- `[範例說明圖片](examples/assets/pressure-guide.png)`

不得示範絕對路徑或 `../`。

### 7. Canonical / Hash 摘要

只做高層摘要並連回正式規格：

- canonical profile 固定首行是 `checkup-hash-v1`；
- Hash 使用解析、反跳脫並正規化後的資料，不直接 Hash 原始 `.cup` 位元組；
- 編碼為 UTF-8、Unicode NFC、LF，再計算 SHA-256；
- 照片及簽名使用資源內容 SHA-256，不把路徑放入 canonical data；
- 檔名、儲存位置、註解以及顯示用途的 title/info/help 不參與資料 Hash；
- v2 沒有 `$sha256` 或 `@sha256` 語法。

不要在 README 重新發明不同 canonical serialization。詳細規則一律連到 `[CheckUp Format v2 specification](CHECKUP_FORMAT_V2.md)`。

### 8. 實作導引

用一小段流程表示：

```text
.cup source → Parser → Validated model / AST → Renderer
                                   └──────────→ Canonical hash
```

提醒實作者依序處理 escape、結構分類、directive 綁定、驗證、渲染與 Hash。詳細 AST 與驗證順序連回規格文件。

### 9. 文件連結

至少提供：

- `[Format v2 specification](CHECKUP_FORMAT_V2.md)`
- `[Valid v2 example](examples/equipment-monthly-v2.cup)`

若 repository 中尚無 LICENSE、CONTRIBUTING 或其他文件，不得建立失效連結，也不得虛構授權內容。

## 嚴格禁止事項

README 不得：

- 使用 v1 的 `@date`、`@check`、`@sign`、`@repeatMonth` 或 `@sha256`；
- 把可填欄位寫成 `@` 指令；
- 使用 Markdown 的 `.cup` 表格分隔列；
- 在 `.cup` 表格列尾補上 `|`；
- 增加純文字標籤欄；
- 把一般文字渲染成段落或標題；
- 把 `@help` 圖片當成 `$photo` 填寫結果；
- 宣稱資源路徑會參與 canonical hash；
- 加入規格未列出的 escape；
- 把 README 內的 Markdown 排版規則誤寫成 `.cup` 語法規則。

## 執行步驟

1. 檢查工作區及既有 `README.md`。
2. 完整閱讀三份必讀來源。
3. 從正式規格列出 README 所需事實，不直接憑記憶撰寫。
4. 建立或更新根目錄 `README.md`。
5. 逐一比對 README 內所有 `.cup` code block 與合法範例。
6. 檢查所有 repository-relative links 是否指向真實檔案。
7. 搜尋並移除 v1 名稱、Markdown 分隔列、尾端 `|`、額外標籤欄及未定義語法。
8. 回報建立或修改的檔案，以及任何無法由目前規格確認的事項。

## 完成條件

只有同時符合下列條件才算完成：

- 根目錄存在可閱讀的 `README.md`；
- 所有 `.cup` 範例符合 v2；
- README 清楚區分 `@`、`$` 與不渲染註解；
- README 沒有 Markdown 表格語法污染 `.cup` 範例；
- repeat、help、escape、資源與 canonical/hash 摘要皆與規格一致；
- 文件連結有效；
- 未虛構尚不存在的功能、檔案或工具。

## 可直接交給 Codex 的簡短任務提示

```text
請在此 repository 建立或更新根目錄 README.md。開始前完整閱讀
CODEX_README_INSTRUCTIONS.md、CHECKUP_FORMAT_V2.md、
examples/equipment-monthly-v2.cup 與 examples/assets/pressure-guide.png，
並嚴格以 CHECKUP_FORMAT_V2.md 為最高優先規格來源。

README 使用繁體中文，面向首次使用者與 parser/validator/renderer 實作者，
包含專案定位、核心特色、合法 Quick Start、語法概覽、escape、資源引用、
canonical/hash 摘要、實作流程及規格／範例連結。不要新增規格未確立的語法，
不要使用 v1 寫法、Markdown 表格分隔列、表格尾端 | 或額外標籤欄。

完成後核對所有 .cup code block 與 repository-relative links，並簡短回報結果。
```
