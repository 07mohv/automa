# Automa for AI agents

Read this file first. It is the whole loop for building a workflow that runs, not just a file that parses.

Automa stores a workflow as JSON. The visual editor and the runner use that JSON, so you can create, validate, import, and run a workflow without opening the editor. Existing workflows keep working: unknown package blocks are warnings, extra editor fields are allowed, and legacy Drawflow files are still accepted.

Do not edit `agent/schema/workflow.schema.json`, `agent/BLOCK_CATALOG.md`, or `agent/examples/*.automa.json` by hand. Regenerate them from the block definitions:

```bash
pnpm agent:schema
pnpm agent:examples
```

## The loop

1. **Discover.** `node agent/cli.js blocks` or the `list_blocks` tool. Then `node agent/cli.js block <id>` or `get_block_schema` for every block you will use. The catalog at `agent/BLOCK_CATALOG.md` has the same parameters and output handles.
2. **Build.** Prefer `create_workflow` (CLI `--spec`, HTTP, or MCP). It fills block defaults, adds a manual trigger when you omit one, lays out positions, and names the handles. Copy a file in `agent/examples/` and change the URL, selectors, and variable names.
3. **Validate.** `node agent/cli.js validate workflow.json` or `validate_workflow`. `ok: false` means the graph or a required field is wrong. **Also clear every warning.** Warnings do not flip `ok` to false, because old workflows must still open, but a workflow you just generated is not done until `warnings` is `[]`. Each issue has `path`, `message`, and `fix`. Apply the `fix` text and validate again.
4. **Import.** Enable Settings → Agent bridge in Automa (off by default), copy the token, and start the bridge with that token. `import_workflow` stores the workflow. Structural errors are rejected unless you pass `force: true`. `strict: true` also rejects parameter errors.
5. **Run.** `run_workflow` with the returned `workflowId`. Pass `variables` and `globalData` when the workflow reads them. The parameter prompt is skipped unless `checkParams` is true.
6. **Read logs.** `get_run_logs`. A `running` entry exists while the run is in progress. Per-block `history` is written when the run finishes. `settings.saveLog` must stay true.
7. **Fix.** If a block failed, change the selector, the wait, or `data.onError`, validate until `warnings` is empty, and import again with `overwrite: true`.

## Three ways to call the same tools

Use whichever interface your runtime already has. The tool names and arguments match.

| Tool | Needs the extension | What it does |
| --- | --- | --- |
| `list_blocks` | no | Block ids, names, categories. Optional `category`. |
| `get_block_schema` | no | JSON Schema for one block. `blockId` is required. |
| `create_workflow` | no | Build editor JSON from a short spec and validate it. |
| `validate_workflow` | no | Errors and warnings. Pass `{ workflow }` or the workflow object itself. |
| `import_workflow` | yes | Store it. `overwrite` updates the same id. `strict` rejects parameter errors. `run` starts it. |
| `list_workflows` | yes | Workflows already stored in the browser. |
| `run_workflow` | yes | Run by `workflowId`. |
| `get_run_logs` | yes | Running states, and finished logs with block history. |
| `stop_workflow` | yes | Stop by `stateId` or `workflowId`. |
| `judge_selector` | no | Score a selector: `stable`, `ok`, or `fragile`. |
| `list_tabs` | yes | Tabs the extension can see. `inspectable` is false for internal pages. |
| `open_tab` | yes | Open an http(s) URL and wait for it to load. |
| `page_snapshot` | yes | Visible interactive elements, each with ranked selector candidates. |
| `test_selector` | yes | Match count, visibility, and sample text. `highlight` outlines matches. |
| `evaluate_in_tab` | yes | Run JavaScript in the tab and return the value. |
| `capture_screenshot` | yes | JPEG of the visible area. Prefer `page_snapshot` for selectors. |
| `preview_block` | yes | Run one block on the live page. Clicks and typing really happen. |
| `preview_workflow` | yes | Run a whole workflow once, return the log, then delete the copy. |

### CLI (no server, local tools only)

