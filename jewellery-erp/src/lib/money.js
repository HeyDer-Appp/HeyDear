export const r2 = (n) => {
  const x = Number(n) || 0;
  return (Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-8)) / 100;
};

const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const inr = (n) => fmt.format(Number(n) || 0);
