const sanitizeMetricName = (name) => name.replace(/[^a-zA-Z0-9_:]/g, '_');

const metricDefinitions = new Map();
const counters = new Map();
const gauges = new Map();
const histograms = new Map();

const labelKey = (labels = {}) => {
  const keys = Object.keys(labels).sort();
  return keys.map((key) => `${key}:${labels[key]}`).join('|');
};

const ensureMap = (store, metricName) => {
  if (!store.has(metricName)) {
    store.set(metricName, new Map());
  }
  return store.get(metricName);
};

const ensureDefinition = (name, type, help) => {
  if (!metricDefinitions.has(name)) {
    metricDefinitions.set(name, { type, help: help || name });
  }
};

const incCounter = (name, labels = {}, value = 1, help = '') => {
  ensureDefinition(name, 'counter', help);
  const map = ensureMap(counters, name);
  const key = labelKey(labels);
  const current = map.get(key);
  if (!current) {
    map.set(key, { labels, value });
    return;
  }
  current.value += value;
};

const setGauge = (name, labels = {}, value = 0, help = '') => {
  ensureDefinition(name, 'gauge', help);
  const map = ensureMap(gauges, name);
  const key = labelKey(labels);
  map.set(key, { labels, value });
};

const addGauge = (name, labels = {}, delta = 0, help = '') => {
  ensureDefinition(name, 'gauge', help);
  const map = ensureMap(gauges, name);
  const key = labelKey(labels);
  const current = map.get(key);
  if (!current) {
    map.set(key, { labels, value: delta });
    return;
  }
  current.value += delta;
};

const observeHistogram = (name, labels = {}, value = 0, help = '') => {
  ensureDefinition(name, 'histogram', help);
  const map = ensureMap(histograms, name);
  const key = labelKey(labels);
  let current = map.get(key);
  if (!current) {
    current = {
      labels,
      count: 0,
      sum: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY
    };
    map.set(key, current);
  }

  current.count += 1;
  current.sum += value;
  current.min = Math.min(current.min, value);
  current.max = Math.max(current.max, value);
};

const timeHistogram = (name, labels = {}, help = '') => {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    observeHistogram(name, labels, durationMs, help);
  };
};

const formatLabels = (labels = {}) => {
  const keys = Object.keys(labels);
  if (!keys.length) return '';
  const body = keys
    .sort()
    .map((key) => `${key}="${String(labels[key]).replace(/"/g, '\\"')}"`)
    .join(',');
  return `{${body}}`;
};

const renderMetrics = () => {
  const lines = [];

  const renderMetricHeader = (name) => {
    const definition = metricDefinitions.get(name);
    const metricName = sanitizeMetricName(name);
    if (!definition) return metricName;
    lines.push(`# HELP ${metricName} ${definition.help}`);
    lines.push(`# TYPE ${metricName} ${definition.type}`);
    return metricName;
  };

  counters.forEach((entries, name) => {
    const metricName = renderMetricHeader(name);
    entries.forEach((entry) => {
      lines.push(`${metricName}${formatLabels(entry.labels)} ${entry.value}`);
    });
  });

  gauges.forEach((entries, name) => {
    const metricName = renderMetricHeader(name);
    entries.forEach((entry) => {
      lines.push(`${metricName}${formatLabels(entry.labels)} ${entry.value}`);
    });
  });

  histograms.forEach((entries, name) => {
    const metricName = renderMetricHeader(name);
    entries.forEach((entry) => {
      lines.push(`${metricName}_count${formatLabels(entry.labels)} ${entry.count}`);
      lines.push(`${metricName}_sum${formatLabels(entry.labels)} ${entry.sum}`);
      lines.push(`${metricName}_min${formatLabels(entry.labels)} ${entry.count ? entry.min : 0}`);
      lines.push(`${metricName}_max${formatLabels(entry.labels)} ${entry.count ? entry.max : 0}`);
    });
  });

  return `${lines.join('\n')}\n`;
};

const getRouteLabel = (req) => {
  if (req.route && req.route.path) {
    return String(req.route.path);
  }
  if (req.baseUrl && req.path) {
    return `${req.baseUrl}${req.path}`;
  }
  return req.originalUrl ? req.originalUrl.split('?')[0] : 'unknown';
};

const httpMetricsMiddleware = (req, res, next) => {
  const endTimer = timeHistogram(
    'http_request_duration_ms',
    { method: req.method, route: getRouteLabel(req) },
    'HTTP request duration in milliseconds'
  );
  addGauge(
    'http_requests_inflight',
    { method: req.method, route: getRouteLabel(req) },
    1,
    'In-flight HTTP requests'
  );

  res.on('finish', () => {
    endTimer();
    incCounter(
      'http_requests_total',
      { method: req.method, route: getRouteLabel(req), status: String(res.statusCode) },
      1,
      'HTTP requests processed'
    );
    addGauge(
      'http_requests_inflight',
      { method: req.method, route: getRouteLabel(req) },
      -1
    );
  });

  next();
};

module.exports = {
  incCounter,
  setGauge,
  addGauge,
  observeHistogram,
  timeHistogram,
  renderMetrics,
  httpMetricsMiddleware
};