```bash
node agent/cli.js blocks --category interaction
node agent/cli.js block get-text
node agent/cli.js validate agent/examples/read-example-heading.automa.json
node agent/cli.js create --spec spec.json --out workflow.automa.json
node agent/cli.js normalize legacy.automa.json --out workflow.automa.json
node agent/cli.js selector 'input[name="custname"]'
```

`validate` exits 1 when `ok` is false. It still prints warnings when `ok` is true. Read them.

### HTTP (any language, no MCP)

Start the bridge once:

```bash
AUTOMA_AGENT_TOKEN="<token from Settings → Agent bridge>" AUTOMA_AGENT_PORT=17321 pnpm agent:mcp
```

Then POST JSON to `http://127.0.0.1:17321/automa/v1/rpc`. The server binds to loopback only. A wrong token is HTTP 401. A tool failure is HTTP 200 with `{ "ok": false, "error": "..." }`. A tool success is HTTP 200 with `{ "ok": true, "result": ... }`.

```bash
curl -s http://127.0.0.1:17321/automa/v1/rpc \
  -H 'content-type: application/json' \
  -H "x-automa-token: $AUTOMA_AGENT_TOKEN" \
  -d '{"method":"list_blocks","params":{"category":"interaction"}}'
```

`list_blocks`, `get_block_schema`, `create_workflow`, `validate_workflow`, and `judge_selector` work even when the extension is disconnected. Import, run, and the page tools return an error that tells you to enable Settings → Agent bridge.

The same call from the CLI, against that server:

```bash
node agent/cli.js rpc validate_workflow --file agent/examples/read-example-heading.automa.json
```

`GET /automa/v1/health` needs no token and reports `extensionConnected`.

### MCP

Point the client at `node agent/mcp-server.js` with `AUTOMA_AGENT_TOKEN` and `AUTOMA_AGENT_PORT`. The process speaks MCP over stdio (`Content-Length` frames, or one JSON object per line) and opens the same loopback HTTP server. Tool errors from validation are returned in the tool result (`isError: false`) so you can read `fix`. A missing extension or an unknown block is `isError: true`.

### Node

```javascript
const { handleTool } = require('./agent/tools');

const listed = await handleTool('list_blocks', { category: 'interaction' });
const built = await handleTool('create_workflow', spec);
const checked = await handleTool('validate_workflow', built.workflow);
```

Pass a bridge only for import and run. `pnpm agent:mcp` is that bridge.

## Workflow shape

```json
{
  "name": "Read example.com heading",
  "description": "",
  "version": "1.30.00",
  "globalData": "{}",
  "table": [],
  "settings": { "saveLog": true, "blockDelay": 0, "onError": "stop-workflow" },
  "drawflow": { "nodes": [], "edges": [], "zoom": 1 }
}
```

| Node field | Meaning |
| --- | --- |
| `id` | Unique string. Handles are built from it. |
| `label` | Block id, for example `new-tab` or `get-text`. In a create spec the field is `block`. |
| `type` | Vue component from the catalog, usually `BlockBasic`. `create_workflow` sets it. |
| `position` | `{ "x", "y" }` for the editor. The runner ignores it. |
| `data` | Block parameters. Start from the catalog defaults and override what you need. |

| Edge field | Meaning |
| --- | --- |
| `source`, `target` | Node ids |
| `sourceHandle` | `{source}-output-1` unless the catalog says otherwise |
| `targetHandle` | `{target}-input-1` |

In a create spec you can pass `sourceOutput` (`1`, `2`, or `"fallback"`) instead of `sourceHandle`.

The runner starts at the single `trigger` node. A node other than the trigger or a note, with no incoming edge, never runs (`unreachable-node`).

### Output handles that are not `output-1`

- `element-exists`: `output-1` when the element exists, `output-2` when it does not. Connect both.
- `repeat-task`: `output-2` is the repeated branch. `output-1` runs after the last repetition.
- `conditions`: `output-{condition.id}` for each condition, then `output-fallback`.
- `webhook` and `while-loop`: `output-1` on success, `output-fallback` on the other path.
- Other blocks grow an `output-fallback` handle only when `data.onError.enable` is true and `data.onError.toDo` is `"fallback"`.

### Templating

Fields marked templated in the catalog accept mustache tags:

