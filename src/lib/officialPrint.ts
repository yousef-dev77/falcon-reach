import { supabase } from "@/integrations/supabase/client";

export interface CompanyLetterhead {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  logo?: string | null;
}

let cachedCompany: CompanyLetterhead | null = null;

/** يجلب بيانات ترويسة الشركة من الإعدادات العامة (مع تخزين مؤقت). */
export const getCompanyLetterhead = async (): Promise<CompanyLetterhead> => {
  if (cachedCompany) return cachedCompany;
  const { data } = await supabase
    .from("system_settings")
    .select("setting_key, setting_value")
    .in("setting_key", [
      "company_name",
      "company_address",
      "company_phone",
      "company_email",
      "company_tax_number",
      "company_logo",
    ]);
  const map = new Map((data ?? []).map((r) => [r.setting_key, r.setting_value]));
  cachedCompany = {
    name: map.get("company_name") || "الشركة",
    address: map.get("company_address"),
    phone: map.get("company_phone"),
    email: map.get("company_email"),
    taxNumber: map.get("company_tax_number"),
    logo: map.get("company_logo"),
  };
  return cachedCompany;
};

export const clearLetterheadCache = () => {
  cachedCompany = null;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

/** يرسم باركود Code39 مبسط بصيغة SVG لعرض رقم المستند. */
const barcodeSvg = (value: string) => {
  const clean = value.replace(/[^A-Za-z0-9\-]/g, "").toUpperCase().slice(0, 24);
  if (!clean) return "";
  let x = 0;
  const bars: string[] = [];
  for (let i = 0; i < clean.length; i += 1) {
    const code = clean.charCodeAt(i);
    for (let bit = 0; bit < 4; bit += 1) {
      const wide = ((code >> bit) & 1) === 1;
      const width = wide ? 3 : 1;
      bars.push(`<rect x="${x}" y="0" width="${width}" height="40" fill="#111" />`);
      x += width + 2;
    }
  }
  return `<svg viewBox="0 0 ${x} 52" width="${Math.min(x * 1.2, 280)}" height="52" role="img" aria-label="باركود ${escapeHtml(clean)}">${bars.join("")}<text x="0" y="51" font-size="9" font-family="Arial" fill="#111">${escapeHtml(clean)}</text></svg>`;
};

const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: "Cairo", Arial, sans-serif; direction: rtl; color: #1d2733; margin: 0; }
.letterhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid #005B96; padding-bottom: 10px; }
.letterhead h1 { margin: 0; font-size: 20px; color: #005B96; }
.letterhead p { margin: 2px 0; font-size: 11px; color: #5b6b7b; }
.letterhead img { max-height: 64px; max-width: 150px; object-fit: contain; }
.doc-title { margin: 14px 0 4px; font-size: 17px; font-weight: bold; text-align: center; }
.doc-meta { text-align: center; font-size: 11px; color: #5b6b7b; margin-bottom: 12px; }
table { border-collapse: collapse; width: 100%; font-size: 11.5px; margin-bottom: 12px; }
th, td { border: 1px solid #c3cfda; padding: 6px 8px; text-align: right; }
th { background: #eaf2f8; }
tr { page-break-inside: avoid; }
.signatures { display: flex; justify-content: space-between; margin-top: 34px; font-size: 12px; }
.signatures div { width: 30%; border-top: 1px solid #8899a8; padding-top: 6px; text-align: center; }
.doc-footer { margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #5b6b7b; border-top: 1px solid #dde5ec; padding-top: 8px; }
button, input, select, textarea, [role="tablist"] { display: none !important; }
`;

export interface OfficialPrintOptions {
  title: string;
  documentNumber?: string;
  meta?: string;
  bodyHtml: string;
  showSignatures?: boolean;
}

/** يفتح نافذة طباعة بمستند رسمي يحمل ترويسة الشركة والتوقيعات والباركود. */
export const printOfficialDocument = async (options: OfficialPrintOptions) => {
  const company = await getCompanyLetterhead();
  const printedAt = new Date().toLocaleString("ar", { hour12: false });

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
<title>${escapeHtml(options.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
<style>${PRINT_CSS}</style></head><body>
<header class="letterhead">
  <div>
    <h1>${escapeHtml(company.name)}</h1>
    ${company.address ? `<p>${escapeHtml(company.address)}</p>` : ""}
    ${company.phone ? `<p>هاتف: ${escapeHtml(company.phone)}</p>` : ""}
    ${company.email ? `<p>${escapeHtml(company.email)}</p>` : ""}
    ${company.taxNumber ? `<p>الرقم الضريبي: ${escapeHtml(company.taxNumber)}</p>` : ""}
  </div>
  ${company.logo ? `<img src="${escapeHtml(company.logo)}" alt="شعار ${escapeHtml(company.name)}" />` : ""}
</header>
<h2 class="doc-title">${escapeHtml(options.title)}</h2>
${options.meta ? `<p class="doc-meta">${escapeHtml(options.meta)}</p>` : ""}
${options.bodyHtml}
${
  options.showSignatures === false
    ? ""
    : `<div class="signatures"><div>المُعِدّ</div><div>المراجع</div><div>المدير المختص</div></div>`
}
<footer class="doc-footer">
  <span>تاريخ الطباعة: ${escapeHtml(printedAt)}</span>
  ${options.documentNumber ? barcodeSvg(options.documentNumber) : ""}
</footer>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 600);
  return true;
};

/** يطبع الشاشة الحالية كمستند رسمي (يستخدم الجداول والمحتوى الظاهر). */
export const printCurrentScreen = async (title: string, documentNumber?: string) => {
  const root = (document.querySelector("main") ?? document.body).cloneNode(true) as HTMLElement;
  root
    .querySelectorAll("button, input, select, textarea, svg, nav, [role='tablist'], [data-print-hide]")
    .forEach((el) => el.remove());
  return printOfficialDocument({ title, documentNumber, bodyHtml: root.innerHTML });
};
