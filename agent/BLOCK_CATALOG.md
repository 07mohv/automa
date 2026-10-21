# Automa block catalog

Generated from `src/utils/shared.js`. Do not edit by hand.
Regenerate with `pnpm agent:schema`.

Block parameters live on `drawflow.nodes[].data`.
Connect blocks with `sourceHandle: "{sourceId}-output-1"` and `targetHandle: "{targetId}-input-1"` unless a block documents another handle.
Templated fields accept `{{variables@name}}`, `{{globalData@key}}`, `{{loopData@loopId}}`, and `{{table@column}}`.

## Web interaction

### `event-click`

Click element

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default ""; templated
  - `markEl` (boolean) — default false
  - `multiple` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `get-text`

Get text from an element

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`, `variableName`, `prefixText`, `suffixText`, `extraRowValue`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default ""; templated
  - `markEl` (boolean) — default false
  - `multiple` (boolean) — default false
  - `regex` (string) — default ""
  - `prefixText` (string) — default ""; templated
  - `suffixText` (string) — default ""; templated
  - `regexExp` (array)
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default true
  - `includeTags` (boolean) — default false
  - `addExtraRow` (boolean) — default false
  - `assignVariable` (boolean) — default false
  - `useTextContent` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `extraRowValue` (string) — default ""; templated
  - `extraRowDataColumn` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `element-scroll`

Scroll element

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default "html"; templated
  - `markEl` (boolean) — default false
  - `multiple` (boolean) — default false
  - `scrollY` (number) — default 0
  - `scrollX` (number) — default 0
  - `incX` (boolean) — default false
  - `incY` (boolean) — default false
  - `smooth` (boolean) — default false
  - `scrollIntoView` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `link`

Open link element

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default ""; templated
  - `markEl` (boolean) — default false
  - `disableMultiple` (boolean) — default true
  - `openInNewTab` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `attribute-value`

Get attribute value of an element

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`, `variableName`, `attributeName`, `extraRowValue`, `attributeValue`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default ""; templated
  - `markEl` (boolean) — default false
  - `multiple` (boolean) — default false
  - `attributeValue` (string) — default ""; templated
  - `attributeName` (string) — default ""; templated
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default true
  - `action` (string) — default "get"
  - `addExtraRow` (boolean) — default false
  - `extraRowValue` (string) — default ""; templated
  - `extraRowDataColumn` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `forms`

Manipulate form(input, select, checkbox, and radio) element

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`, `variableName`, `value`, `optionPosition`, `delay`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default ""; templated
  - `markEl` (boolean) — default false
  - `multiple` (boolean) — default false
  - `selected` (boolean) — default true
  - `clearValue` (boolean) — default true
  - `getValue` (boolean) — default false
  - `saveData` (boolean) — default false
  - `dataColumn` (string) — default ""
  - `selectOptionBy` (string) — one of value, custom-position; default "value"
  - `optionPosition` (string) — default "1"; templated
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `type` (string) — one of text-field, select, checkbox, radio; default "text-field"
  - `value` (string) — default ""; templated
  - `delay` (number) — default 0; templated
  - `events` (array)
  - `onError` (object)
  - `settings` (object)

### `javascript-code`

Execute your custom javascript code in a webpage

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `timeout` (number) — default 20000
  - `context` (string) — one of website, background; default "website"
  - `code` (string) — default "console.log(\"Hello world!\");\nautomaNextBlock()"
  - `preloadScripts` (array)
  - `everyNewTab` (boolean) — default false
  - `runBeforeLoad` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `trigger-event`

Trigger event

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`, `eventParams.clientX`, `eventParams.clientY`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default "html"; templated
  - `markEl` (boolean) — default false
  - `multiple` (boolean) — default false
  - `eventName` (string) — default ""
  - `eventType` (string) — default ""
  - `eventParams` (object) — templated
  - `onError` (object)
  - `settings` (object)

### `switch-to`

Switch between main window and iframe

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `selector` (string) — default ""; templated
  - `windowType` (string) — default "main-window"
  - `onError` (object)
  - `settings` (object)

### `upload-file`

