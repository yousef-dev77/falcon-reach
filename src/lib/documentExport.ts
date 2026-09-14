const cleanFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "تقرير";

const downloadBlob = (content: BlobPart, mimeType: string, fileName: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const getExportRoot = (): HTMLElement => document.querySelector("main") ?? document.body;

const stripInteractive = (root: HTMLElement) => {
  root.querySelectorAll("button, input, select, textarea, svg, [role='tablist']").forEach((el) => el.remove());
  return root;
};

const tableToHtml = (table: HTMLTableElement) => {
  const cloned = table.cloneNode(true) as HTMLTableElement;
  stripInteractive(cloned as unknown as HTMLElement);
  return cloned.outerHTML;
};

const visibleTables = () =>
  Array.from(getExportRoot().querySelectorAll("table")).filter(
    (table) => (table as HTMLElement).offsetParent !== null,
  ) as HTMLTableElement[];

const SHEET_STYLE =
  "body{font-family:Arial,sans-serif;direction:rtl}table{border-collapse:collapse;width:100%}th,td{border:1px solid #b9c5d1;padding:7px;text-align:right}th{background:#e8f0f7;font-weight:bold}h2{color:#005B96}";

/** يصدّر الجداول الظاهرة في الشاشة إلى ملف يفتح في Excel. */
export const exportVisibleTablesToExcel = (title: string): boolean => {
  const tables = visibleTables();
  if (tables.length === 0) return false;

  const sections = tables
    .map(
      (table, index) =>
        `<h2>${tables.length > 1 ? `${title} (${index + 1})` : title}</h2>${tableToHtml(table)}<br />`,
    )
    .join("");

  const html = `<html dir="rtl"><head><meta charset="UTF-8" /><style>${SHEET_STYLE}</style></head><body>${sections}</body></html>`;
  downloadBlob(`\ufeff${html}`, "application/vnd.ms-excel;charset=utf-8", `${cleanFileName(title)}.xls`);
  return true;
};

/** يصدّر محتوى الشاشة إلى ملف يفتح في Word. */
export const exportPageToWord = (title: string) => {
  const root = getExportRoot().cloneNode(true) as HTMLElement;
  stripInteractive(root);
  root.querySelectorAll("[hidden]").forEach((el) => el.removeAttribute("hidden"));

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl"><head><meta charset="UTF-8" /><title>${title}</title><style>body{font-family:Arial,sans-serif;direction:rtl;color:#1d2733;margin:28px}h1{color:#005B96;font-size:22px}${SHEET_STYLE}</style></head><body><h1>${title}</h1>${root.innerHTML}</body></html>`;
  downloadBlob(`\ufeff${html}`, "application/msword;charset=utf-8", `${cleanFileName(title)}.doc`);
};
