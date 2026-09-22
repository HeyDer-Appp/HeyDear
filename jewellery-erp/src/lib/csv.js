import { CATEGORIES } from './constants';

// Column name -> canonical field. Matching ignores case, spaces and punctuation.
const ALIAS = {
  name: 'name', item: 'name', itemname: 'name', product: 'name', productname: 'name', description: 'name',
  category: 'category', type: 'category',
  metal: 'metal',
  purity: 'purity', karat: 'purity', carat: 'purity',
  grossweight: 'grossWeight', gross: 'grossWeight', grosswt: 'grossWeight',
  netweight: 'netWeight', net: 'netWeight', netwt: 'netWeight', weight: 'netWeight',
  price: 'price', sellingprice: 'price', mrp: 'price', amount: 'price', rate: 'price',
  huid: 'huid', hallmark: 'huid',
  branch: 'branch', branchcode: 'branch', location: 'branch', shop: 'branch',
  qty: 'qty', quantity: 'qty', pieces: 'qty', pcs: 'qty',
};

export const CSV_TEMPLATE =
  'name,category,metal,purity,gross_weight,net_weight,price,huid,branch,qty\n'
  + 'Diamond solitaire ring,Ring,Gold,18K,4.5,4.2,38500,HU12AB,NGP01,1\n'
  + 'Rope chain 20 inch,Chain,Gold,22K,12.8,12.5,84200,,NGP02,2\n';

function splitLines(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const delim = (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Parse pasted/uploaded CSV (or tab-separated Excel paste) into stock rows.
 * `branches` is the list of { id, code }. Returns { rows, errors, unknownColumns }.
 * Each row: { line, item, branchId, qty, error }.
 */
export function parseStockCsv(text, branches, defaultBranchId) {
  const grid = splitLines(String(text || '').replace(/^﻿/, ''));
  if (grid.length < 2) return { rows: [], errors: ['Add a header row and at least one item.'], unknownColumns: [] };
  const header = grid[0].map((h) => ALIAS[norm(h)] || null);
  const unknownColumns = grid[0].filter((_, i) => !header[i]).map((h) => h.trim()).filter(Boolean);
  if (!header.includes('name') || !header.includes('price')) {
    return { rows: [], errors: ['The file needs at least a "name" column and a "price" column.'], unknownColumns };
  }
  const byCode = Object.fromEntries(branches.map((b) => [b.code.toUpperCase(), b.id]));
  const rows = grid.slice(1).map((cells, idx) => {
    const raw = {};
    header.forEach((f, i) => { if (f) raw[f] = String(cells[i] ?? '').trim(); });
    const line = idx + 2;
    const price = num(raw.price);
    const qty = raw.qty ? num(raw.qty) : 1;
    let error = '';
    let branchId = defaultBranchId;
    if (!raw.name) error = 'Name is missing.';
    else if (!(price > 0)) error = 'Price must be a number above 0.';
    else if (!(qty >= 1 && qty <= 200 && Number.isInteger(qty))) error = 'Quantity must be a whole number from 1 to 200.';
    else if (raw.branch) {
      branchId = byCode[raw.branch.toUpperCase()] || branches.find((b) => b.id === raw.branch.toLowerCase())?.id;
      if (!branchId) error = `Unknown branch "${raw.branch}".`;
    }
    if (!error && !branchId) error = 'No branch chosen.';
    const category = CATEGORIES.find((c) => c.toLowerCase() === (raw.category || '').toLowerCase()) || (raw.category ? 'Other' : 'Other');
    const gross = num(raw.grossWeight);
    const net = num(raw.netWeight);
    return {
      line,
      error,
      branchId,
      qty: Number.isNaN(qty) ? 1 : qty,
      item: {
        name: raw.name, category, metal: raw.metal || (raw.purity === '925' ? 'Silver' : 'Gold'), purity: raw.purity || '22K',
        grossWeight: Number.isNaN(gross) ? 0 : gross, netWeight: Number.isNaN(net) ? (Number.isNaN(gross) ? 0 : gross) : net,
        price: Number.isNaN(price) ? 0 : price, huid: raw.huid || '',
      },
    };
  });
  return { rows, errors: [], unknownColumns };
}
