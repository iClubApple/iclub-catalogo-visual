const SHEET_ID = "1yIchT-R7KSY5NuIcfjMuYRjPjbQaZ3j5LdcfXee2USY";
const PLAN_CANJE_SHEET_NAME = "PRECIOS EQUIPOS APPLE";
const PLAN_CANJE_RANGE = "A:F";

const EXPECTED_HEADERS = {
  linkInfo: "LINK INFO",
  equipment: "EQUIPOS",
  tradeInValue: "PRECIO / ECO CANJE",
  batteryReplacement: "CAMBIO DE BATERIA",
  screenReplacement: "CAMBIO DE PANTALLA",
  backReplacement: "CAMBIO DE TAPA",
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseUsd(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const numeric = text
    .replace(/usd/ig, "")
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const number = Number(numeric);
  return Number.isFinite(number) ? number : 0;
}

function displayModelName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\biphone\b/g, "iPhone")
    .replace(/\bpro\b/g, "Pro")
    .replace(/\bmax\b/g, "Max")
    .replace(/\bse\b/g, "SE")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEquipmentName(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const capacityMatches = [...raw.matchAll(/\b\d+\s*(?:GB|TB)\b/ig)].map((match) =>
    match[0].replace(/\s+/g, "").toUpperCase()
  );
  const capacities = capacityMatches.length ? capacityMatches : [];
  const model = displayModelName(raw.replace(/\b\d+\s*(?:GB|TB)\b/ig, " ").replace(/[/-]+/g, " "));
  return { raw, model, capacities };
}

function planCanjeKey(model, capacity) {
  return `${normalizeText(model)}|${normalizeText(capacity)}`;
}

function rangeStartRow(range) {
  const match = String(range || "").match(/^[A-Z]+(\d+)/i);
  return match ? Number(match[1]) : 1;
}

