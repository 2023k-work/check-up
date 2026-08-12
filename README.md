# CheckUp Format

CheckUp 是以純文字描述檢查表的 `.cup` 格式：用極簡表格安排版面、以 `@` 指令（Directive）控制行為、以 `$` 欄位（Field）宣告可填內容；其餘一般文字只供原始檔讀者參考，不會渲染。

## 核心特色

- 純文字格式，方便閱讀、審查與版本控制。
- `@` Directive 與 `$` Field 分離，行為和使用者資料界線清楚。
- 表格語法極簡，不使用 Markdown 分隔列。
- 支援月度重複表格、說明圖片，以及照片與簽名資源。
- 定義可重現的 canonical SHA-256 計算規則。

## Quick Start

以下是取自[完整 v2 範例](examples/equipment-monthly-v2.cup)的合法 `.cup` 片段：

```cup
@version(2)
@title(空壓機月度巡檢表)
@info(每日開機前完成巡檢，異常時通知設備主管。)

| $month(巡檢月份) | $text(設備編號)

@repeat(month)
| $day(日) | $time(時間)
| $check(壓力正常) | $text(備註)
```

儲存為 UTF-8 編碼的 `.cup` 檔案。一般文字可以留給編輯者作註解，但 renderer 不會顯示它。

## 語法概覽

`@` 指令控制文件或渲染行為，不儲存使用者輸入：

- `@version(2)`：宣告格式版本，必須是第一個有意義的結構且恰好出現一次。
- `@title(text)`：設定可見的文件標題。
- `@info(text)`：加入可見的文件說明。
- `@repeat(month)`：只套用到來源順序中的下一個表格；月份取自文件的第一個 `$month(...)` 欄位。
- `@help(text,path.png)`：為下一個可渲染欄位或表格附加說明；第二個圖片路徑參數可省略。該圖片是說明內容，不是 `$photo` 的使用者資料。

`$` 欄位宣告可渲染、可填寫的值，每個欄位使用 `$type(label)` 並自帶顯示標籤。v2 支援：

- `$date`、`$month`、`$day`、`$time`
- `$check`、`$text`、`$number`
- `$photo`、`$signature`

表格宣告列以未跳脫的 `|` 開始，多欄以未跳脫的 `|` 分隔，列尾不需要 `|`。每個儲存格必須恰好包含一個欄位；不要加入 Markdown 分隔列或額外的純文字標籤欄。表格以外的一般文字是完全不渲染的註解。

## Escape

v2 僅定義以下 escape：

```text
\@  \(  \)  \,  \|  \\
```

反斜線只跳脫緊接著的格式字元；不支援跳脫錢號、換行、定位字元或 Unicode escape。

## 資源引用

`$photo`、`$signature` 與 `@help` 的圖片路徑都相對於 `.cup` 文件。路徑使用 `/`，資源必須留在同一份文件的資料夾樹內；絕對路徑與 `../` 路徑穿越均無效。

- [完整 v2 範例](examples/equipment-monthly-v2.cup)
- [範例說明圖片](examples/assets/pressure-guide.png)

## Canonical / Hash

Canonical hash profile 的固定首行是 `checkup-hash-v1`。Hash 使用解析、反跳脫並正規化後的記錄資料，而不是直接對原始 `.cup` 位元組計算；canonical data 經 Unicode NFC 正規化，以 LF 連接並編碼為不含 BOM 的 UTF-8，最後計算 SHA-256。

照片與簽名納入的是資源內容的 SHA-256，資源路徑本身不進入 canonical data。檔名、儲存位置、註解，以及只供顯示的 title、info、help 也不參與資料 Hash。v2 沒有 `$sha256` 欄位或 `@sha256` 指令；完整序列化與驗證規則請以 [CheckUp Format v2 specification](CHECKUP_FORMAT_V2.md) 為準。

## 實作導引

```text
.cup source → Parser → Validated model / AST → Renderer
                                   └──────────→ Canonical hash
```

實作者應依序處理 escape、結構分類、directive 綁定、驗證、渲染與 Hash。詳細 AST、驗證順序及 canonical serialization 請參閱正式規格。

### Parser library

Repository 內含以 strict TypeScript 實作的 ESM v2 Parser。核心套件只接受字串且不依賴 DOM、Node filesystem 或其他 Node-only runtime API，因此可由 Node.js 與未來的 Web Editor／Renderer 共用：

```typescript
import { parseCup, type CupDocument } from "@checkup/parser";

const result = parseCup(source);

const document: CupDocument = result.document;
const diagnostics = result.diagnostics;
```

即使 `success` 為 `false`，`document` 仍會盡可能保留可解析的節點，供編輯器顯示部分結果。主要 public API 由 [`src/index.ts`](src/index.ts) 匯出；Parser、AST、diagnostics 與測試分別位於 [`src/parser`](src/parser)、[`src/ast`](src/ast)、[`src/diagnostics`](src/diagnostics) 與 [`tests`](tests)。

```sh
npm install
npm run typecheck
npm test
npm run build
```

先前用於移植比對的 .NET reference implementation 保留在 [`legacy/dotnet`](legacy/dotnet)，不再是主要實作。

### Web Editor MVP

[`apps/web-editor`](apps/web-editor) 是 React + Vite 的最小整合編輯器。它以 `import { parseCup } from "@checkup/parser"` 呼叫 Parser，並只將回傳的 `CupDocument` 傳給 Preview；Web Editor 不包含第二套 `.cup` 語法或 directive 關聯邏輯。

```sh
cd apps/web-editor
npm install
npm run dev
```

Editor 提供即時 diagnostics、可定位的 line／column／range、Parsed Output JSON，以及從 AST 渲染 title、info、table 和基礎欄位的 Preview。根目錄也提供 `npm run dev:web`、`npm run typecheck:web` 與 `npm run build:web` 快捷指令。

## 文件

- [Format v2 specification](CHECKUP_FORMAT_V2.md)
- [Valid v2 example](examples/equipment-monthly-v2.cup)
- [License](LICENSE)
