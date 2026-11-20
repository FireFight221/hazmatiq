(() => {
  const NO_DATA = 'No Current Data Exists';
  const emptyPlaceholder = /^(?:none|n\/?a|not available|no data|null|undefined|unknown)$/i;
  const continuation = /^(?:and|or|then|with|when|as|if appropriate)\b/i;
  const conditional = /^(?:If|When|For|During|After|Before)\b/;
  const action = /^(?:remove|move|add|use|place|flush|wash|rinse|decontaminate|ventilate|isolate|evacuate|shelter|monitor|verify|contact|call|provide|administer|maintain|avoid|keep|wear|don|doff|establish|collect|contain|control|treat|support|perform|discontinue|begin|continue|ensure)\b/i;
  const protectedDetail = /(?:\d|\b(?:CAS|UN\/?NA|ERG|AEGL|IDLH|REL|PEL|TLV|ERPG|TEEL|ppm|mg\/m[³3]|feet|foot|ft|meter|mile|km|source|warning|caution|danger|limitation)\b)/i;

  function normalizeChemicalProfileText(text) {
    const value = String(text ?? '')
      .normalize('NFKC')
      .replace(/\\(?:r\\n|[nrt])/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/^\s*(?:#{1,6}|[*•]+|-+(?![\d.]))\s*/, '')
      .replace(/([.!?])["']\s*\.\s*$/, '$1')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!value) return '';
    return /^No Current Data Exists\.?$/i.test(value) ? NO_DATA : value;
  }

  function isEmpty(value) {
    const normalized = normalizeChemicalProfileText(value);
    return !normalized || emptyPlaceholder.test(normalized) || /^No Current Data Exists\.?$/i.test(normalized);
  }

  function normalizeEmptyState(value) {
    const normalized = normalizeChemicalProfileText(value);
    return !normalized || emptyPlaceholder.test(normalized) ? NO_DATA : normalized;
  }

  function comparisonKey(value) {
    return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function finishGuidanceSentence(value) {
    let result = value.trim();
    if (action.test(result) && /^[a-z]/.test(result)) result = result[0].toUpperCase() + result.slice(1);
    if ((action.test(result) || conditional.test(result)) && !protectedDetail.test(result) && !/[.!?;:]$/.test(result)) result += '.';
    return result;
  }

  function mergeBrokenGuidanceFragments(items) {
    const normalized = items.flat(Infinity).map(normalizeChemicalProfileText).filter((item) => !isEmpty(item));
    const merged = [];
    normalized.forEach((current) => {
      const currentKey = comparisonKey(current);
      if (!currentKey || merged.some((item) => comparisonKey(item) === currentKey)) return;
      const words = currentKey.split(' ');
      if (words.length <= 2 && action.test(current) && merged.some((item) => {
        const priorWords = comparisonKey(item).split(' ');
        return words.every((word) => priorWords.includes(word));
      })) return;
      const previous = merged.at(-1);
      if (previous && continuation.test(current) && !protectedDetail.test(current)) {
        merged[merged.length - 1] = `${previous.replace(/[.;:]$/, '')} ${current}`;
      } else if (previous && conditional.test(previous) && !/[.!?:;]$/.test(previous)
        && action.test(current) && /^[a-z]/.test(current) && !protectedDetail.test(current)) {
        merged[merged.length - 1] = `${previous}, ${current}`;
      } else merged.push(current);
    });
    return merged.map(finishGuidanceSentence);
  }

  function removeContradictoryEmptyStates(items) {
    const meaningful = items.flat(Infinity).map(normalizeChemicalProfileText).filter((item) => !isEmpty(item));
    return meaningful.length ? meaningful : [NO_DATA];
  }

  function normalizeGuidanceItems(items) {
    return removeContradictoryEmptyStates(mergeBrokenGuidanceFragments(items));
  }

  const aeglTimeframes = [
    { label: '< 1 Hour', includes: (minutes) => minutes < 60 },
    { label: '1-4 Hours', includes: (minutes) => minutes >= 60 && minutes <= 240 },
    { label: '4-8 Hours', includes: (minutes) => minutes > 240 && minutes <= 480 },
    { label: '8-12 Hours', includes: (minutes) => minutes > 480 && minutes <= 720 },
  ];

  function parseAeglConcern(value) {
    const [rawKey, ...valueParts] = String(value ?? '').split(':');
    const match = rawKey.trim().match(/^AEGL([123])[_\s-]?(\d+(?:\.\d+)?)(min|hr|hour|hours)$/i);
    const displayValue = valueParts.join(':').trim();
    if (!match || !displayValue || isEmpty(displayValue)) return null;
    const duration = Number(match[2]);
    const minutes = /^min$/i.test(match[3]) ? duration : duration * 60;
    const numeric = displayValue.match(/(\d+(?:\.\d+)?)(?:\s*[x×]\s*10\^?\s*([+-]?\d+))?/i);
    const concentration = numeric
      ? Number(numeric[1]) * (numeric[2] ? 10 ** Number(numeric[2]) : 1)
      : Number.NaN;
    return { level: Number(match[1]), minutes, value: displayValue, concentration };
  }

  function groupAeglByTimeframe(values) {
    const entries = (Array.isArray(values) ? values : [values]).map(parseAeglConcern).filter(Boolean);
    if (!entries.length) return [];
    return aeglTimeframes.map((timeframe) => {
      const levels = [1, 2, 3].map((level) => {
        const candidates = entries.filter((entry) => entry.level === level && timeframe.includes(entry.minutes));
        const comparable = candidates.filter((entry) => Number.isFinite(entry.concentration));
        const selected = comparable.length
          ? comparable.reduce((lowest, entry) => entry.concentration < lowest.concentration ? entry : lowest)
          : candidates[0];
        return `AEGL-${level}: ${selected?.value || NO_DATA}`;
      });
      return { label: timeframe.label, value: levels.join(' · ') };
    });
  }

  // Display-only structuring for long source sentences such as mixing risk
  // and explosion hazards. The source wording is preserved verbatim; only the
  // separators (semicolons, sentence breaks, top-level comma lists) become
  // bullets. Commas inside parentheses and commas without a following space
  // (e.g. "1,2-dichloroethane") are never treated as boundaries.
  const abbreviation = /(?:\b(?:e\.g|i\.e|etc|approx|vs|ca|no|incl|esp|min|max|conc|temp)\.|\b[A-Z]\.)$/i;

  function splitTopLevel(text, isBoundary) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '(' || ch === '[') depth += 1;
      else if ((ch === ')' || ch === ']') && depth > 0) depth -= 1;
      else if (depth === 0) {
        const cut = isBoundary(text, i);
        if (cut) {
          parts.push(text.slice(start, cut.end).trim());
          start = cut.next;
          i = cut.next - 1;
        }
      }
    }
    parts.push(text.slice(start).trim());
    return parts.filter(Boolean);
  }

  function splitHazardStatements(text) {
    return splitTopLevel(text, (value, i) => {
      if (value[i] === ';' && /\s/.test(value[i + 1] || '')) return { end: i, next: i + 2 };
      if (/[.!?]/.test(value[i]) && /\s/.test(value[i + 1] || '') && /[A-Z0-9]/.test(value[i + 2] || '')
        && !abbreviation.test(value.slice(Math.max(0, i - 8), i + 1))) {
        return { end: i + 1, next: i + 2 };
      }
      return null;
    });
  }

  function splitHazardList(text) {
    return splitTopLevel(text, (value, i) => (
      value[i] === ',' && value[i + 1] === ' ' && !/\d/.test(value[i + 2] || '')
        ? { end: i, next: i + 2 }
        : null
    ));
  }

  function structureHazardDetail(value, { minListItems = 4 } = {}) {
    const text = normalizeChemicalProfileText(value);
    if (!text) return [];
    return splitHazardStatements(text).map((statement) => {
      // Exception and negation clauses change which items the sentence is
      // about, so those sentences are never broken into a list.
      if (/\b(?:except|exception|other than|unless|excluding|but not|not including)\b/i.test(statement)) {
        return { text: statement, items: [] };
      }
      const pieces = splitHazardList(statement);
      if (pieces.length < minListItems) return { text: statement, items: [] };
      const lead = pieces[0].match(/^(.*?\b(?:with|including|such as)\b:?)\s+(.+)$/i);
      if (lead && lead[1].length <= 90) return { text: lead[1], items: [lead[2], ...pieces.slice(1)] };
      return { text: statement, items: [] };
    });
  }

  window.HazMatChemicalProfileText = {
    structureHazardDetail,
    NO_DATA,
    isEmpty,
    normalizeChemicalProfileText,
    normalizeGuidanceItems,
    mergeBrokenGuidanceFragments,
    removeContradictoryEmptyStates,
    normalizeEmptyState,
    groupAeglByTimeframe,
    normalizeHeading: (text) => normalizeChemicalProfileText(text).replace(/[:.]+$/, ''),
    normalizeSourceLabel: (text) => normalizeEmptyState(normalizeChemicalProfileText(text)
      .replace(/^Linked\s+/i, '')
      .replace(/^Chemical Companion Master$/i, 'Chemical Companion')),
  };
})();
