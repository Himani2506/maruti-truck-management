export { adToBSString, bsStringToAD, fmtDate }  
export { fmt, fmtN }
export { calcNetPayable }
import { adToBS as adToBSRaw, bsToADString } from "../../nepaliDate";

export const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

function adToBSString(adDateStr) {
  if (!adDateStr) return "";
  const bs = adToBSRaw(adDateStr);
  if (!bs) return "";
  return `${String(bs.day).padStart(2, "0")}/${String(bs.month).padStart(2, "0")}/${bs.year}`;
}
function bsStringToAD(bsStr) {
  if (!bsStr) return "";
  const clean = bsStr.replace(/\//g, "");
  if (clean.length < 8) return "";
  const day = parseInt(clean.substring(0, 2));
  const month = parseInt(clean.substring(2, 4));
  const year = parseInt(clean.substring(4, 8));
  if (!day || !month || !year) return "";
  return bsToADString(year, month, day) || "";
}
function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


const fmt = (n) =>
  n != null && n !== ""
    ? parseFloat(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
const fmtN = (n) =>
  n != null && n !== ""
    ? parseFloat(n).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : "—";

function calcNetPayable(row) {
  const bw = parseFloat(row.bill_weight) || 0;
  const br = parseFloat(row.bill_rate) || 0;
  const ow = parseFloat(row.our_weight) || 0;
  const sr =
    row.superseded_rate != null ? parseFloat(row.superseded_rate) : null;
  const srej =
    row.superseded_rejection != null
      ? parseFloat(row.superseded_rejection)
      : null;
  const totalLab =
    (parseFloat(row.moisture) || 0) +
    (parseFloat(row.duplex) || 0) +
    (parseFloat(row.plastic) || 0) +
    (parseFloat(row.pin) || 0) +
    (parseFloat(row.raining_water) || 0) +
    (parseFloat(row.dust) || 0) +
    (parseFloat(row.millboard) || 0) +
    (parseFloat(row.extra) || 0);

  const shortage = bw - ow;
  const vat = bw * br * 0.13;
  const effectiveRate = sr !== null ? sr : br;
  const effectiveTotalLab = srej !== null ? srej : totalLab;
  const labDeductionRupees = (bw * br * effectiveTotalLab) / 100;
  return (bw - shortage) * effectiveRate + vat - labDeductionRupees;
}

export const LAB_FIELDS = [
  { key: "duplex", label: "Duplex (%)" },
  { key: "plastic", label: "Plastic (%)" },
  { key: "pin", label: "Pin (%)" },
  { key: "raining_water", label: "Raining Water (%)" },
  { key: "dust", label: "Dust (%)" },
  { key: "millboard", label: "Millboard (%)" },
  { key: "extra", label: "Extra (%)" },
];

export const GRN_PREFIXES = ["W-", "HUSK-", "None"];

export const emptyForm = {
  unloading_date_ad: "",
  unloading_date_bs: "",
  gen: "",
  grn_prefix: "W-",
  grn_number: "",
  source: "",
  vehicle_no: "",
  party_bill_no: "",
  bill_weight: "",
  bill_rate: "",
  our_weight: "",
  duplex: "",
  plastic: "",
  pin: "",
  raining_water: "",
  dust: "",
  millboard: "",
  extra: "",
  scrap_tax_birgunj: "",
  scrap_tax_simra: "",
  scrap_tax_hetauda: "",
  other_taxes: "",
  other_expenses: "",
  freight: "",
  moisture: "",
  remarks: "",
};

export function Section({ title, children }) {
  return (
    <div
      style={{
        marginBottom: 12,
        background: "#fff",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        overflow: "visible",
      }}
    >
      <div
        style={{
          background: "#f7fafc",
          padding: "8px 16px",
          borderBottom: "1px solid #e2e8f0",
          borderRadius: "10px 10px 0 0",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: "#718096",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ padding: "12px 16px" }}>{children}</div>
    </div>
  );
}

export function Field({ label, children, required }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        marginBottom: 2,
      }}
    >
      <label style={{ fontSize: 11, fontWeight: 600, color: "#4a5568" }}>
        {label}
        {required && <span style={{ color: "#e53e3e" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
export function Chip({ label, value, color }) {
  return (
    <div
      style={{
        background: "#f7fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "5px 14px",
        fontSize: 12,
      }}
    >
      <span style={{ color: "#718096" }}>{label}: </span>
      <span style={{ fontWeight: 700, color: color || "#2d3748" }}>
        {value}
      </span>
    </div>
  );
}
export function Spinner() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: 48,
        color: "#a0aec0",
        fontSize: 13,
      }}
    >
      Loading…
    </div>
  );
}

export const inp = {
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  background: "#fff",
  transition: "border-color 0.15s",
};
export const grid = (cols) => ({
  display: "grid",
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gap: 10,
});
export const td = {
  padding: "9px 10px",
  borderBottom: "1px solid #f0f0f0",
  fontSize: 12,
  whiteSpace: "nowrap",
};
export const exportBtn = {
  padding: "9px 18px",
  background: "#276749",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
export const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
export const modal = {
  background: "#fff",
  borderRadius: 14,
  padding: 28,
  width: 480,
  maxWidth: "95vw",
  boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
};