Upload file into <input type="file"> element

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`, `filePaths`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default ""; templated
  - `filePaths` (array) — templated
  - `onError` (object)
  - `settings` (object)

### `hover-element`

Hover over an element

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default ""; templated
  - `markEl` (boolean) — default false
  - `multiple` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `save-assets`

Save assets (image, video, audio, or file) from an element or URL

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`, `url`, `filename`, `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default ""; templated
  - `markEl` (boolean) — default false
  - `multiple` (boolean) — default false
  - `type` (string) — default "element"
  - `url` (string) — default ""; templated
  - `filename` (string) — default ""; templated
  - `saveDownloadIds` (boolean) — default false
  - `onConflict` (string) — default "uniquify"
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default true
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `saveToGDrive` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `press-key`

Press a key or a combination

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `selector`, `keys`, `keysToPress`, `pressTime`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `keys` (string) — default ""; templated
  - `selector` (string) — default ""; templated
  - `pressTime` (string) — default "0"; templated
  - `description` (string) — default ""
  - `keysToPress` (string) — default ""; templated
  - `action` (string) — default "press-key"
  - `onError` (object)
  - `settings` (object)

### `create-element`

Create an element and insert it into the page

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `html`, `css`, `selector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `javascript` (string) — default ""
  - `html` (string) — default ""; templated
  - `css` (string) — default ""; templated
  - `preloadScripts` (array)
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `insertAt` (string) — default "after"
  - `runBeforeLoad` (boolean) — default false
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `selector` (string) — default "body"; templated
  - `onError` (object)
  - `settings` (object)

## Browser

### `active-tab`

Set current tab that you're in as an active tab

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `new-tab`

Create a new tab

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `url`, `userAgent`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `url` (string) — default ""; templated
  - `userAgent` (string) — default ""; templated
  - `active` (boolean) — default true
  - `tabZoom` (number) — default 1
  - `inGroup` (boolean) — default false
  - `waitTabLoaded` (boolean) — default false
  - `updatePrevTab` (boolean) — default false
  - `customUserAgent` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `switch-tab`

Switch active tab

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `url`, `matchPattern`, `tabTitle`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `url` (string) — default ""; templated
  - `tabIndex` (number) — default 0
  - `tabTitle` (string) — default ""; templated
  - `matchPattern` (string) — default ""; templated
  - `activeTab` (boolean) — default true
  - `createIfNoMatch` (boolean) — default false
  - `findTabBy` (string) — one of match-patterns, tab-title, next-tab, prev-tab, tab-index; default "match-patterns"
  - `onError` (object)
  - `settings` (object)

### `new-window`

Create a new window

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `url`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `top` (number) — default 0
  - `left` (number) — default 0
  - `width` (number) — default 0
  - `url` (string) — default ""; templated
  - `height` (number) — default 0
  - `type` (string) — one of normal, popup, panel; default "normal"
  - `incognito` (boolean) — default false
  - `windowState` (string) — one of normal, minimized, maximized, fullscreen; default "normal"
  - `onError` (object)
  - `settings` (object)

### `proxy`

Set the proxy of the browser

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `host`, `port`, `scheme`
- Parameters:
  - `description` (string) — default ""
  - `disableBlock` (boolean) — default false
  - `scheme` (string) — default "https"; templated
  - `host` (string) — default ""; templated
  - `port` (number) — default 443; templated
  - `bypassList` (string) — default ""
  - `clearProxy` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `go-back`

Go back to the previous page

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `forward-page`

Go forward to the next page

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `close-tab`

Close tab/window

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `url`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `url` (string) — default ""; templated
  - `description` (string) — default ""
  - `activeTab` (boolean) — default true
  - `closeType` (string) — one of tab, window; default "tab"
  - `allWindows` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `take-screenshot`

Take a screenshot of current active tab

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `fileName`, `selector`, `variableName`
- Parameters:
  - `description` (string) — default ""
  - `disableBlock` (boolean) — default false
  - `fileName` (string) — default ""; templated
  - `ext` (string) — default "png"
  - `quality` (number) — default 100
  - `dataColumn` (string) — default ""
  - `variableName` (string) — default ""; templated
  - `selector` (string) — default ""; templated
  - `fullPage` (boolean) — default false
  - `saveToColumn` (boolean) — default false
  - `saveToComputer` (boolean) — default true
  - `assignVariable` (boolean) — default false
  - `captureActiveTab` (boolean) — default true
  - `onError` (object)
  - `settings` (object)

### `browser-event`

Wait until the selected event is triggered

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `timeout` (number) — default 10000
  - `eventName` (string) — default "tab:loaded"
  - `setAsActiveTab` (boolean) — default true
  - `activeTabLoaded` (boolean) — default true
  - `tabLoadedUrl` (string) — default ""
  - `tabUrl` (string) — default ""
  - `fileQuery` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `handle-dialog`

Accepts or dismisses a JavaScript initiated dialog (alert, confirm, prompt, or onbeforeunload).

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `promptText`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `accept` (boolean) — default true
  - `promptText` (string) — default ""; templated
  - `onError` (object)
  - `settings` (object)

