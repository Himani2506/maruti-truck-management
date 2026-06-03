// ─────────────────────────────────────────────
// Nepali (Bikram Sambat) Date Utility
// BS ↔ AD conversion, no external dependencies
// ─────────────────────────────────────────────

const BS_DATA = {
  2078: [31,31,32,31,31,31,30,29,30,29,30,30],
  2079: [31,31,32,31,31,30,30,29,30,29,30,30],
  2080: [31,32,31,32,31,30,30,29,30,29,30,30],
  2081: [31,32,31,32,31,30,30,30,29,30,29,31],
  2082: [31,32,31,32,31,30,30,30,29,30,30,30],
  2083: [31,31,32,31,31,31,30,29,30,29,30,30],
  2084: [31,31,32,32,31,30,30,29,30,29,30,30],
  2085: [31,32,31,32,31,30,30,30,29,30,29,31],
  2086: [31,32,31,32,31,30,30,30,29,30,30,30],
};

export const BS_MONTH_NAMES = [
  'Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin',
  'Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'
];

export const BS_YEARS = Object.keys(BS_DATA).map(Number);

export function getDaysInBSMonth(year, month1indexed) {
  const months = BS_DATA[year];
  if (!months) return 32;
  return months[month1indexed - 1];
}

// Reference: BS 2078 Baisakh 1 = AD 2021 April 14
const REF_BS = { year: 2078, month: 1, day: 1 };
const REF_AD = new Date(2021, 3, 14); // Note: Month 3 is April in JS Date

function bsTotalDaysFromRef(year, month, day) {
  let total = 0;
  for (let y = REF_BS.year; y < year; y++) {
    const m = BS_DATA[y];
    if (m) total += m.reduce((a, b) => a + b, 0);
  }
  const months = BS_DATA[year];
  if (months) {
    for (let m = 1; m < month; m++) total += months[m - 1];
  }
  total += day - 1;
  return total;
}

export function bsToADString(bsYear, bsMonth, bsDay) {
  if (!bsYear || !bsMonth || !bsDay) return null;
  const diffDays = bsTotalDaysFromRef(parseInt(bsYear), parseInt(bsMonth), parseInt(bsDay));
  const ad = new Date(REF_AD);
  ad.setDate(ad.getDate() + diffDays);
  const y = ad.getFullYear();
  const m = String(ad.getMonth() + 1).padStart(2, '0');
  const d = String(ad.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function adToBS(adDateStr) {
  if (!adDateStr) return null;
  try {
    // Standardize input string parsing safely
    const adDate = new Date(adDateStr.includes('T') ? adDateStr : `${adDateStr}T00:00:00`);
    if (isNaN(adDate.getTime())) return null;

    // Normalize both dates to midnight UTC to prevent daylight savings shifts
    const utcAd = Date.UTC(adDate.getFullYear(), adDate.getMonth(), adDate.getDate());
    const utcRef = Date.UTC(REF_AD.getFullYear(), REF_AD.getMonth(), REF_AD.getDate());

    let remaining = Math.round((utcAd - utcRef) / (1000 * 60 * 60 * 24));
    let bsYear = REF_BS.year, bsMonth = REF_BS.month, bsDay = REF_BS.day;

    // Handle Forward Dates (Future relative to reference)
    while (remaining > 0) {
      const months = BS_DATA[bsYear];
      if (!months) break;
      const daysInMonth = months[bsMonth - 1];
      const daysLeft = daysInMonth - bsDay + 1;

      if (remaining < daysLeft) {
        bsDay += remaining;
        remaining = 0;
      } else {
        remaining -= daysLeft;
        bsDay = 1;
        bsMonth++;
        if (bsMonth > 12) {
          bsMonth = 1;
          bsYear++;
        }
      }
    }

    // Handle Backward Dates (Past relative to reference)
    while (remaining < 0) {
      bsDay--;
      if (bsDay < 1) {
        bsMonth--;
        if (bsMonth < 1) {
          bsMonth = 12;
          bsYear--;
        }
        const months = BS_DATA[bsYear];
        if (!months) break; // Out of dataset bounds
        bsDay = months[bsMonth - 1];
      }
      remaining++;
    }

    // Double check if the calculated year exists in our mapping
    if (!BS_DATA[bsYear]) return null;

    return { year: bsYear, month: bsMonth, day: bsDay };
  } catch {
    return null;
  }
}

export function formatBSShort(bs) {
  if (!bs || !bs.year) return '—';
  return `${String(bs.day).padStart(2,'0')}/${String(bs.month).padStart(2,'0')}/${bs.year}`;
}

export function formatBS(bs) {
  if (!bs || !bs.year) return '—';
  return `${bs.day} ${BS_MONTH_NAMES[bs.month - 1]} ${bs.year} BS`;
}