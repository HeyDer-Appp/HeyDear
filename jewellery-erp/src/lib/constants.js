export const ROLES = {
  owner: 'Owner',
  staff: 'Branch staff',
};

export const CATEGORIES = ['Ring', 'Chain', 'Necklace', 'Bracelet', 'Bangle', 'Earrings', 'Pendant', 'Mangalsutra', 'Anklet', 'Coin', 'Other'];
export const METALS = ['Gold', 'Silver', 'Platinum', 'Diamond', 'Other'];
export const PURITIES = ['24K', '22K', '18K', '14K', '999', '925', '950', 'Other'];
export const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'BANK'];
export const PAYMENT_LABEL = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', BANK: 'Bank transfer' };

// Only two settings drive money: the old-bill offer % and GST %.
export const DEFAULT_RULES = {
  offerPercent: 50,
  gstPercent: 0,
};

export const DEFAULT_COMPANY = {
  name: 'My Jewellers',
  address: '',
  gstin: '',
  phone: '',
  invoiceFooter: 'Thank you! Bring this bill back to get 50% off your next purchase (one time only).',
};