### `handle-download`

Handle downloaded file

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `filename`, `downloadId`, `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `filename` (string) — default ""; templated
  - `timeout` (number) — default 20000
  - `onConflict` (string) — default "uniquify"
  - `waitForDownload` (boolean) — default true
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default true
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `downloadId` (string) — default ""; templated
  - `onError` (object)
  - `settings` (object)

### `reload-tab`

Reload the active tab

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `tab-url`

Get the tab URL

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `type` (string) — default "active-tab"
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default true
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `qTitle` (string) — default ""
  - `qMatchPatterns` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `cookie`

Get, set, or remove cookies

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `domain`, `expirationDate`, `path`, `sameSite`, `name`, `url`, `value`, `jsonCode`, `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `type` (string) — one of get, set, remove; default "get"
  - `jsonCode` (string) — default "{\n\n}"; templated
  - `useJson` (boolean) — default false
  - `getAll` (boolean) — default false
  - `domain` (string) — default ""; templated
  - `expirationDate` (string) — default ""; templated
  - `path` (string) — default ""; templated
  - `sameSite` (string) — default ""; templated
  - `name` (string) — default ""; templated
  - `url` (string) — default ""; templated
  - `value` (string) — default ""; templated
  - `httpOnly` (boolean) — default false
  - `secure` (boolean) — default false
  - `session` (boolean) — default false
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `saveData` (boolean) — default true
  - `dataColumn` (string) — default ""
  - `onError` (object)
  - `settings` (object)

## General

### `trigger`

Block where workflow will start executing

- Component: `BlockBasic`
- Handles: inputs `(none)`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `url`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `type` (string) — one of manual, interval, cron-job, date, context-menu, element-change, specific-day, visit-web, on-startup, keyboard-shortcut; default "manual"
  - `interval` (number) — default 60
  - `delay` (number) — default 5
  - `date` (string) — default ""
  - `time` (string) — default "00:00"
  - `url` (string) — default ""; templated
  - `shortcut` (string) — default ""
  - `activeInInput` (boolean) — default false
  - `isUrlRegex` (boolean) — default false
  - `days` (array)
  - `contextMenuName` (string) — default ""
  - `contextTypes` (array)
  - `parameters` (array)
  - `preferParamsInTab` (boolean) — default false
  - `observeElement` (object)

### `ai-workflow`

A workflow that is created by AI-Power

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `flowUuid` (string) — default ""
  - `flowLabel` (string) — default ""
  - `description` (string) — default ""
  - `inputs` (array)
  - `outputs` (array)
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""
  - `saveData` (boolean) — default false
  - `dataColumn` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `execute-workflow`

Execute workflow

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `globalData`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `executeId` (string) — default ""
  - `workflowId` (string) — default ""
  - `globalData` (string) — default ""; templated
  - `description` (string) — default ""
  - `insertAllVars` (boolean) — default false
  - `insertAllGlobalData` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `delay`

Add delay before executing the next block

- Component: `BlockDelay`
- Handles: inputs `input-1`, outputs `output-1`
- Templated fields: `time`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `time` (number) — default 500; templated

### `export-data`

Export data

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `name`, `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `name` (string) — default ""; templated
  - `refKey` (string) — default ""
  - `type` (string) — one of json, csv, plain-text; default "json"
  - `description` (string) — default ""
  - `variableName` (string) — default ""; templated
  - `csvDelimiter` (string) — default ","
  - `addBOMHeader` (boolean) — default true
  - `onConflict` (string) — one of uniquify, overwrite, prompt; default "uniquify"
  - `dataToExport` (string) — one of data-columns, variable, google-sheets; default "data-columns"
  - `onError` (object)
  - `settings` (object)

### `webhook`

make an HTTP request

- Component: `BlockBasicWithFallback`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback`
- output-1 is the success path. output-fallback runs when the request fails.
- Templated fields: `body`, `url`, `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `url` (string) — default ""; templated
  - `body` (string) — default "{}"; templated
  - `headers` (array)
  - `method` (string) — one of GET, POST, PUT, PATCH, DELETE, HEAD; default "POST"
  - `timeout` (number) — default 10000
  - `dataPath` (string) — default ""
  - `contentType` (string) — one of text, json, form-data, form; default "json"
  - `variableName` (string) — default ""; templated
  - `assignVariable` (boolean) — default false
  - `saveData` (boolean) — default false
  - `dataColumn` (string) — default ""
  - `responseType` (string) — one of json, text, base64; default "json"

### `blocks-group`

Grouping blocks

- Component: `BlockGroup`
- Handles: inputs `input-1`, outputs `output-1`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `name` (string) — default ""
  - `blocks` (array)

### `clipboard`

Get the copied text from the clipboard

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `dataToCopy`, `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `type` (string) — one of get, insert; default "get"
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `saveData` (boolean) — default true
  - `dataColumn` (string) — default ""
  - `dataToCopy` (string) — default ""; templated
  - `copySelectedText` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