- `{{variables@heading}}` — set with `assignVariable: true` and `variableName`
- `{{globalData@key}}` — a key in the `globalData` JSON string
- `{{loopData@loopId}}` — the current value of a `loop-data` or `loop-elements` block. For elements this value is a selector.
- `{{loopData@loopId.$index}}` — the current index
- `{{table@columnName}}` — a table cell

Prefix a string with `!!` to evaluate JavaScript instead of mustache, for example `!!variables.heading.toUpperCase()`.

`workflow.table` is an array of `{ "id", "name", "type" }`. `insert-data` and `get-text` `dataColumn` match the column `id` or `name`. `settings.insertDefaultColumn` defaults to false, so a column you forget to declare is dropped. Add the column to `table`.

## Build a good workflow

Copy the closest example, then change URLs, selectors, and names. Every example validates with zero warnings.

| Task | Blocks | Example |
| --- | --- | --- |
| Open a page and read one element | `trigger` → `new-tab` → `get-text` | `agent/examples/read-example-heading.automa.json` |
| Fill and submit a form | `new-tab` → `forms` → `event-click` | `agent/examples/fill-httpbin-form.automa.json` |
| Branch when an element is missing | `element-exists` output 1 and output 2 | `agent/examples/heading-or-fallback.automa.json` |
| Scrape a list of elements | `new-tab` → `loop-elements` → `get-text` → `loop-breakpoint` | `agent/examples/scrape-example-paragraphs.automa.json` |
| Loop over numbers, a variable, or table rows | `loop-data` → body → `loop-breakpoint` | `agent/examples/loop-numbers-to-table.automa.json` |
| Retry, then take another path | `data.onError.toDo = "fallback"` and `output-fallback` | `agent/examples/click-with-fallback.automa.json` |

### Waiting

- `new-tab` with a URL: `waitTabLoaded: true`.
- Any block that uses a selector (`event-click`, `get-text`, `forms`, `loop-elements`, and the other interaction blocks): `waitForSelector: true` and `waitSelectorTimeout: 5000`.
- `element-exists`: `tryCount` at least 3 and `timeout` at least 1500. Connect `output-2`.
- Do not insert a `delay` to wait for a page. Do not set `settings.blockDelay` above 0.

### Errors and retries

On every page or network block set:

```json
"onError": {
  "enable": true,
  "retry": true,
  "retryTimes": 2,
  "retryInterval": 1,
  "toDo": "error"
}
```

`retryInterval` is in seconds. Use `toDo: "fallback"` and connect `{id}-output-fallback` when the workflow should continue on another path after the retries. Use `toDo: "continue"` to follow the normal output after the retries fail. `element-exists`, `delay`, `webhook`, `while-loop`, and `conditions` do not use `onError`; they already have their own second output.

`settings.onError` is the workflow-level policy: `stop-workflow` (default), `keep-running`, or `restart-workflow`. Prefer block `onError` so one failure does not discard the rest of the run without a decision.

### Loops

`loop-data` and `loop-elements` go out of `output-1` into the body. The body ends at a `loop-breakpoint` with the **same** `loopId`. The breakpoint jumps back until the data is exhausted, then follows its own `output-1`. Without that breakpoint the body runs once.

`loop-data` `loopThrough`: `numbers` (`fromNumber`, `toNumber`), `variable` (`variableName`), `custom-data` (`loopData` is a JSON array string), `data-columns`, `google-sheets`, or `elements`.

`loop-elements` marks each match and the current `{{loopData@loopId}}` is a selector. The `get-text` or `event-click` inside the body must use that selector, not the original list selector.

Give every loop a short `loopId` (`"items"`, `"rows"`). An empty `loopId` cannot be targeted.

### Variables and tables

- One value you will reuse: `assignVariable: true`, `variableName`, and `saveData: false` on `get-text`. Read it later as `{{variables@name}}`. `insert-data` with `dataList: [{ "type": "variable", "name": "result", "value": "clicked" }]` sets a variable too.
- Many rows: declare `workflow.table`, set `saveData: true` and `dataColumn` to the column id, or use `insert-data` with `"type": "table"`.
- `globalData` is a JSON **string**. `create_workflow` stringifies an object for you.

