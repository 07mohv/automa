# Read the heading on example.com

Request: "Open example.com and save the main heading in a variable called heading."

The agent can drive the browser. It still uses the bridge tools so the selector is the one Automa will run. Enable Settings → Agent bridge first, and start `pnpm agent:mcp` with the same token. Every call below is the `params` object of `page_snapshot`, `test_selector`, or `preview_block`.

## 1. Open the page

`open_tab`

```json
{ "url": "https://example.com" }
```

The result includes `tabId`. Use it on every later call. If you already opened the tab yourself, `list_tabs` and pick the row whose `url` is `https://example.com/` and whose `inspectable` is true.

## 2. Snapshot

`page_snapshot`

```json
{ "tabId": 1, "limit": 40 }
```

The `h1` comes back with text `Example Domain` and one candidate:

```json
{ "selector": "h1", "findBy": "cssSelector", "reason": "tag", "score": 45, "verdict": "ok" }
```

There is no `data-testid` on this page. `h1` is a landmark, so `ok` is the right verdict. Do not build `h1:equal("Example Domain")`: that text is the value you want to read, and it would break if the heading changed.

## 3. Test the selector

`test_selector`

```json
{ "tabId": 1, "selector": "h1", "highlight": true }
```

Accept it only when the result looks like this:

```json
{
  "matchCount": 1,
  "visibleCount": 1,
  "samples": [{ "tag": "h1", "text": "Example Domain", "visible": true }],
  "robustness": { "verdict": "ok" }
}
```

`matchCount` above 1 means the selector is too wide. `matchCount` 0 means it is wrong. The outline on the page should sit on the heading you see.

## 4. Preview the read

`preview_block`

```json
{
  "tabId": 1,
  "block": "get-text",
  "data": {
    "selector": "h1",
    "waitForSelector": true,
    "waitSelectorTimeout": 5000,
    "assignVariable": true,
    "variableName": "heading",
    "saveData": false
  }
}
```

`result` is the string `Example Domain`. That is the value the workflow will store.

## 5. Save the workflow

`create_workflow` with the spec in `AGENTS.md`, or start from `read-example-heading.automa.json`. It opens the URL with `waitTabLoaded`, reads `h1` with `waitForSelector`, stores `heading`, and retries each page block twice.

`validate_workflow` must return `errors: []` and `warnings: []`. Then `import_workflow` and `run_workflow`. `get_run_logs` after the run finishes lists the `get-text` step in `logs[0].history`.

If that step says `element-not-found`, the page changed. Snapshot again and test the new candidate before importing with `overwrite: true`.