function planCanjeGvizUrl(range = PLAN_CANJE_RANGE) {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?headers=0&tqx=out:json`;
  const params = new URLSearchParams({
    sheet: PLAN_CANJE_SHEET_NAME,
    range,
    cache: String(Date.now()),
  });
  return `${base}&${params.toString()}`;
}

async function fetchPlanCanjeRows(range = PLAN_CANJE_RANGE) {
  const response = await fetch(planCanjeGvizUrl(range));
  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?$/s);
  if (!match) throw new Error("No se pudo interpretar la respuesta GViz de Plan Canje.");
  const payload = JSON.parse(match[1]);
  if (payload.status === "error") {
    throw new Error(payload.errors?.[0]?.detailed_message || "Google Sheets rechazo la lectura de Plan Canje.");
  }
  const startRow = rangeStartRow(range);
  return (payload.table.rows || []).map((row, index) => ({
    sheetRow: startRow + index,
    values: (row.c || []).slice(0, 6).map((cell) => String(cell?.f ?? cell?.v ?? "").trim()),
  }));
}

function rowHasPlanCanjeTitle(row) {
  return row.values.some((value) => {
    const text = normalizeText(value);
    return text.includes("cotizador de plan caje") || text === "iphone plan canje";
  });
}

function rowMatchesHeaders(row, requireFullHeaders = true) {
  const values = row.values.map(normalizeText);
  const requiredStart = normalizeText(EXPECTED_HEADERS.linkInfo) === values[0]
    && normalizeText(EXPECTED_HEADERS.equipment) === values[1];
  if (!requiredStart || !requireFullHeaders) return requiredStart;
  return normalizeText(EXPECTED_HEADERS.tradeInValue) === values[2]
    && normalizeText(EXPECTED_HEADERS.batteryReplacement) === values[3]
    && normalizeText(EXPECTED_HEADERS.screenReplacement) === values[4]
    && normalizeText(EXPECTED_HEADERS.backReplacement) === values[5];
}

function locatePlanCanjeBlock(rows, options = {}) {
  return locatePlanCanjeBlockCandidates(rows, options)[0] || (() => {
    throw new Error("No se encontro un bloque valido de COTIZADOR DE PLAN CAJE con encabezados A-F.");
  })();
}

function locatePlanCanjeBlockCandidates(rows, options = {}) {
  const requireFullHeaders = options.requireFullHeaders !== false;
  const candidates = [];
  for (let titleIndex = 0; titleIndex < rows.length; titleIndex += 1) {
    if (!rowHasPlanCanjeTitle(rows[titleIndex])) continue;

    const headerIndex = rows.findIndex((row, index) =>
      index > titleIndex && index <= titleIndex + 12 && rowMatchesHeaders(row, requireFullHeaders)
    );
    if (headerIndex === -1) continue;

    const dataStart = headerIndex + 1;
    let dataEnd = dataStart;
    while (dataEnd < rows.length) {
      const equipment = rows[dataEnd].values[1] || "";
      const normalized = normalizeText(equipment);
      if (normalized === "airpods" || normalized.includes("airpods")) break;
      if (normalized && !normalized.includes("iphone")) break;
      dataEnd += 1;
    }

    const sampleRows = rows.slice(dataStart, dataEnd).filter((row) => normalizeText(row.values[1]).includes("iphone"));
    if (sampleRows.length) {
      candidates.push({
        titleRow: rows[titleIndex].sheetRow,
        headerRow: rows[headerIndex].sheetRow,
        dataStartRow: rows[dataStart].sheetRow,
        dataEndRow: rows[dataEnd - 1]?.sheetRow || rows[dataStart].sheetRow,
        rows: sampleRows,
      });
    }
  }

  return candidates;
}

function parsePlanCanjeProducts(blockRows) {
  const products = [];
  const byKey = new Map();

  blockRows.forEach((row) => {
    const [linkInfo, equipment, tradeInValue, batteryReplacement, screenReplacement, backReplacement] = row.values;
    const parsed = parseEquipmentName(equipment);
    if (!parsed.model || !parsed.capacities.length) return;

    const product = {
      sheetRow: row.sheetRow,
      linkInfo,
      rawEquipment: parsed.raw,
      model: parsed.model,
      capacities: parsed.capacities,
      tradeInValue: parseUsd(tradeInValue),
      batteryReplacement: parseUsd(batteryReplacement),
      screenReplacement: parseUsd(screenReplacement),
      backReplacement: parseUsd(backReplacement),
    };

    products.push(product);
    product.capacities.forEach((capacity) => {
      byKey.set(planCanjeKey(product.model, capacity), product);
    });
  });

  return { products, byKey };
}

function findPlanCanjeProduct(index, model, capacity) {
  return index.get(planCanjeKey(model, capacity)) || null;
}

function calculatePlanCanjeValue(product, options) {
  const battery = Number(options.batteryPercent);
  const batteryDiscount = Number.isFinite(battery) && battery <= 86 ? product.batteryReplacement : 0;
  const screenDiscount = options.needsScreenReplacement ? product.screenReplacement : 0;
  const backDiscount = options.needsBackReplacement ? product.backReplacement : 0;
  const totalDiscount = batteryDiscount + screenDiscount + backDiscount;
  return Math.max(0, product.tradeInValue - totalDiscount);
}

async function loadPlanCanjeData() {
  const broadRows = await fetchPlanCanjeRows();
  const locations = locatePlanCanjeBlockCandidates(broadRows, { requireFullHeaders: false });
  let block = null;
  for (const location of locations) {
    const exactRows = await fetchPlanCanjeRows(`A${location.titleRow}:F${location.dataEndRow}`);
    const exactCandidates = locatePlanCanjeBlockCandidates(exactRows);
    if (exactCandidates.length) {
      block = exactCandidates[0];
      break;
    }
  }
  if (!block) {
    throw new Error("No se encontro un bloque valido de COTIZADOR DE PLAN CAJE con encabezados A-F.");
  }
  const parsed = parsePlanCanjeProducts(block.rows);

  return {
    sheetName: PLAN_CANJE_SHEET_NAME,
    range: PLAN_CANJE_RANGE,
    titleRow: block.titleRow,
    headerRow: block.headerRow,
    dataStartRow: block.dataStartRow,
    dataEndRow: block.dataEndRow,
    products: parsed.products,
    byKey: parsed.byKey,
  };
}

async function runPlanCanjeDiagnostic() {
  const data = await loadPlanCanjeData();

  const requestedProducts = [
    ["iPhone 13", "128GB"],
    ["iPhone 13", "256GB"],
    ["iPhone 15 Pro", "128GB"],
    ["iPhone 16 Pro", "256GB"],
    ["iPhone 17 Pro Max", "256GB"],
  ];

  const interpreted = requestedProducts.map(([model, capacity]) => {
    const product = findPlanCanjeProduct(data.byKey, model, capacity);
    return product ? {
      modelo: product.model,
      capacidad: capacity,
      valorBase: product.tradeInValue,
      cambioBateria: product.batteryReplacement,
      cambioPantalla: product.screenReplacement,
      cambioTapa: product.backReplacement,
      filaSheet: product.sheetRow,
      filaOriginal: product.rawEquipment,
    } : {
      modelo: model,
      capacidad: capacity,
      error: "No encontrado",
    };
  });

  const iphone13 = findPlanCanjeProduct(data.byKey, "iPhone 13", "128GB");
  const scenarios = iphone13 ? [
    ["Caso A", { batteryPercent: 90, needsScreenReplacement: false, needsBackReplacement: false }],
    ["Caso B", { batteryPercent: 83, needsScreenReplacement: false, needsBackReplacement: false }],
    ["Caso C", { batteryPercent: 90, needsScreenReplacement: true, needsBackReplacement: false }],
    ["Caso D", { batteryPercent: 83, needsScreenReplacement: true, needsBackReplacement: false }],
  ].map(([caseName, options]) => ({
    caso: caseName,
    modelo: iphone13.model,
    capacidad: "128GB",
    bateria: `${options.batteryPercent}%`,
    pantalla: options.needsScreenReplacement ? "Necesita cambio" : "OK",
    tapa: options.needsBackReplacement ? "Necesita cambio" : "OK",
    resultado: calculatePlanCanjeValue(iphone13, options),
  })) : [];

  return {
    sheetName: data.sheetName,
    range: data.range,
    titleRow: data.titleRow,
    headerRow: data.headerRow,
    dataStartRow: data.dataStartRow,
    dataEndRow: data.dataEndRow,
    totalRowsParsed: data.products.length,
    interpreted,
    scenarios,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    calculatePlanCanjeValue,
    findPlanCanjeProduct,
    loadPlanCanjeData,
    locatePlanCanjeBlock,
    parseEquipmentName,
    parsePlanCanjeProducts,
    parseUsd,
    runPlanCanjeDiagnostic,
  };
}

if (typeof window !== "undefined") {
  window.iClubPlanCanje = {
    calculatePlanCanjeValue,
    findPlanCanjeProduct,
    loadPlanCanjeData,
    locatePlanCanjeBlock,
    parseEquipmentName,
    parsePlanCanjeProducts,
    parseUsd,
    runPlanCanjeDiagnostic,
  };
}