### Triggers

One `trigger` per workflow. `data.type`:

| type | Also set |
| --- | --- |
| `manual` | Nothing else. Use this unless a schedule was requested. |
| `interval` | `interval` (minutes) |
| `cron-job` | `expression` (cron) |
| `date` | `date` and `time` |
| `specific-day` | The day fields from the trigger schema |
| `visit-web` | `url` match pattern |
| `context-menu` | `contextMenuName` |
| `keyboard-shortcut` | `shortcut` |
| `element-change` | The selector the trigger watches |
| `on-startup` | Nothing else |

Several triggers can live in `data.triggers[]` instead of `data.type`. Import registers triggers other than manual.

### Selectors

Prefer a selector a person would still recognize after a redesign:

- `input[name="custname"]`, `button[type="submit"]`, `a[href="https://www.iana.org/domains/example"]`
- `[aria-label="Search"]`, `[data-testid="submit"]`
- a short id that is written by hand, such as `#login`

Avoid:

- `*`, `html`, `body`
- chains of `:nth-child` or `:nth-of-type`
- paths that start at `html` or `body` and walk `div` elements
- generated ids and classes (`ember123`, `react-select`, `css-1ab2c`, CSS-module hashes, `sc-` classes)
- XPath with several `[1]` indexes
- a selector copied from the devtools "Copy selector" action when a name or href exists

Skip the linter for a selector that contains `{{`, because `{{loopData@items}}` is supposed to be the current loop selector.

`findBy` is `cssSelector` (default) or `xpath`.

## Patterns to copy

Open, wait, read into a variable:

```json
{
  "name": "Read example.com heading",
  "nodes": [
    { "id": "trigger", "block": "trigger", "data": { "type": "manual" } },
    {
      "id": "open",
      "block": "new-tab",
      "data": {
        "url": "https://example.com",
        "waitTabLoaded": true,
        "onError": { "enable": true, "retry": true, "retryTimes": 2, "retryInterval": 1, "toDo": "error" }
      }
    },
    {
      "id": "read",
      "block": "get-text",
      "data": {
        "selector": "h1",
        "waitForSelector": true,
        "waitSelectorTimeout": 5000,
        "assignVariable": true,
        "variableName": "heading",
        "saveData": false,
        "onError": { "enable": true, "retry": true, "retryTimes": 2, "retryInterval": 1, "toDo": "error" }
      }
    }
  ],
  "edges": [
    { "source": "trigger", "target": "open" },
    { "source": "open", "target": "read" }
  ]
}
```

`create_workflow` turns that spec into the editor graph. The checked-in file is `agent/examples/read-example-heading.automa.json`.

Scrape: `loop-elements` selector `p`, `loopId` `paragraphs`, then `get-text` selector `{{loopData@paragraphs}}` with `saveData: true` and `dataColumn: "text"`, then `loop-breakpoint` with the same `loopId`. Declare `table: [{ "id": "text", "name": "text", "type": "string" }]`.

## Anti-patterns

The validator emits a warning and a `fix` for each of these. Treat the `fix` as the edit to make.

| Code | What is wrong |
| --- | --- |
| `prefer-wait` | A `delay` of 500ms or more, or any delay after `new-tab` / `reload-tab`. |
| `enable-wait-tab` | `new-tab` has a URL and `waitTabLoaded` is false. |
| `enable-wait-selector` | A selector block does not wait for the element. |
| `short-existence-check` | `element-exists` uses fewer than 2 tries and a timeout under 1000ms. |
| `missing-retry` | A page or network block has no retry, continue, or fallback. |
| `fragile-selector` | The selector is long, positional, or full of generated classes. |
| `broad-selector` | The selector is `*`, `html`, or `body`. |
| `blank-loop-id` | A loop or breakpoint has an empty `loopId`. |
| `loop-without-breakpoint` | No `loop-breakpoint` with the same `loopId` is downstream of the loop. |
| `discarded-read` | `get-text`, `attribute-value`, or `tab-url` neither saves nor assigns the value. |
| `unhandled-branch` | `element-exists` has no `output-2` and `throwError` is not true. |
| `high-block-delay` | `settings.blockDelay` is above 0. |
| `save-log-disabled` | `settings.saveLog` is false, so you cannot read the history. |
| `unreachable-node` | A node other than the trigger or a note has no incoming edge. |

