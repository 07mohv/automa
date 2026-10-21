# Fill the httpbin form

Request: "Open the httpbin form, type Ada Lovelace into the customer name, and submit it."

Enable Settings → Agent bridge and start `pnpm agent:mcp` with that token. Replace `tabId` with the id from `open_tab` or `list_tabs`.

## 1. Open the form

`open_tab`

```json
{ "url": "https://httpbin.org/forms/post" }
```

## 2. Snapshot and choose selectors

`page_snapshot` with that `tabId`. The customer field and the submit button come back with stable candidates:

```json
{ "selector": "input[name=\"custname\"]", "reason": "name", "verdict": "stable" }
```

```json
{ "selector": "button[type=\"submit\"]", "reason": "type", "verdict": "ok" }
```

`input[name="custname"]` beats `input[type="text"]` because a type matches every text field. A `data-testid` would rank higher if the site had one. Ignore any candidate whose `verdict` is `fragile`.

## 3. Test both selectors

`test_selector` for `input[name="custname"]`, then for `button[type="submit"]`. Each must report `matchCount: 1` and `visibleCount: 1`. The input sample text is the placeholder or the name, and the button sample text is `Submit`. Pass `highlight: true` on one of them and look at the outline.

`judge_selector` can score these strings with no browser. It does not prove they match. `test_selector` does.

## 4. Preview the typing, then the click

`preview_block` really types and really clicks.

```json
{
  "tabId": 1,
  "block": "forms",
  "data": {
    "selector": "input[name=\"custname\"]",
    "type": "text-field",
    "value": "Ada Lovelace",
    "waitForSelector": true,
    "waitSelectorTimeout": 5000
  }
}
```

Look at the page. The customer name field shows `Ada Lovelace`. A null `result` here means the block finished; the page is the confirmation.

Then preview the click:

```json
{
  "tabId": 1,
  "block": "event-click",
  "data": {
    "selector": "button[type=\"submit\"]",
    "waitForSelector": true,
    "waitSelectorTimeout": 5000
  }
}
```

httpbin navigates to a page that echoes the form. Snapshot that new URL if the workflow should read the result. This example stops after the click.

## 5. Save the workflow

The finished workflow is `fill-httpbin-form.automa.json`: `new-tab` with `waitTabLoaded`, `forms` on `input[name="custname"]`, `event-click` on `button[type="submit"]`, and a retry `onError` on each page block.

`validate_workflow` until `warnings` is empty. `preview_workflow` runs the copy once and deletes it. Read `logs[0].history`. If `forms` failed, the message is the selector problem; test a different candidate and import with `overwrite: true`.

If the submit button had no stable attribute and the only selector was a `:nth-child` chain, do not use it. `evaluate_in_tab` with `world: "isolated"` can find the button by its text, and a `javascript-code` block with `context: "website"` can click it:

```javascript
const button = [...document.querySelectorAll('button')].find((node) =>
  node.innerText.includes('Submit')
);
button.click();
automaNextBlock();
```

Preview that with `preview_block` and `block: "javascript-code"` before you put it in the graph. This form does not need it, because `button[type="submit"]` already tests clean.
