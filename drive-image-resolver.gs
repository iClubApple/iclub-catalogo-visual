const CONFIG = {
  spreadsheetId: '1yIchT-R7KSY5NuIcfjMuYRjPjbQaZ3j5LdcfXee2USY',
  sheetName: 'STOCK EQUIPOS Y OFERTAS',
  photoColumn: 2,
  modelColumn: 3,
  firstDataRow: 3,
  thumbnailSize: 1200,
};

const VALID_IMAGE_MIME_TYPES = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
};

function doGet(event) {
  const params = event && event.parameter ? event.parameter : {};
  const callback = String(params.callback || '').trim();

  const payload = buildImagePayload(params);
  const json = JSON.stringify(payload);
  const body = callback ? `${callback}(${json});` : json;

  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function buildImagePayload(params) {
  try {
    const spreadsheetId = String(params.spreadsheetId || CONFIG.spreadsheetId).trim();
    const sheetName = String(params.sheetName || CONFIG.sheetName).trim();
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('No existe la pestaña: ' + sheetName);
    }

    const rows = getRequestedRows(params, sheet);
    const folderCache = {};
    const products = {};
    const summary = [];

    rows.forEach(function(rowNumber) {
      const result = resolveRowImages(sheet, rowNumber, folderCache);
      products[String(rowNumber)] = result;
      summary.push({
        row: rowNumber,
        label: result.label,
        imageCount: result.images.length,
        mainImage: result.mainImage,
        error: result.error,
      });
    });

    return {
      success: true,
      sheetName: sheetName,
      products: products,
      summary: summary,
    };
  } catch (error) {
    return {
      success: false,
      products: {},
      summary: [],
      error: error.message,
    };
  }
}

function getRequestedRows(params, sheet) {
  const explicitRows = String(params.rows || '')
    .split(',')
    .map(function(value) { return Number(String(value).trim()); })
    .filter(function(value) { return Number.isFinite(value) && value > 0; });

  if (explicitRows.length) return explicitRows;

  const startRow = Math.max(Number(params.startRow || CONFIG.firstDataRow), 1);
  const endRow = Math.min(Number(params.endRow || sheet.getLastRow()), sheet.getLastRow());
  const rows = [];

  for (var row = startRow; row <= endRow; row += 1) {
    rows.push(row);
  }

  return rows;
}

function resolveRowImages(sheet, rowNumber, folderCache) {
  const photoCell = sheet.getRange(rowNumber, CONFIG.photoColumn);
  const label = getProductLabel(sheet, rowNumber);
  const folderUrl = getCellLinkUrl(photoCell);
  const folderId = extractDriveFolderId(folderUrl);

  const base = {
    label: label,
    folderUrl: folderUrl || '',
    folderId: folderId || '',
    mainImage: '',
    images: [],
    files: [],
    error: '',
  };

  if (!String(photoCell.getDisplayValue() || '').trim()) {
    base.error = 'Celda B vacía.';
    return base;
  }

  if (!folderUrl) {
    base.error = 'Celda B sin hipervínculo.';
    return base;
  }

  if (!folderId) {
    base.error = 'El hipervínculo de B no es una carpeta de Google Drive.';
    return base;
  }

  if (!folderCache[folderId]) {
    folderCache[folderId] = resolveFolderImages(folderId);
  }

  const resolved = folderCache[folderId];
  base.files = resolved.files || [];
  base.images = resolved.images || [];
  base.mainImage = base.images[0] || '';
  base.error = resolved.error || '';

  if (!base.error && !base.images.length) {
    base.error = 'La carpeta no contiene JPG, JPEG, PNG ni WEBP.';
  }

  return base;
}

function resolveFolderImages(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const imageFiles = [];

    while (files.hasNext()) {
      const file = files.next();
      const id = file.getId();
      const name = file.getName();
      const mimeType = file.getMimeType();

      if (!isSupportedImage(mimeType, name)) continue;

      imageFiles.push({
        id: id,
        name: name,
        mimeType: mimeType,
        url: makeDriveThumbnailUrl(id),
        fileUrl: 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/view',
      });
    }

    imageFiles.sort(function(a, b) {
      return String(a.name).localeCompare(String(b.name), 'es');
    });

    return {
      files: imageFiles,
      images: imageFiles.map(function(file) { return file.url; }),
      error: '',
    };
  } catch (error) {
    return {
      files: [],
      images: [],
      error: normalizeDriveError(error),
    };
  }
}

function getProductLabel(sheet, rowNumber) {
  const model = sheet.getRange(rowNumber, CONFIG.modelColumn).getDisplayValue();
  return String(model || 'Fila ' + rowNumber).trim();
}

function getCellLinkUrl(cell) {
  const displayValue = String(cell.getDisplayValue() || '').trim();
  if (/^https?:\/\//i.test(displayValue)) return displayValue;

  const richText = cell.getRichTextValue();

  if (richText && richText.getLinkUrl()) {
    return richText.getLinkUrl();
  }

  if (richText) {
    const runs = richText.getRuns();
    for (var index = 0; index < runs.length; index += 1) {
      const link = runs[index].getLinkUrl();
      if (link) return link;
    }
  }

  const formula = String(cell.getFormula() || '');
  const formulaMatch = formula.match(/HYPERLINK\("([^"]+)"/i);
  if (formulaMatch) return formulaMatch[1];

  return '';
}

function extractDriveFolderId(url) {
  const text = String(url || '');
  const folderMatch = text.match(/drive\.google\.com\/drive\/folders\/([^/?#]+)/i);
  if (folderMatch) return folderMatch[1];

  const queryMatch = text.match(/[?&]folderId=([^&#]+)/i);
  if (queryMatch) return queryMatch[1];

  return '';
}

function isSupportedImage(mimeType, name) {
  const normalizedMime = String(mimeType || '').toLowerCase();
  const normalizedName = String(name || '');
  return Boolean(VALID_IMAGE_MIME_TYPES[normalizedMime]) || /\.(jpe?g|png|webp)$/i.test(normalizedName);
}

function makeDriveThumbnailUrl(fileId) {
  return 'https://drive.google.com/thumbnail?id='
    + encodeURIComponent(fileId)
    + '&sz=w'
    + encodeURIComponent(CONFIG.thumbnailSize);
}

function normalizeDriveError(error) {
  const message = String(error && error.message ? error.message : error);

  if (/not found|no item with the given id/i.test(message)) {
    return 'Carpeta inexistente o ID inválido.';
  }

  if (/permission|access|denied|you do not have/i.test(message)) {
    return 'Error de permisos al abrir la carpeta.';
  }

  return message;
}