### `wait-connections`

Wait for all connections before continuing to the next block

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `timeout` (number) — default 10000
  - `specificFlow` (boolean) — default false
  - `flowBlockId` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `notification`

Display a notification

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `message`, `title`, `iconUrl`, `imageUrl`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `message` (string) — default ""; templated
  - `iconUrl` (string) — default ""; templated
  - `imageUrl` (string) — default ""; templated
  - `title` (string) — default "Hello world!"; templated
  - `onError` (object)
  - `settings` (object)

### `note`

Note

- Component: `BlockNote`
- Handles: inputs `input-1`, outputs `output-1`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `note` (string) — default ""
  - `drawing` (boolean) — default false
  - `width` (number) — default 280
  - `height` (number) — default 168
  - `color` (string) — default "white"
  - `fontSize` (string) — default "regular"

### `workflow-state`

Manage workflows states

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `errorMessage`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `type` (string) — one of stop-current, stop-all, stop-specific; default "stop-current"
  - `exceptCurrent` (boolean) — default false
  - `workflowsToStop` (array)
  - `throwError` (boolean) — default false
  - `errorMessage` (string) — default ""; templated
  - `onError` (object)
  - `settings` (object)

### `parameter-prompt`

Parameter prompt

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `timeout` (number) — default 60000
  - `parameters` (array)
  - `onError` (object)
  - `settings` (object)

## Online services

### `google-sheets`

Read Google Sheets data

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `customData`, `range`, `spreadsheetId`, `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `range` (string) — default ""; templated
  - `refKey` (string) — default ""
  - `type` (string) — default "get"
  - `customData` (string) — default ""; templated
  - `description` (string) — default ""
  - `spreadsheetId` (string) — default ""; templated
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default true
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `firstRowAsKey` (boolean) — default false
  - `keysAsFirstRow` (boolean) — default true
  - `valueInputOption` (string) — default "RAW"
  - `InsertDataOption` (string) — default "INSERT_ROWS"
  - `dataFrom` (string) — default "data-columns"
  - `onError` (object)
  - `settings` (object)

### `google-sheets-drive`

Read Google Sheets data

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `customData`, `range`, `spreadsheetId`, `sheetName`, `variableName`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `range` (string) — default ""; templated
  - `refKey` (string) — default ""
  - `type` (string) — default "get"
  - `customData` (string) — default ""; templated
  - `description` (string) — default ""
  - `spreadsheetId` (string) — default ""; templated
  - `dataColumn` (string) — default ""
  - `inputSpreadsheetId` (string) — default "connected"
  - `saveData` (boolean) — default true
  - `sheetName` (string) — default ""; templated
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""; templated
  - `firstRowAsKey` (boolean) — default false
  - `keysAsFirstRow` (boolean) — default true
  - `valueInputOption` (string) — default "RAW"
  - `InsertDataOption` (string) — default "INSERT_ROWS"
  - `dataFrom` (string) — default "data-columns"
  - `onError` (object)
  - `settings` (object)

### `google-drive`

Upload files to Google Drive

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `action` (string) — default "upload"
  - `filePaths` (array)
  - `onError` (object)
  - `settings` (object)

## Data

### `insert-data`

Insert data into table or variable

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `dataList` (array)
  - `onError` (object)
  - `settings` (object)

### `delete-data`

Delete table or variable data

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `deleteList` (array)
  - `onError` (object)
  - `settings` (object)

### `log-data`

Get the latest log data of a workflow

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `workflowId` (string) — default ""
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default true
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `slice-variable`

Extracts a section of a variable value

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `endIdxEnabled` (boolean) — default false
  - `startIdxEnabled` (boolean) — default true
  - `endIndex` (number) — default 0
  - `startIndex` (number) — default 0
  - `variableName` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `increase-variable`

Increase the value of a variable by specific amount

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `increaseBy` (number) — default 1
  - `variableName` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `regex-variable`

Matching a variable value against a regular expression

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `replaceVal`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `method` (string) — default "match"
  - `replaceVal` (string) — default ""; templated
  - `description` (string) — default ""
  - `expression` (string) — default ""
  - `flag` (array)
  - `onError` (object)
  - `settings` (object)

### `data-mapping`

Map data of a variable or table

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `dataSource` (string) — default "table"
  - `sources` (array)
  - `varSourceName` (string) — default ""
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default false
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""
  - `onError` (object)
  - `settings` (object)

### `sort-data`

Sort the items of data

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `sortByProperty` (boolean) — default false
  - `itemProperties` (array)
  - `dataSource` (string) — default "table"
  - `varSourceName` (string) — default ""
  - `dataColumn` (string) — default ""
  - `saveData` (boolean) — default false
  - `assignVariable` (boolean) — default false
  - `variableName` (string) — default ""
  - `onError` (object)
  - `settings` (object)

## Control flow

### `repeat-task`

Repeat task

- Component: `BlockRepeatTask`
- Handles: inputs `input-1`, outputs `output-1`, `output-2`
- output-2 is the repeated branch. output-1 runs after the repetition finishes.
- Templated fields: `repeatFor`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `repeatFor` (string) — default "1"; templated
  - `onError` (object)
  - `settings` (object)

### `conditions`

Conditional block

- Component: `BlockConditions`
- Handles: inputs `input-1`, outputs `output-{condition.id}`, `output-fallback`
- Add one output per condition id (`output-{condition.id}`) and `output-fallback` when no condition matches.
- Parameters:
  - `description` (string) — default ""
  - `disableBlock` (boolean) — default false
  - `conditions` (array)
  - `retryConditions` (boolean) — default false
  - `retryCount` (number) — default 10
  - `retryTimeout` (number) — default 1000

### `element-exists`

Check if an element is exists

- Component: `BlockElementExists`
- Handles: inputs `input-1`, outputs `output-1`, `output-2`
- output-1 runs when the element exists. output-2 runs when it does not.
- Templated fields: `selector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `selector` (string) — default ""; templated
  - `tryCount` (number) — default 1
  - `timeout` (number) — default 500
  - `markEl` (boolean) — default false
  - `throwError` (boolean) — default false

