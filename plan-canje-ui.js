const planCanjeDiagnosticReady = import("./plan-canje-diagnostic.js?v=plan-canje-direct-open");

const WHATSAPP_URL = "https://wa.me/5491125003057";

const state = {
  open: false,
  loading: false,
  error: "",
  step: 1,
  data: null,
  model: "",
  capacity: "",
  batteryPercent: 90,
  needsScreenReplacement: false,
  needsBackReplacement: false,
  generalCondition: "",
  selectedNextProductId: "",
  selectedBenefitIds: [],
  nextFilters: {
    model: "",
    condition: "",
    capacity: "",
  },
};

const money = (value) => `USD ${Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const byId = (id) => document.getElementById(id);
const planCanjeLogic = () => window.iClubPlanCanje;
const TOTAL_STEPS = 6;
const STEP_QUOTE_RESULT = 6;
const STEP_NEXT_IPHONE = 7;
const STEP_BENEFITS = 8;
const STEP_DIFFERENCE = 9;
const BENEFIT_PRODUCTS = [
  {
    id: "airpods-pro-aaa",
    name: "AirPods Pro AAA",
    referencePrice: 125,
    specialPrice: 25,
    discountLabel: "80% OFF",
    image: "assets/airpods-pro-aaa-transparent.png",
  },
  {
    id: "apple-watch-series-10-aaa",
    name: "Apple Watch Serie 10 AAA",
    referencePrice: 200,
    specialPrice: 40,
    discountLabel: "80% OFF",
    image: "assets/apple-watch-series-10-aaa-transparent.png",
  },
  {
    id: "apple-watch-ultra-2-aaa",
    name: "Apple Watch Ultra 2 AAA",
    referencePrice: 250,
    specialPrice: 50,
    discountLabel: "80% OFF",
    image: "assets/apple-watch-ultra-2-aaa-transparent.png",
  },
  {
    id: "cargador-apple-usb-c-20w-original",
    name: "Cargador Apple USB-C 20W Original",
    referencePrice: 80,
    specialPrice: 45,
    discountLabel: "40% OFF",
    image: "assets/cargador-apple-usb-c-20w-original-transparent.png",
    whatsappIcon: "🔌",
  },
];
const GENERAL_CONDITIONS = [
  {
    value: "MAL",
    title: "MAL",
    description: "Daños estéticos importantes y/o problemas funcionales.",
    tone: "bad",
    marks: {
      front: '<span class="phone-mark crack one"></span><span class="phone-mark crack two"></span><span class="phone-mark crack four"></span><span class="phone-mark line three"></span><span class="phone-mark small five"></span>',
    },
  },
  {
    value: "REGULAR",
    title: "REGULAR",
    description: "Detalles estéticos o desgaste por uso normal.",
    tone: "regular",
    marks: {
      front: '<span class="phone-mark tiny one"></span><span class="phone-mark line three"></span><span class="phone-mark hairline six"></span>',
    },
  },
  {
    value: "EXCELENTE",
    title: "EXCELENTE",
    description: "Sin detalles estéticos relevantes y funcionando correctamente.",
    tone: "excellent",
    marks: {
      front: "",
    },
  },
];

function ensureModal() {
  if (byId("planCanjeModal")) return;
  const modal = document.createElement("div");
  modal.id = "planCanjeModal";
  modal.className = "trade-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="trade-panel" role="dialog" aria-modal="true" aria-label="Cotizador Plan Canje iClub">
      <div class="trade-head">
        <div class="trade-head-title">
          <strong>Plan Canje iClub</strong>
          <span>Valor estimado para entregar tu iPhone.</span>
        </div>
        <button id="planCanjeClose" class="trade-close" type="button" aria-label="Cerrar cotizador">×</button>
      </div>
      <div id="planCanjeBody" class="trade-body"></div>
    </div>
  `;
  document.body.appendChild(modal);

  byId("planCanjeClose").addEventListener("click", closeTradeIn);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeTradeIn();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.open) closeTradeIn();
  });
}

async function openTradeIn() {
  ensureModal();
  state.open = true;
  byId("planCanjeModal").classList.add("show");
  byId("planCanjeModal").setAttribute("aria-hidden", "false");
  renderTradeIn();
  if (!state.data && !state.loading) {
    state.loading = true;
    renderTradeIn();
    try {
      await planCanjeDiagnosticReady;
      const logic = planCanjeLogic();
      if (!logic?.loadPlanCanjeData) throw new Error("Plan Canje todavia no esta disponible.");
      state.data = await logic.loadPlanCanjeData();
      state.error = "";
      console.info("[ICLUB PLAN CANJE]", {
        sheetName: state.data.sheetName,
        titleRow: state.data.titleRow,
        headerRow: state.data.headerRow,
        dataStartRow: state.data.dataStartRow,
        dataEndRow: state.data.dataEndRow,
        products: state.data.products.length,
      });
    } catch (error) {
      state.error = error.message || "No se pudo cargar Plan Canje.";
      console.warn("[ICLUB PLAN CANJE]", error);
    } finally {
      state.loading = false;
      renderTradeIn();
    }
  }
}