`empty-required` is an **error**. A blank `new-tab` URL or a blank selector will not run. `invalid-handle`, `dangling-edge`, `duplicate-node-id`, and `missing-trigger` are structural errors. Import refuses those unless `force` is true.

## From a description to a working workflow

Use this when you can drive a browser (open pages, click, type, look at the screen) and the bridge is enabled. Your eyes tell you what the page is. The tools below tell you the selector Automa will actually use. Do not invent a selector from a screenshot when `page_snapshot` returned a candidate.

The same calls work over MCP, `POST /automa/v1/rpc`, or `node agent/cli.js rpc <method> --file params.json`. `judge_selector` and `node agent/cli.js selector '<selector>'` work with no extension.

1. **Read the request.** Name the site, the data to read or the action to take, and where the result should go (a variable, a table column, or the next page).
2. **Open the page.** If you opened it yourself, `list_tabs` and use that `tabId`. Otherwise `open_tab` with the URL. Pass `tabId` on every later call.
3. **Look, then snapshot.** `page_snapshot`. Each element has `text`, `role`, `type`, and `candidates` sorted by `score`. `verdict` is `stable`, `ok`, or `fragile`.
4. **Test before you trust it.** `test_selector` for the candidate you intend to use. Accept it only when `matchCount` is 1 for a single target, or the list size you expect for `loop-elements`, `visibleCount` agrees, and `samples[0].text` is the element you saw. `highlight: true` outlines it so you can check with your eyes. A `fragile` verdict is not acceptable in the workflow.
5. **Preview the step.** `preview_block` performs the block. `new-tab` opens the URL. `forms` types. `event-click` clicks. `get-text` returns the string. A null `result` means the block finished without a value; look at the page to confirm the field changed.
6. **Assemble.** `create_workflow` with the selectors you tested, `waitTabLoaded`, `waitForSelector`, and `onError` retries from the guide above. `validate_workflow` until `errors` and `warnings` are empty. `judge_selector` is not a substitute for `test_selector`.
7. **Run the whole thing.** `preview_workflow` once. Read `logs[0].history`. The message on a failed block names the selector or the error. Fix that step, `test_selector` again, then `import_workflow` and `run_workflow`. `preview_workflow` deletes its temporary copy unless you pass `keep: true` or it is still running.
8. **Debug a saved run.** `get_run_logs`. A `running` entry means it has not finished. On a finished log, `history[].name` is the block and `history[].message` is the error (`element-not-found` means the selector missed; take a fresh snapshot, the page may have changed). `stop_workflow` abandons a stuck run.

Two traces are written out so you can copy the shape of the calls:

- [Read the example.com heading](agent/examples/computer-use-read-heading.md) ends at `agent/examples/read-example-heading.automa.json`
- [Fill the httpbin form](agent/examples/computer-use-fill-form.md) ends at `agent/examples/fill-httpbin-form.automa.json`

### Which selector to keep

| Prefer | Example | When |
| --- | --- | --- |
| `data-testid`, `data-test`, `data-cy`, `data-qa` | `[data-testid="customer-name"]` | The site provides one. |
| `name`, `aria-label`, `placeholder` | `input[name="custname"]` | Forms. |
| `href` | `a[href="https://www.iana.org/domains/example"]` | The link target is stable and not a long query string. |
| Hand-written `id` | `form#login` | The id is not generated. |
| Tag | `h1` | A landmark, and `test_selector` reports `matchCount` 1. |
| `:equal("Submit")` | `button:equal("Submit")` | The visible label is the action, and it does not change. Automa's selector engine supports `:equal` and `:contains`. |

Do not select an element by the text you are trying to read. `h1:equal("Example Domain")` breaks when the heading changes, which is the value you wanted. Use `:equal` for buttons and links whose label is the action.

Generated ids (`ember123`, `css-1ab2c`, `react-select`) and `:nth-child` chains are `fragile`. Drop them.