### `while-loop`

Execute blocks while the condition is met

- Component: `BlockBasicWithFallback`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback`
- output-1 is the loop body. output-fallback runs when the condition is no longer met.
- Parameters:
  - `disableBlock` (boolean) — default false
  - `description` (string) — default ""
  - `conditions` (any)

### `loop-data`

Loop data

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `maxLoop`, `loopData`, `selector`, `startIndex`, `variableName`, `referenceKey`, `elementSelector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `loopId` (string) — default ""
  - `maxLoop` (number) — default 0; templated
  - `toNumber` (number) — default 10
  - `fromNumber` (number) — default 1
  - `startIndex` (number) — default 0; templated
  - `loopData` (string) — default "[]"; templated
  - `description` (string) — default ""
  - `variableName` (string) — default ""; templated
  - `referenceKey` (string) — default ""; templated
  - `reverseLoop` (boolean) — default false
  - `elementSelector` (string) — default ""; templated
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `resumeLastWorkflow` (boolean) — default false
  - `loopThrough` (string) — one of data-columns, numbers, google-sheets, variable, custom-data, elements; default "data-columns"
  - `onError` (object)
  - `settings` (object)

### `loop-elements`

Loop elements

- Component: `BlockBasic`
- Handles: inputs `input-1`, outputs `output-1`, `output-fallback (only when data.onError.enable and data.onError.toDo are "fallback")`
- Templated fields: `maxLoop`, `selector`, `variableName`, `elementSelector`, `actionElSelector`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `loopId` (string) — default ""
  - `selector` (string) — default ""; templated
  - `maxLoop` (string) — default "0"; templated
  - `description` (string) — default ""
  - `reverseLoop` (boolean) — default false
  - `actionElSelector` (string) — default ""; templated
  - `findBy` (string) — one of cssSelector, xpath; default "cssSelector"
  - `actionElMaxWaitTime` (number) — default 5
  - `actionPageMaxWaitTime` (number) — default 10
  - `loadMoreAction` (string) — default "none"
  - `scrollToBottom` (boolean) — default true
  - `waitForSelector` (boolean) — default false
  - `waitSelectorTimeout` (number) — default 5000
  - `onError` (object)
  - `settings` (object)

### `loop-breakpoint`

To tell where loop data must stop

- Component: `BlockLoopBreakpoint`
- Handles: inputs `input-1`, outputs `output-1`
- Parameters:
  - `disableBlock` (boolean) — default false
  - `loopId` (string) — default ""
  - `clearLoop` (boolean) — default false
  - `onError` (object)
  - `settings` (object)

## Packages

### `block-package`

Block package

- Component: `BlockPackage`
- Handles: inputs `input-1`, outputs `output-1`
- Parameters:
  - (none)