function closeTradeIn() {
  state.open = false;
  byId("planCanjeModal")?.classList.remove("show");
  byId("planCanjeModal")?.setAttribute("aria-hidden", "true");
}

function resetQuote() {
  state.step = 1;
  state.model = "";
  state.capacity = "";
  state.batteryPercent = 90;
  state.needsScreenReplacement = false;
  state.needsBackReplacement = false;
  state.generalCondition = "";
  state.selectedNextProductId = "";
  state.selectedBenefitIds = [];
  state.nextFilters = {
    model: "",
    condition: "",
    capacity: "",
  };
  renderTradeIn();
}

function models() {
  if (!state.data) return [];
  const seen = new Set();
  return state.data.products
    .map((product) => product.model)
    .filter((model) => {
      const key = normalize(model);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function capacitiesForModel(model) {
  if (!state.data) return [];
  const seen = new Set();
  return state.data.products
    .filter((product) => normalize(product.model) === normalize(model))
    .flatMap((product) => product.capacities)
    .filter((capacity) => {
      const key = normalize(capacity);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function selectedProduct() {
  if (!state.data || !state.model || !state.capacity) return null;
  return planCanjeLogic().findPlanCanjeProduct(state.data.byKey, state.model, state.capacity);
}

function hasReportedDamage() {
  return state.needsScreenReplacement || state.needsBackReplacement;
}

function isGeneralConditionDisabled(condition) {
  return condition.value === "EXCELENTE" && hasReportedDamage();
}

function sanitizeGeneralCondition() {
  if (state.generalCondition === "EXCELENTE" && hasReportedDamage()) {
    state.generalCondition = "";
  }
}

function displayModelName(model) {
  return String(model || "")
    .replace(/\bxs\s+max\b/gi, "XS Max")
    .replace(/\bxs\b/gi, "XS")
    .replace(/\bxr\b/gi, "XR")
    .replace(/\bx\b/gi, "X");
}

function discounts(product) {
  if (!product) return { battery: 0, screen: 0, back: 0, final: 0 };
  const battery = Number(state.batteryPercent) <= 86 ? product.batteryReplacement : 0;
  const screen = state.needsScreenReplacement ? product.screenReplacement : 0;
  const back = state.needsBackReplacement ? product.backReplacement : 0;
  const final = planCanjeLogic().calculatePlanCanjeValue(product, {
    batteryPercent: state.batteryPercent,
    needsScreenReplacement: state.needsScreenReplacement,
    needsBackReplacement: state.needsBackReplacement,
  });
  return { battery, screen, back, final };
}

function quoteValue() {
  return discounts(selectedProduct()).final;
}

function catalogApi() {
  return window.iClubCatalog || null;
}

function catalogReady() {
  return Boolean(catalogApi()?.getProducts?.().length);
}

function catalogProducts() {
  const api = catalogApi();
  if (!api?.getAvailableTradeInProducts) return [];
  return api.getAvailableTradeInProducts();
}

function catalogProductById(productId) {
  const api = catalogApi();
  return api?.getProductById?.(productId) || catalogProducts().find((product) => product.id === productId) || null;
}

function nextProductPrice(product) {
  return catalogApi()?.primaryPriceValue?.(product) || 0;
}

function nextProductPriceLabel(product) {
  return catalogApi()?.primaryPrice?.(product) || "";
}

function nextProductModel(product) {
  return catalogApi()?.presentationModel?.(product) || product.model || product.title || "iPhone";
}

function nextProductSpecs(product) {
  return catalogApi()?.presentationSpecs?.(product) || [product.capacity, product.color, product.condition, product.battery].filter(Boolean).join(" · ");
}

function isProductStillAvailable(product) {
  return Boolean(product && catalogApi()?.hasAvailability?.(product) && nextProductPrice(product) > 0);
}

function productConditionGroup(product) {
  const condition = normalize(product.condition);
  if (condition.includes("semi") || condition.includes("usado") || condition.includes("reacondicionado")) return "Seminuevo";
  if (condition.includes("new") || condition.includes("nuevo")) return "Nuevo";
  return catalogApi()?.isUsed?.(product) ? "Seminuevo" : "Nuevo";
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
}

function nextModelOptions() {
  return uniqueSorted(catalogProducts().map(nextProductModel));
}

function nextConditionOptions() {
  return uniqueSorted(catalogProducts()
    .filter((product) => !state.nextFilters.model || nextProductModel(product) === state.nextFilters.model)
    .map(productConditionGroup));
}

function nextCapacityOptions() {
  return uniqueSorted(catalogProducts()
    .filter((product) => !state.nextFilters.model || nextProductModel(product) === state.nextFilters.model)
    .filter((product) => !state.nextFilters.condition || productConditionGroup(product) === state.nextFilters.condition)
    .map((product) => product.capacity));
}

function selectedNextProduct() {
  return catalogProductById(state.selectedNextProductId);
}

function differenceValue(product) {
  return Math.max(0, nextProductPrice(product) - quoteValue());
}

function selectedBenefits() {
  const selected = new Set(state.selectedBenefitIds);
  return BENEFIT_PRODUCTS.filter((benefit) => selected.has(benefit.id));
}

function benefitPriceLabel(benefit, field = "specialPrice") {
  return money(benefit[field]);
}

function totalBenefits() {
  return selectedBenefits().reduce((sum, benefit) => sum + benefit.specialPrice, 0);
}

function benefitsTotalLabel() {
  return money(totalBenefits());
}

function totalFinal(product) {
  return differenceValue(product) + totalBenefits();
}

function totalFinalLabel(product) {
  return money(totalFinal(product));
}

function searchedNextProduct() {
  if (!state.nextFilters.model || !state.nextFilters.condition || !state.nextFilters.capacity) return null;
  return catalogProducts()
    .filter((product) => nextProductModel(product) === state.nextFilters.model)
    .filter((product) => productConditionGroup(product) === state.nextFilters.condition)
    .filter((product) => product.capacity === state.nextFilters.capacity)
    .sort((a, b) => {
      if (b.stock !== a.stock) return b.stock - a.stock;
      if (b.stock24 !== a.stock24) return b.stock24 - a.stock24;
      return nextProductPrice(a) - nextProductPrice(b);
    })[0] || null;
}

function iphoneGeneration(model) {
  const text = normalize(model);
  const number = text.match(/\biphone\s*(\d{2})(?:\b|e\b)/);
  if (number) return Number(number[1]);
  if (text.includes("iphone se")) return 9;
  if (text.includes("iphone xs")) return 10.2;
  if (text.includes("iphone xr")) return 10.1;
  if (text.includes("iphone x")) return 10;
  return 0;
}

function recommendationScore(product) {
  const selected = searchedNextProduct();
  const selectedModel = selected ? nextProductModel(selected) : state.nextFilters.model;
  const selectedGeneration = iphoneGeneration(selectedModel);
  const selectedPrice = selected ? nextProductPrice(selected) : 0;
  const selectedIsPro = isProFamily(selectedModel);
  const productModel = nextProductModel(product);
  const productGeneration = iphoneGeneration(productModel);
  const generationGap = productGeneration && selectedGeneration ? productGeneration - selectedGeneration : 0;
  const sameModel = normalize(productModel) === normalize(selectedModel);
  const sameGeneration = productGeneration && selectedGeneration && productGeneration === selectedGeneration;
  const priceDistance = selectedPrice ? Math.abs(nextProductPrice(product) - selectedPrice) / selectedPrice : 0;
  const conditionSwitch = productConditionGroup(product) !== state.nextFilters.condition ? 0 : 8;
  const availabilityScore = product.stock > 0 ? 0 : (product.stock24 > 0 ? 5 : 10);
  const familyScore = (() => {
    if (sameModel) return 0;
    if (sameGeneration && isProFamily(productModel) && !selectedIsPro) return 8;
    if (generationGap === 1 && !isProFamily(productModel)) return 12;
    if (generationGap === 1 && isProFamily(productModel)) return 18;
    if (generationGap === 0) return 22;
    if (generationGap === -1) return 28;
    return 80 + Math.abs(generationGap) * 12;
  })();
  return familyScore + (priceDistance * 35) + conditionSwitch + availabilityScore;
}

function isProFamily(model) {
  const text = normalize(model);
  return text.includes(" pro");
}

function isCommerciallyCloseRecommendation(product, mainProduct) {
  if (!mainProduct) return false;
  const mainModel = nextProductModel(mainProduct);
  const mainGeneration = iphoneGeneration(mainModel);
  const productGeneration = iphoneGeneration(nextProductModel(product));
  const mainPrice = nextProductPrice(mainProduct);
  const productPrice = nextProductPrice(product);
  const generationGap = productGeneration && mainGeneration ? productGeneration - mainGeneration : 0;
  const priceRatio = mainPrice ? productPrice / mainPrice : 1;
  const sameModel = normalize(nextProductModel(product)) === normalize(mainModel);
  if (sameModel) return true;
  if (!mainGeneration || !productGeneration) return false;
  if (generationGap >= -1 && generationGap <= 1 && priceRatio >= 0.68 && priceRatio <= 1.42) return true;
  if (generationGap === 0 && isProFamily(nextProductModel(product))) return priceRatio <= 1.5;
  return false;
}

function dedupeProductOptions(products) {
  const seen = new Set();
  return products.filter((product) => {
    const key = productRecommendationKey(product);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function productRecommendationKey(product) {
  return normalize(`${nextProductModel(product)}|${product.capacity}|${productConditionGroup(product)}`);
}

function recommendedNextProducts(mainProduct) {
  const mainKey = mainProduct ? productRecommendationKey(mainProduct) : "";
  const sorted = dedupeProductOptions(catalogProducts()
    .filter((product) => product.id !== mainProduct?.id)
    .filter((product) => productRecommendationKey(product) !== mainKey)
    .filter((product) => isCommerciallyCloseRecommendation(product, mainProduct))
    .sort((a, b) => recommendationScore(a) - recommendationScore(b)));

  const pickByCondition = (condition, limit) => sorted
    .filter((product) => productConditionGroup(product) === condition)
    .slice(0, limit);

  const picks = [...pickByCondition("Nuevo", 2), ...pickByCondition("Seminuevo", 2)];
  const pickedIds = new Set(picks.map((product) => product.id));
  const fill = sorted.filter((product) => !pickedIds.has(product.id)).slice(0, 4 - picks.length);
  return [...picks, ...fill].slice(0, 4);
}

function recommendationBadge(product, recommendations) {
  if (!recommendations.length) return "";
  const minDifference = Math.min(...recommendations.map(differenceValue));
  if (differenceValue(product) === minDifference) return "Menor diferencia";
  const model = nextProductModel(product);
  if (isProFamily(model) && !isProFamily(state.nextFilters.model)) {
    const selectedGeneration = iphoneGeneration(state.nextFilters.model);
    const productGeneration = iphoneGeneration(model);
    if (selectedGeneration && productGeneration && Math.abs(productGeneration - selectedGeneration) <= 1) return "Subí a Pro";
  }
  if (product === recommendations[0]) return "Opción recomendada";
  return "";
}

function whatsappUrlForOperation(product, difference) {
  const benefits = selectedBenefits();
  const lines = [
    "👋 Hola iClub! Quiero avanzar con mi Plan Canje.",
    "",
    "📱 *Entrego*",
    `${displayModelName(state.model)} · ${state.capacity}`,
    `Batería: ${state.batteryPercent}%`,
    `Valor estimado: *${money(quoteValue())}*`,
    "",
    "✨ *Elegí*",
    `${nextProductModel(product)} · ${product.capacity || "Capacidad a confirmar"} · ${productConditionGroup(product)}`,
    product.color ? `Color: ${product.color}` : "",
    `Precio efectivo: ${nextProductPriceLabel(product)}`,
    "",
    `🔄 *Diferencia Plan Canje: ${money(difference)}*`,
    "",
    benefits.length ? "🎁 *Beneficios que agregué*" : null,
    ...benefits.map((benefit) => `${benefit.whatsappIcon ? `${benefit.whatsappIcon} ` : ""}${benefit.name} — ${benefitPriceLabel(benefit)}`),
    benefits.length ? "" : null,
    `*Total estimado: ${totalFinalLabel(product)}*`,
    "",
    "Quiero avanzar con esta opción y confirmar disponibilidad.",
  ].filter((line) => line !== null && line !== undefined);
  return `${WHATSAPP_URL}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function renderTradeIn() {
  const body = byId("planCanjeBody");
  if (!body) return;
  sanitizeGeneralCondition();
  if (state.loading) {
    body.innerHTML = `
      ${progressTemplate()}
      <div class="trade-step">
        <div class="trade-step-title">
          <h3>Cargando Plan Canje</h3>
          <p>Estamos leyendo los valores actualizados desde Google Sheet.</p>
        </div>
      </div>
    `;
    return;
  }
  if (state.error) {
    body.innerHTML = `
      ${progressTemplate()}
      <div class="trade-step">
        <div class="trade-step-title">
          <h3>No pude cargar Plan Canje</h3>
          <p>${escapeHtml(state.error)}</p>
        </div>
        <div class="trade-actions">
          <button class="trade-button secondary" type="button" data-trade-action="retry">Reintentar</button>
        </div>
      </div>
    `;
    bindActions();
    return;
  }
  const templates = {
    1: stepModel,
    2: stepCapacity,
    3: stepBattery,
    4: stepCondition,
    5: stepGeneralCondition,
    6: stepResult,
    7: stepNextIphone,
    8: stepBenefits,
    9: stepDifference,
  };
  body.innerHTML = `${progressTemplate()}${templates[state.step]()}`;
  bindActions();
}

function progressTemplate() {
  const visualStep = Math.min(state.step, TOTAL_STEPS);
  return `
    <div class="trade-progress" aria-hidden="true">
      ${Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((step) => `<span class="${step <= visualStep ? "active" : ""}"></span>`).join("")}
    </div>
  `;
}

function stepModel() {
  return `
    <div class="trade-step">
      <div class="trade-step-title">
        <h3>¿Qué iPhone tenés?</h3>
        <p>Elegí el modelo que querés entregar en Plan Canje.</p>
      </div>
      <div class="trade-options">
        ${models().map((model) => optionButton(displayModelName(model), state.model === model, "model", model)).join("")}
      </div>
      ${actionsTemplate({ nextDisabled: !state.model, showBack: false })}
    </div>
  `;
}

function stepCapacity() {
  return `
    <div class="trade-step">
      <div class="trade-step-title">
        <h3>¿Qué capacidad tiene?</h3>
        <p>Mostramos solo las capacidades disponibles para ${escapeHtml(displayModelName(state.model))}.</p>
      </div>
      <div class="trade-options">
        ${capacitiesForModel(state.model).map((capacity) => optionButton(capacity, state.capacity === capacity, "capacity")).join("")}
      </div>
      ${actionsTemplate({ nextDisabled: !state.capacity })}
    </div>
  `;
}

function stepBattery() {
  return `
    <div class="trade-step">
      <div class="trade-step-title">
        <h3>¿Qué porcentaje de batería tiene?</h3>
      </div>
      <div class="trade-field">
        <label for="tradeBattery">Batería ${state.batteryPercent}%</label>
        <div class="trade-battery-row">
          <input id="tradeBatteryRange" type="range" min="1" max="100" value="${state.batteryPercent}">
          <input id="tradeBattery" type="number" min="1" max="100" value="${state.batteryPercent}" inputmode="numeric">
        </div>
      </div>
      ${actionsTemplate({ nextDisabled: false })}
    </div>
  `;
}

function stepCondition() {
  return `
    <div class="trade-step">
      <div class="trade-step-title">
        <h3>Estado del equipo</h3>
      </div>
      <div class="trade-field">
        <label>¿La pantalla se encuentra dañada?</label>
        <div class="trade-choices">
          ${optionButton("No", !state.needsScreenReplacement, "screen", "false")}
          ${optionButton("Sí", state.needsScreenReplacement, "screen", "true")}
        </div>
      </div>
      <div class="trade-field">
        <label>¿La tapa trasera se encuentra dañada?</label>
        <div class="trade-choices">
          ${optionButton("No", !state.needsBackReplacement, "back", "false")}
          ${optionButton("Sí", state.needsBackReplacement, "back", "true")}
        </div>
      </div>
      ${actionsTemplate({ nextDisabled: false })}
    </div>
  `;
}

function stepGeneralCondition() {
  return `
    <div class="trade-step">
      <div class="trade-step-title">
        <h3>¿En qué estado general se encuentra tu iPhone?</h3>
        <p>Elegí la opción que mejor lo represente.</p>
      </div>
      <div class="trade-condition-grid">
        ${GENERAL_CONDITIONS.map((condition) => generalConditionButton(condition)).join("")}
      </div>
      ${actionsTemplate({ nextLabel: "Ver cotización", nextDisabled: !state.generalCondition })}
    </div>
  `;
}

function stepResult() {
  const product = selectedProduct();
  if (!product) return "";
  const values = discounts(product);
  if (values.final === 0) {
    return `
      <div class="trade-step">
        <div class="trade-review">
          <h3>Requiere revisión personalizada</h3>
          <p>Por el estado informado del equipo necesitamos revisarlo antes de confirmar un valor de toma.</p>
          <a class="trade-button" href="${WHATSAPP_URL}" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
        </div>
        ${actionsTemplate({ nextLabel: "Ver diferencia con mi próximo iPhone", nextDisabled: false, nextAction: "chooseNext" })}
      </div>
    `;
  }
  return `
    <div class="trade-step trade-summary">
      <div class="trade-step-title">
        <h3>Tu cotización iClub</h3>
      </div>
      <div class="trade-summary-card">
        <div class="trade-summary-model">
          <strong>${escapeHtml(displayModelName(product.model))} · ${escapeHtml(state.capacity)}</strong>
        </div>
        <div class="trade-public-details">
          <span>Batería informada: ${state.batteryPercent}%</span>
          <span>Estado general: ${escapeHtml(state.generalCondition)}</span>
        </div>
        <div class="trade-final">
          <span>Valor estimado de tu iPhone</span>
          <strong>${money(values.final)}</strong>
        </div>
        <p class="trade-summary-note">Valor estimado sujeto a revisión física del equipo por parte de iClub.</p>
      </div>
      ${actionsTemplate({ nextLabel: "Ver diferencia con mi próximo iPhone", nextDisabled: false, nextAction: "chooseNext" })}
    </div>
  `;
}

function stepNextIphone() {
  if (!catalogApi()) {
    return `
      <div class="trade-step">
        <div class="trade-step-title">
          <h3>¿Qué iPhone estás buscando?</h3>
          <p>El catálogo todavía no está disponible en esta sesión.</p>
        </div>
        ${actionsTemplate({ nextLabel: "Continuar con este iPhone", nextDisabled: true })}
      </div>
    `;
  }

  if (!catalogReady()) {
    return `
      <div class="trade-step">
        <div class="trade-step-title">
          <h3>¿Qué iPhone estás buscando?</h3>
          <p>Estamos esperando que termine de cargar el catálogo actual de iClub.</p>
        </div>
        ${actionsTemplate({ nextLabel: "Continuar con este iPhone", nextDisabled: true })}
      </div>
    `;
  }

  const mainProduct = searchedNextProduct();
  const recommendations = state.nextFilters.model && state.nextFilters.condition && state.nextFilters.capacity
    ? recommendedNextProducts(mainProduct)
    : [];
  const selected = selectedNextProduct();
  return `
    <div class="trade-step">
      <div class="trade-step-title">
        <h3>¿Qué iPhone estás buscando?</h3>
        <p>Elegí el equipo al que te gustaría cambiar.</p>
      </div>
      <div class="trade-shop-filters">
        ${selectTemplate("model", "Modelo", "Elegí modelo", nextModelOptions(), state.nextFilters.model)}
        ${selectTemplate("condition", "Condición", "Nuevo / Seminuevo", nextConditionOptions(), state.nextFilters.condition, !state.nextFilters.model)}
        ${selectTemplate("capacity", "Capacidad", "Elegí capacidad", nextCapacityOptions(), state.nextFilters.capacity, !state.nextFilters.model || !state.nextFilters.condition)}
      </div>
      ${state.nextFilters.model && state.nextFilters.condition && state.nextFilters.capacity ? `
        ${mainProduct ? `
          <div class="trade-main-match">
            ${nextProductCard(mainProduct, { featured: true })}
          </div>
        ` : '<div class="trade-empty">No encontramos una variante disponible con precio efectivo para esa búsqueda.</div>'}
        ${recommendations.length ? `
          <div class="trade-recommendations">
            <h4>OTRAS OPCIONES PARA VOS</h4>
            <div class="trade-next-grid">
              ${recommendations.map((product) => nextProductCard(product, { badge: recommendationBadge(product, recommendations) })).join("")}
            </div>
          </div>
        ` : ""}
      ` : ""}
      ${actionsTemplate({ nextLabel: "Continuar con este iPhone", nextDisabled: !selected, nextAction: "showBenefits" })}
    </div>
  `;
}

function stepDifference() {
  const product = selectedNextProduct();
  if (!isProductStillAvailable(product)) {
    return `
      <div class="trade-step">
        <div class="trade-review">
          <h3>Este equipo ya no aparece disponible.</h3>
          <p>Elegí otra opción para continuar con el Plan Canje.</p>
        </div>
        ${actionsTemplate({ nextLabel: "Elegir otra opción", nextDisabled: false, nextAction: "chooseNext" })}
      </div>
    `;
  }

  const difference = differenceValue(product);
  if (quoteValue() >= nextProductPrice(product)) {
    return `
      <div class="trade-step">
        <div class="trade-review">
          <h3>Consultá esta operación con iClub</h3>
          <p>El valor estimado de tu equipo alcanza o supera el precio del producto elegido. Necesitamos revisar la operación personalmente.</p>
          <a class="trade-button" href="${escapeAttr(whatsappUrlForOperation(product, difference))}" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
        </div>
        ${actionsTemplate({ nextLabel: "Cambiar iPhone elegido", nextDisabled: false, nextAction: "chooseNext" })}
      </div>
    `;
  }

  const benefits = selectedBenefits();
  const benefitsTotal = benefitsTotalLabel();
  const finalTotal = totalFinalLabel(product);
  return `
    <div class="trade-step trade-summary">
      <div class="trade-step-title">
        <h3>TU PLAN CANJE</h3>
      </div>
      <div class="trade-change-card">
        <div class="trade-change-section">
          <span>Entregás</span>
          <strong>${escapeHtml(displayModelName(state.model))} · ${escapeHtml(state.capacity)}</strong>
          <small>Valor estimado: ${money(quoteValue())}</small>
        </div>
        <div class="trade-change-section">
          <span>Te llevás</span>
          <strong>${escapeHtml(nextProductModel(product))} · ${escapeHtml(product.capacity || "Capacidad a confirmar")} · ${escapeHtml(productConditionGroup(product))}</strong>
          <small>${escapeHtml([product.color, product.battery].filter(Boolean).join(" · "))}</small>
          <small>Precio efectivo: ${escapeHtml(nextProductPriceLabel(product))}</small>
        </div>
        ${benefits.length ? `
          <div class="trade-benefit-summary final">
            <span>Beneficios agregados</span>
            ${benefits.map((benefit) => `<div><strong>${escapeHtml(benefit.name)}</strong><small>${benefitPriceLabel(benefit)}</small></div>`).join("")}
          </div>
          <div class="trade-total-breakdown">
            <div><span>Diferencia Plan Canje</span><strong>${money(difference)}</strong></div>
            <div><span>Beneficios</span><strong>${benefitsTotal}</strong></div>
          </div>
          <div class="trade-final difference total">
            <span>TOTAL A ABONAR</span>
            <strong>${finalTotal}</strong>
            <small>${escapeHtml(nextProductModel(product))} + beneficios seleccionados</small>
          </div>
        ` : `
          <div class="trade-final difference">
            <span>DIFERENCIA A ABONAR:</span>
            <strong>${money(difference)}</strong>
          </div>
        `}
        <p class="trade-summary-note">Valores sujetos a disponibilidad y revisión física del equipo entregado.</p>
      </div>
      <div class="trade-actions">
        <button class="trade-button secondary" type="button" data-trade-action="chooseNext">Elegir otro iPhone</button>
        <div class="trade-actions-right">
          <a class="trade-button" href="${escapeAttr(whatsappUrlForOperation(product, difference))}" target="_blank" rel="noreferrer">Quiero avanzar por WhatsApp</a>
        </div>
      </div>
    </div>
  `;
}

function stepBenefits() {
  const product = selectedNextProduct();
  if (!isProductStillAvailable(product)) {
    return `
      <div class="trade-step">
        <div class="trade-review">
          <h3>Este equipo ya no aparece disponible.</h3>
          <p>Elegí otra opción para continuar con el Plan Canje.</p>
        </div>
        ${actionsTemplate({ nextLabel: "Elegir otra opción", nextDisabled: false, nextAction: "chooseNext" })}
      </div>
    `;
  }

  const benefits = selectedBenefits();
  return `
    <div class="trade-step">
      <div class="trade-step-title">
        <h3>Tu iPhone desbloqueó beneficios especiales</h3>
        <p>Por elegir este equipo, podés sumar productos seleccionados con precio especial.</p>
      </div>
      <div class="trade-benefits-grid">
        ${BENEFIT_PRODUCTS.map(benefitCard).join("")}
      </div>
      <div class="trade-benefit-summary">
        <span>Beneficios seleccionados: ${benefitsTotalLabel()}</span>
        ${benefits.length
          ? benefits.map((benefit) => `<div><strong>${escapeHtml(benefit.name)}</strong><small>${benefitPriceLabel(benefit)}</small></div>`).join("")
          : `<p>Podés continuar sin agregar beneficios.</p>`}
      </div>
      <div class="trade-actions">
        <button class="trade-button secondary" type="button" data-trade-action="skipBenefits">Seguir sin agregar beneficios</button>
        <div class="trade-actions-right">
          <button class="trade-button" type="button" data-trade-action="showDifference">Continuar con mi Plan Canje</button>
        </div>
      </div>
    </div>
  `;
}

function optionButton(label, selected, type, value = label) {
  return `<button class="trade-option ${selected ? "selected" : ""}" type="button" data-trade-select="${type}" data-value="${escapeAttr(value)}">${escapeHtml(label)}</button>`;
}

function generalConditionButton(condition) {
  const selected = state.generalCondition === condition.value;
  const disabled = isGeneralConditionDisabled(condition);
  return `
    <button class="trade-condition-option ${selected ? "selected" : ""} ${disabled ? "disabled" : ""} ${escapeAttr(condition.tone)}" type="button" data-trade-select="generalCondition" data-value="${escapeAttr(condition.value)}" ${disabled ? "disabled aria-disabled=\"true\"" : ""}>
      <span class="trade-phone-pair" aria-hidden="true">
        <span class="trade-phone-illustration front ${escapeAttr(condition.tone)}">
          <span class="phone-speaker"></span>
          ${condition.marks.front}
        </span>
      </span>
      <span class="trade-condition-copy">
        <strong>${escapeHtml(condition.title)}</strong>
        <span>${escapeHtml(condition.description)}</span>
        ${disabled ? '<em>No disponible según el estado informado.</em>' : ""}
      </span>
    </button>
  `;
}

function selectTemplate(field, label, placeholder, options, value, disabled = false) {
  return `
    <label class="trade-select-label">
      <span>${escapeHtml(label)}</span>
      <select data-trade-filter="${escapeAttr(field)}" ${disabled ? "disabled" : ""}>
        <option value="">${escapeHtml(placeholder)}</option>
        ${options.map((option) => `<option value="${escapeAttr(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function nextProductCard(product, options = {}) {
  const selected = state.selectedNextProductId === product.id;
  const model = nextProductModel(product);
  const difference = differenceValue(product);
  const specs = [product.capacity, productConditionGroup(product)].filter(Boolean).join(" · ");
  const photo = product.photo && /^https?:\/\//i.test(product.photo)
    ? `<img src="${escapeAttr(product.photo)}" alt="${escapeAttr(product.title)}" loading="lazy" onerror="this.replaceWith(window.placeholderNode('${escapeAttr(model)}'))">`
    : `<div class="trade-product-placeholder">${escapeHtml(catalogApi()?.shortModel?.(model) || model)}</div>`;
  return `
    <button class="trade-product-option ${options.featured ? "featured" : ""} ${selected ? "selected" : ""}" type="button" data-trade-select="nextProduct" data-value="${escapeAttr(product.id)}">
      <span class="trade-product-photo">${photo}</span>
      <span class="trade-product-copy">
        ${options.badge ? `<i>${escapeHtml(options.badge)}</i>` : ""}
        <strong>${escapeHtml(model)}</strong>
        ${specs ? `<span>${escapeHtml(specs)}</span>` : ""}
        ${options.featured ? `
          <span>Precio efectivo: ${escapeHtml(nextProductPriceLabel(product))}</span>
          <span>Tu iPhone: ${money(quoteValue())}</span>
          <em>DIFERENCIA A ABONAR</em>
        ` : ""}
        <b>+ ${money(difference)}</b>
        <small>para cambiar tu iPhone</small>
      </span>
    </button>
  `;
}

function benefitCard(benefit) {
  const selected = state.selectedBenefitIds.includes(benefit.id);
  return `
    <button class="trade-benefit-card ${selected ? "selected" : ""}" type="button" data-trade-benefit="${escapeAttr(benefit.id)}">
      <span class="trade-benefit-image">
        <img src="${escapeAttr(benefit.image)}" alt="${escapeAttr(benefit.name)}" loading="lazy">
      </span>
      <span class="trade-benefit-copy">
        <strong>${escapeHtml(benefit.name)}</strong>
        <span><i>Precio habitual:</i><s>${benefitPriceLabel(benefit, "referencePrice")}</s>${benefit.discountLabel ? `<b>${escapeHtml(benefit.discountLabel)}</b>` : ""}</span>
        <em>${benefitPriceLabel(benefit)}</em>
        ${benefit.note ? `<u>${escapeHtml(benefit.note)}</u>` : ""}
        <small>${selected ? "Agregado ✓" : "Agregar"}</small>
      </span>
    </button>
  `;
}

function actionsTemplate(options = {}) {
  const nextAction = options.nextAction || "next";
  return `
    <div class="trade-actions">
      ${options.showBack === false ? "" : `<button class="trade-button secondary" type="button" data-trade-action="back">Atrás</button>`}
      <div class="trade-actions-right">
        ${state.step === STEP_QUOTE_RESULT ? `<button class="trade-button secondary" type="button" data-trade-action="reset">Volver a cotizar</button>` : ""}
        <button class="trade-button" type="button" data-trade-action="${nextAction}" ${options.nextDisabled ? "disabled" : ""}>
          ${options.nextLabel || "Siguiente"}
        </button>
      </div>
    </div>
  `;
}

function bindActions() {
  document.querySelectorAll("[data-trade-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.tradeSelect;
      const value = button.dataset.value;
      if (type === "model") {
        state.model = value;
        state.capacity = "";
      }
      if (type === "capacity") state.capacity = value;
      if (type === "screen") state.needsScreenReplacement = value === "true";
      if (type === "back") state.needsBackReplacement = value === "true";
      if (type === "generalCondition") state.generalCondition = value;
      if (type === "nextProduct") state.selectedNextProductId = value;
      sanitizeGeneralCondition();
      renderTradeIn();
    });
  });

  document.querySelectorAll("[data-trade-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      const field = select.dataset.tradeFilter;
      state.nextFilters[field] = select.value;
      if (field === "model") {
        state.nextFilters.condition = "";
        state.nextFilters.capacity = "";
      }
      if (field === "condition") {
        state.nextFilters.capacity = "";
      }
      state.selectedNextProductId = "";
      renderTradeIn();
    });
  });

  document.querySelectorAll("[data-trade-benefit]").forEach((button) => {
    button.addEventListener("click", () => {
      const benefitId = button.dataset.tradeBenefit;
      if (state.selectedBenefitIds.includes(benefitId)) {
        state.selectedBenefitIds = state.selectedBenefitIds.filter((id) => id !== benefitId);
      } else {
        state.selectedBenefitIds = [...state.selectedBenefitIds, benefitId];
      }
      renderTradeIn();
    });
  });

  document.querySelectorAll("[data-trade-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.tradeAction;
      if (action === "next") state.step = Math.min(TOTAL_STEPS, state.step + 1);
      if (action === "back") state.step = Math.max(1, state.step - 1);
      if (action === "reset") resetQuote();
      if (action === "chooseNext") state.step = STEP_NEXT_IPHONE;
      if (action === "showDifference") {
        state.step = STEP_DIFFERENCE;
      }
      if (action === "skipBenefits") {
        state.selectedBenefitIds = [];
        state.step = STEP_DIFFERENCE;
      }
      if (action === "showBenefits") state.step = STEP_BENEFITS;
      if (action === "retry") {
        state.error = "";
        state.data = null;
        openTradeIn();
        return;
      }
      if (action === "continue") {
        console.info("[ICLUB PLAN CANJE] Continuar queda preparado para la siguiente etapa.");
      }
      renderTradeIn();
    });
  });

  ["tradeBattery", "tradeBatteryRange"].forEach((id) => {
    const input = byId(id);
    if (!input) return;
    input.addEventListener("input", () => {
      const value = Math.min(100, Math.max(1, Number(input.value) || 1));
      state.batteryPercent = value;
      const otherId = id === "tradeBattery" ? "tradeBatteryRange" : "tradeBattery";
      const other = byId(otherId);
      if (other) other.value = value;
      renderTradeIn();
    });
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function bindTradeInEntry() {
  byId("planCanjeOpen")?.addEventListener("click", openTradeIn);
}

window.iClubOpenPlanCanje = openTradeIn;
bindTradeInEntry();
ensureModal();
