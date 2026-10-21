(() => {
  let dialog;
  let file;
  let objectUrl;
  let requestId = 0;
  const icon = (paths) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "share-card-dialog";
    dialog.setAttribute("aria-labelledby", "shareCardTitle");
    dialog.innerHTML = `
      <div class="share-card-header"><h2 id="shareCardTitle">Compartir tarjeta</h2><button class="share-card-close" aria-label="Cerrar" type="button">${icon('<path d="m6 6 12 12M6 18 18 6"/>')}</button></div>
      <img class="share-card-preview" alt="Vista previa de la tarjeta iClub" hidden>
      <p class="share-card-status" role="status" aria-live="polite"></p>
      <div class="share-card-controls">
        <button type="button" data-share-action="share">${icon('<path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/>')}Compartir</button>
        <button type="button" data-share-action="copy">${icon('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>')}Copiar imagen</button>
        <button type="button" data-share-action="download">${icon('<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>')}Descargar</button>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector(".share-card-close").onclick = () => dialog.close();
    dialog.addEventListener("close", () => {
      requestId += 1;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      file = null;
    });
    dialog.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-share-action]")?.dataset.shareAction;
      if (!action || !file) return;
      const currentFile = file;
      const status = dialog.querySelector(".share-card-status");
      try {
        if (action === "share") await navigator.share({ files: [currentFile] });
        if (action === "copy") {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": currentFile })]);
          status.textContent = "Imagen copiada.";
        }
        if (action === "download") {
          const link = document.createElement("a");
          const url = URL.createObjectURL(currentFile);
          link.href = url;
          link.download = currentFile.name;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          status.textContent = "Tarjeta descargada.";
        }
      } catch (error) {
        if (error.name !== "AbortError") status.textContent = "No se pudo compartir por esta vía. Podés descargar la tarjeta.";
      }
    });
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      const timer = setTimeout(() => { image.src = ""; reject(new Error("La foto tardó demasiado. Volvé a intentar.")); }, 15000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("No pudimos preparar la foto para compartir. Volvé a intentar.")); };
      image.src = url;
    });
  }

  function contain(ctx, image, x, y, width, height) {
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
  }

  function exportPhotoUrl(photo) {
    const url = new URL(photo, document.baseURI);
    if (url.hostname === "drive.google.com") {
      const id = url.searchParams.get("id") || url.pathname.match(/\/d\/([^/]+)/)?.[1];
      if (id && /^[a-zA-Z0-9_-]+$/.test(id)) return `https://lh3.googleusercontent.com/d/${id}=w1200`;
    }
    return url.href;
  }

  async function createCard(data) {
    if (!data.photo) throw new Error("Esperá a que cargue la foto del equipo y volvé a intentar.");
    const [photo, logo] = await Promise.all([
      loadImage(exportPhotoUrl(data.photo)),
      loadImage(window.iClubShareLogo || new URL("assets/logo-iclub-oficial.png", document.baseURI).href),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1800;
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    contain(ctx, logo, 330, 32, 240, 100);
    ctx.fillStyle = "#f5f6f8";
    ctx.fillRect(32, 154, 836, 530);
    contain(ctx, photo, 62, 176, 776, 486);
    let y = 728;
    function text(value, size, color = "#111318", weight = 700) {
      ctx.font = `${weight} ${size}px Arial, sans-serif`;
      ctx.fillStyle = color;
      const words = String(value || "").split(/\s+/);
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > 788) {
          ctx.fillText(line, 56, y);
          y += size * 1.3;
          line = word;
        } else line = next;
      }
      // Shrink an unusually long unbroken model or specification to fit.
      const measured = ctx.measureText(line).width;
      if (measured > 788) ctx.font = `${weight} ${Math.floor(size * 788 / measured)}px Arial, sans-serif`;
      ctx.fillText(line, 56, y);
      y += size * 1.3;
    }
    text(data.model, 42);
    y += 6;
    text(data.specs, 26, "#5f6673");
    y += 20;
    text(data.cash, 66);
    if (data.equivalent) text(data.equivalent, 30, "#5f6673");
    text("PROMO EFECTIVO", 23, "#0071e3");
    if (data.promotion) {
      y += 16;
      ctx.fillStyle = "#e8f7ee";
      ctx.fillRect(40, y - 24, 820, 108);
      text(data.promotion.label, 24, "#087849");
      text(data.promotion.value, 34, "#075e3c");
    }
    y += 20;
    text(data.availability.label, 26, data.availability.className.includes("now") ? "#087849" : "#76531a");
    y += 18;
    text(`Transferencia: ${data.transfer}`, 28);
    text(`Precio de lista: ${data.list}`, 28);
    if (data.installment) {
      y += 16;
      text("6 CUOTAS SIN INTERÉS", 23, "#0071e3");
      text(`${data.installment} por cuota`, 30);
    }
    y += 30;
    ctx.strokeStyle = "#d6dae1";
    ctx.beginPath(); ctx.moveTo(56, y); ctx.lineTo(844, y); ctx.stroke();
    y += 38;
    text("Precios y disponibilidad sujetos a confirmación.", 22, "#5f6673", 400);
    text(new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }), 22, "#5f6673", 400);
    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = Math.ceil(y + 20);
    output.getContext("2d").drawImage(canvas, 0, 0);
    const blob = await new Promise((resolve) => output.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("No se pudo generar la tarjeta.");
    const slug = `${data.model}-${data.specs}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/-$/, "").slice(0, 110);
    return new File([blob], `iClub-${slug}.png`, { type: "image/png" });
  }

  async function createQuoteCard(data) {
    const logo = await loadImage(window.iClubShareLogo || new URL("assets/logo-iclub-oficial.png", document.baseURI).href);
    const measure = document.createElement("canvas").getContext("2d");
    const draw = [];
    let y = 176;
    const width = 900;
    function text(value, size, color = "#111318", weight = 700, centered = false) {
      measure.font = `${weight} ${size}px Arial, sans-serif`;
      const lines = [];
      let line = "";
      for (const word of String(value || "").split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && measure.measureText(next).width > 756) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      for (const value of lines) {
        const fontSize = Math.min(size, Math.floor(size * 756 / Math.max(1, measure.measureText(value).width)));
        const top = y;
        draw.push(ctx => {
          ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
          ctx.fillStyle = color;
          ctx.textAlign = centered ? "center" : "left";
          ctx.fillText(value, centered ? width / 2 : 72, top);
        });
        y += size * 1.35;
      }
    }
    text(data.title, 40, "#111318", 700, true);
    y += 30;
    for (const section of data.sections) {
      text(section.label, 24, "#5f6673");
      y += 6;
      if (section.title) text(section.title, 34);
      for (const detail of section.details) text(detail, 26, "#444c58", 400);
      y += 30;
    }
    const resultTop = y;
    const resultIndex = draw.length;
    y += 30;
    text(data.result.label, 26, "#444c58", 700, true);
    y += 12;
    text(data.result.amount, 82, "#111318", 700, true);
    y += 20;
    text(data.note, 24, "#5f6673", 400, true);
    y += 30;
    const resultHeight = y - resultTop;
    draw.splice(resultIndex, 0, ctx => {
      ctx.fillStyle = "#edf0f2";
      ctx.fillRect(40, resultTop, 820, resultHeight);
    });
    y += 32;
    const date = new Date(data.timestamp).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    text(`Cotización del ${date}`, 22, "#5f6673", 400, true);
    y += 28;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.ceil(y);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.textBaseline = "top";
    contain(ctx, logo, 330, 32, 240, 100);
    draw.forEach(paint => paint(ctx));
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("No se pudo generar la cotización.");
    const slug = data.filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 110);
    return new File([blob], `iClub-${slug}.png`, { type: "image/png" });
  }

  async function openData(data, quote = false) {
    if (!data) return;
    ensureDialog();
    const id = ++requestId;
    dialog.querySelector("h2").textContent = quote ? "Compartir cotización" : "Compartir tarjeta";
    file = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    const preview = dialog.querySelector("img");
    preview.alt = quote ? "Vista previa de la cotización iClub" : "Vista previa de la tarjeta iClub";
    preview.hidden = true;
    preview.removeAttribute("src");
    const status = dialog.querySelector(".share-card-status");
    status.textContent = "Preparando tarjeta…";
    dialog.querySelectorAll("[data-share-action]").forEach((button) => { button.disabled = true; });
    if (!dialog.open) dialog.showModal();
    try {
      const generated = await (quote ? createQuoteCard(data) : createCard(data));
      if (id !== requestId || !dialog.open) return;
      file = generated;
      objectUrl = URL.createObjectURL(file);
      preview.src = objectUrl;
      preview.hidden = false;
      status.textContent = "";
      dialog.querySelector('[data-share-action="share"]').hidden = !navigator.canShare?.({ files: [file] });
      dialog.querySelector('[data-share-action="copy"]').hidden = !(window.ClipboardItem && navigator.clipboard?.write);
      dialog.querySelectorAll("[data-share-action]").forEach((button) => { button.disabled = false; });
    } catch (error) {
      if (id === requestId) status.textContent = error.message || "No se pudo preparar la tarjeta.";
    }
  }

  window.iClubShare = {
    openQuote(data) { return openData(data, true); },
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-share-card-id]");
    if (!trigger) return;
    event.preventDefault();
    openData(window.iClubCatalog?.getShareCard(trigger.dataset.shareCardId));
  });
})();