`findBy` is `cssSelector` unless the candidate says `xpath`. Inside `loop-elements`, the body selector is `{{loopData@loopId}}`, which `test_selector` will not match outside the loop. Test the list selector (`p`, `li.product`) with `test_selector` and expect `matchCount` greater than 1.

### When to use a JavaScript block

Use `javascript-code` with `context: "website"` when:

- the value is computed (a regex over the page, JSON inside a script tag)
- the only selector is `fragile` and `test_selector` cannot make it unique
- the node is inside an open shadow root (`page_snapshot` sets `shadowRoots: true`). The `>>` combinator reaches open shadow DOM (`host >> button`). A closed shadow root needs JavaScript.

Prototype the DOM read with `evaluate_in_tab`. `code` is the body of an async function. `return` the JSON value you need. `world: "isolated"` sees the DOM and is not blocked by the page CSP. `world: "page"` sees the page's own JavaScript; the page may refuse it.

In the workflow block, hand the value back with the helpers Automa injects:

```javascript
const heading = document.querySelector('h1')?.innerText || '';
automaSetVariable('heading', heading);
automaNextBlock(heading);
```

Preview that block with `preview_block`. The preview understands `automaNextBlock` and `automaSetVariable`. Do not read `document.cookie`, `localStorage`, or passwords unless the task asks for them. Do not use `context: "background"` unless you need an extension API; it is not previewed, because it can do more than touch the page.

`preview_block` does not cover every block (`cookie`, `notification`, `webhook`, and others). For those, build the short workflow and call `preview_workflow`.

### What you see and what the tools see

A screenshot is the visible viewport, one JPEG, and it is dropped when it is large. `page_snapshot` skips elements with no size and skips Automa's own picker. It does not list inside shadow roots. If the snapshot is empty, the page is still loading: call it again. If you clicked and the page navigated, snapshot the new URL before choosing the next selector.

## End to end

1. `list_blocks` and `get_block_schema` for `new-tab` and `get-text`.
2. `create_workflow` with the heading spec above, or start from `agent/examples/read-example-heading.automa.json`.
3. If `validation.ok` is false, apply each error `fix`. Apply each warning `fix` until `warnings` is empty. Call `validate_workflow` again.
4. In Automa: Settings → Agent bridge → enable, generate a token, copy it. Start `pnpm agent:mcp` with that token and port (default `17321`).
5. `import_workflow` with the workflow object.
6. `run_workflow` with the returned `workflowId`.
7. `get_run_logs` until `running` is empty. The `get-text` step is in `logs[0].history`, and the page heading is in the workflow variable `heading`.

You can validate with no browser:

```bash
pnpm agent:validate agent/examples/read-example-heading.automa.json
pnpm test
```

## Extension bridge

1. Open the Automa dashboard → Settings → Agent bridge.
2. Enable it, generate a token, and copy the token.
3. Start `pnpm agent:mcp` with `AUTOMA_AGENT_TOKEN` set to that token and `AUTOMA_AGENT_PORT` set to the same port (default `17321`).

Automa polls `http://127.0.0.1:<port>/automa/v1/commands` and posts results to `/automa/v1/results`. The bridge is off by default. Changing the setting wakes the background script; reload the extension if a poll does not start.

The first run of a block that needs `downloads`, `clipboard`, or `notifications` can still ask the person using the browser to grant that permission.

## Not in this change

- Only the common editor dropdowns are listed as enums. An unknown option is a warning.
- Blocks nested inside `blocks-group` or a block package are not validated field by field.
- There is no remote or multi-user bridge. The token is a shared secret on `127.0.0.1`.
- Step history is still written only when a run finishes. `page_snapshot` is how you inspect the page while you are building, not a live trace of a running workflow.
- `page_snapshot` does not enter closed shadow roots or iframes other than the top frame. Use `evaluate_in_tab` or the `>>` combinator for open shadow DOM.
- A screenshot is the visible area, not a full-page capture, and a very large image is omitted.
- `preview_block` runs interaction blocks, `new-tab`, `reload-tab`, and website `javascript-code`. Other blocks go through `preview_workflow`.
- The on-page element picker for a person using the editor is unchanged.
