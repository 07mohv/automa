const SCRIPT_SCHEME = 'java'.concat('script:');

const STABLE_DATA_ATTRS = [
  'data-testid',
  'data-test-id',
  'data-test',
  'data-cy',
  'data-qa',
];

function cssEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isGeneratedToken(value) {
  const text = String(value || '');
  if (!text) return false;
  if (/ember\d+/i.test(text)) return true;
  if (/react-select/i.test(text)) return true;
  if (/^css-[a-z0-9]{4,}$/i.test(text)) return true;
  if (/_[A-Za-z0-9]{5,}_[A-Za-z0-9]{5,}/.test(text)) return true;
  if (/^sc-[a-zA-Z0-9]+/.test(text)) return true;
  if (/^[a-f0-9]{8,}$/i.test(text)) return true;
  return false;
}

function isGeneratedSelector(selector) {
  return (
    /ember\d+/i.test(selector) ||
    /react-select/i.test(selector) ||
    /css-[a-z0-9]{4,}/i.test(selector) ||
    /_[A-Za-z0-9]{5,}_[A-Za-z0-9]{5,}/.test(selector) ||
    /\bsc-[a-zA-Z0-9]+/.test(selector)
  );
}

function hrefLooksStable(selector) {
  const match = selector.match(/\[href\s*=\s*"([^"]*)"/i);
  if (!match) return false;
  const href = match[1];
  if (
    !href ||
    href.slice(0, SCRIPT_SCHEME.length).toLowerCase() === SCRIPT_SCHEME
  ) {
    return false;
  }
  if (href.length > 120) return false;
  if (href.includes('?') && href.length > 80) return false;
  return true;
}

function scoreSelector(selector) {
  const value = String(selector || '').trim();
  if (!value) return 0;
  const lower = value.toLowerCase();
  if (lower === '*' || lower === 'html' || lower === 'body') return 5;
  if (/\[data-(testid|test-id|test|cy|qa)\s*=/.test(lower)) return 100;
  if (/\[name\s*=/.test(lower)) return 84;
  if (/\[aria-label\s*=/.test(lower)) return 80;
  if (/\[href\s*=/.test(lower)) return hrefLooksStable(value) ? 78 : 36;
  if (/\[placeholder\s*=/.test(lower)) return 74;
  const idMatch = value.match(/#([A-Za-z][\w-]*)/);
  if (idMatch) return isGeneratedToken(idMatch[1]) ? 12 : 86;
  if (/:equal\(/i.test(value)) return 68;
  if (/\[role\s*=/.test(lower)) return 66;
  if (/normalize-space\(\)/.test(value) && !/\[\d+\]/.test(value)) return 64;
  if (/\[type\s*=/.test(lower)) return 60;
  if (/:contains\(/i.test(value)) return 48;
  if (/^[a-z][a-z0-9-]*$/i.test(value)) return 45;
  if (isGeneratedSelector(value)) return 12;
  if (/:nth-(?:child|of-type)\(/i.test(value)) return 22;
  if (/^(?:html|body)\b/i.test(value)) return 15;
  if (value.length > 160) return 18;
  return 40;
}

function verdictFor(score) {
  if (score >= 75) return 'stable';
  if (score < 40) return 'fragile';
  return 'ok';
}

function noteFor(verdict) {
  if (verdict === 'stable') {
    return 'Stable attribute. Still confirm matchCount is 1, or the list size you expect, and that the sample text is the element you want.';
  }
  if (verdict === 'fragile') {
    return 'Do not put this selector in a workflow. Use a stable candidate from page_snapshot, or read the value with a javascript-code block.';
  }
  return 'Usable when matchCount and the sample text are right. Prefer a stable attribute when page_snapshot offers one.';
}

function judgeSelector(selector) {
  const score = scoreSelector(selector);
  const verdict = verdictFor(score);
  return {
    selector: String(selector || ''),
    score,
    verdict,
    note: noteFor(verdict),
  };
}

function attrSelector(tag, name, value) {
  return `${tag}[${name}="${cssEscape(value)}"]`;
}

function idSelector(tag, id) {
  if (/^[A-Za-z][\w-]*$/.test(id)) return `${tag}#${id}`;
  return attrSelector(tag, 'id', id);
}

function rankProposals(proposals) {
  const seen = new Set();
  const ranked = [];
  proposals.forEach((item) => {
    if (!item || !item.selector || seen.has(item.selector)) return;
    seen.add(item.selector);
    ranked.push({
      selector: item.selector,
      findBy: item.findBy || 'cssSelector',
      reason: item.reason,
      ...judgeSelector(item.selector),
    });
  });
  ranked.sort(
    (left, right) =>
      right.score - left.score || left.selector.localeCompare(right.selector)
  );
  return ranked;
}

function candidatesFromDescriptor(desc) {
  const source = desc || {};
  const tag = String(source.tag || '*').toLowerCase();
  const attrs = source.attributes || {};
  const text = String(source.text || '')
    .replace(/\s+/g, ' ')
    .trim();
  const proposals = [];

  function add(selector, reason, findBy) {
    proposals.push({
      selector,
      reason,
      findBy: findBy || 'cssSelector',
    });
  }

  STABLE_DATA_ATTRS.forEach((name) => {
    if (attrs[name]) add(`[${name}="${cssEscape(attrs[name])}"]`, name);
  });
  if (source.id && !isGeneratedToken(source.id)) {
    add(idSelector(tag, source.id), 'id');
  }
  if (attrs.name) add(attrSelector(tag, 'name', attrs.name), 'name');
  if (attrs['aria-label']) {
    add(attrSelector(tag, 'aria-label', attrs['aria-label']), 'aria-label');
  }
  if (attrs.placeholder) {
    add(attrSelector(tag, 'placeholder', attrs.placeholder), 'placeholder');
  }
  if (
    attrs.href &&
    String(attrs.href).slice(0, SCRIPT_SCHEME.length).toLowerCase() !==
      SCRIPT_SCHEME &&
    String(attrs.href).length <= 120
  ) {
    add(attrSelector('a', 'href', attrs.href), 'href');
  }
  if (
    attrs.type &&
    !attrs.name &&
    ['input', 'button'].includes(tag) &&
    ['submit', 'button', 'checkbox', 'radio'].includes(attrs.type)
  ) {
    add(attrSelector(tag, 'type', attrs.type), 'type');
  }
  if (
    text &&
    text.length <= 60 &&
    !/["'\n]/.test(text) &&
    ['a', 'button', 'label', 'summary'].includes(tag)
  ) {
    add(`${tag}:equal("${text}")`, 'text');
  }
  if (/^[a-z][a-z0-9-]*$/i.test(tag) && tag !== '*') {
    add(tag, 'tag');
  }

  let ranked = rankProposals(proposals);
  const strong = ranked.filter((item) => item.score >= 60);
  if (!strong.length && source.structural) {
    ranked = rankProposals(
      proposals.concat([
        {
          selector: source.structural,
          reason: 'structure',
          findBy: 'cssSelector',
        },
      ])
    );
  }
  const preferred = ranked.filter((item) => item.score >= 60);
  return (preferred.length ? preferred : ranked).slice(0, 4);
}

function clipText(value, limit = 80) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

export {
  candidatesFromDescriptor,
  clipText,
  isGeneratedToken,
  judgeSelector,
  scoreSelector,
};
