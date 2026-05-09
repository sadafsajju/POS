import { create } from 'zustand';
import type { StoreSettings } from '@pos/types';
import { settingsDb } from '@pos/supabase';

interface SettingsStore {
  settings: StoreSettings;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  updateSettings: (settings: Partial<StoreSettings>) => void;
  resetSettings: () => void;
  fetchSettings: () => Promise<void>;
  saveSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const defaultSettings: StoreSettings = {
  restaurantName: 'My Restaurant',
  storeAddress: '',
  storePhone: '',
  currency: 'INR',
  currencySymbol: '₹',
  taxRate: 0,
  serviceCharge: 0,
  taxRegime: 'flat',
  vatRates: { standard: 20, reduced: 5, zero: 0 },
  vatNumber: '',
  showAllergens: false,
  showCalories: false,
  privacyPolicyUrl: '',
  customerRetentionMonths: undefined,
  tippingEnabled: false,
  tippingPolicyUrl: '',
  tipDefaultAllocationMethod: 'equal',
  receiptHeader: 'Thank you for dining with us!',
  receiptFooter: 'Visit again soon!',
  theme: 'light',
  language: 'en',
  timezone: 'Europe/London',
  backupFrequency: 'daily',
  notificationEmail: '',
  touchMode: false,
  enableKds: true,
  industryMode: 'restaurant',
  productDisplay: {
    showImage: true,
    showDescription: false,
    showPrice: true,
    showSku: false,
    showBarcode: false,
    showDietaryType: true,
    showPreparationTime: false,
    showCategory: true,
    showAvailability: true,
  },
  cartSettings: {
    defaultOrderType: 'dine_in',
    showDineIn: true,
    showTakeout: true,
    showDelivery: true,
    showSpecialInstructions: true,
    showOrderNotes: true,
    confirmBeforeClear: true,
    autoClearAfterOrder: true,
    dineInButtons: { showSave: true, showKot: true, showPay: true },
    takeoutButtons: { showSave: false, showKot: false, showPay: true },
    deliveryButtons: { showSave: false, showKot: false, showPay: true },
  },
};

// Parse product display settings from JSON string
const parseProductDisplay = (jsonStr: string | undefined): StoreSettings['productDisplay'] => {
  if (!jsonStr) return defaultSettings.productDisplay;
  try {
    const parsed = JSON.parse(jsonStr);
    return { ...defaultSettings.productDisplay, ...parsed };
  } catch {
    return defaultSettings.productDisplay;
  }
};

// Parse cart settings from JSON string
const parseCartSettings = (jsonStr: string | undefined): StoreSettings['cartSettings'] => {
  if (!jsonStr) return defaultSettings.cartSettings;
  try {
    const parsed = JSON.parse(jsonStr);
    return { ...defaultSettings.cartSettings, ...parsed };
  } catch {
    return defaultSettings.cartSettings;
  }
};

// Parse VAT rates JSON with sensible UK fallbacks
const parseVatRates = (jsonStr: string | undefined): StoreSettings['vatRates'] => {
  if (!jsonStr) return defaultSettings.vatRates;
  try {
    const parsed = JSON.parse(jsonStr);
    return { ...defaultSettings.vatRates, ...parsed };
  } catch {
    return defaultSettings.vatRates;
  }
};

// Convert API response to StoreSettings
const apiToStoreSettings = (apiData: Record<string, string>): StoreSettings => {
  return {
    restaurantName: apiData.restaurant_name || apiData.store_name || defaultSettings.restaurantName,
    storeAddress: apiData.store_address || '',
    storePhone: apiData.store_phone || '',
    currency: apiData.currency || defaultSettings.currency,
    currencySymbol: apiData.currency_symbol || defaultSettings.currencySymbol,
    taxRate: parseFloat(apiData.tax_rate) || defaultSettings.taxRate,
    serviceCharge: parseFloat(apiData.service_charge) || defaultSettings.serviceCharge,
    taxRegime: (apiData.tax_regime as StoreSettings['taxRegime']) || defaultSettings.taxRegime,
    vatRates: parseVatRates(apiData.vat_rates),
    vatNumber: apiData.vat_number || '',
    showAllergens: apiData.show_allergens === 'true',
    showCalories: apiData.show_calories === 'true',
    privacyPolicyUrl: apiData.privacy_policy_url || '',
    customerRetentionMonths: apiData.customer_retention_months
      ? parseInt(apiData.customer_retention_months, 10) || undefined
      : undefined,
    tippingEnabled: apiData.tipping_enabled === 'true',
    tippingPolicyUrl: apiData.tipping_policy_url || '',
    tipDefaultAllocationMethod: (apiData.tip_default_allocation_method as StoreSettings['tipDefaultAllocationMethod']) || 'equal',
    receiptHeader: apiData.receipt_header || defaultSettings.receiptHeader,
    receiptFooter: apiData.receipt_footer || defaultSettings.receiptFooter,
    theme: (apiData.theme as StoreSettings['theme']) || defaultSettings.theme,
    language: apiData.language || defaultSettings.language,
    timezone: apiData.timezone || defaultSettings.timezone,
    backupFrequency: (apiData.backup_frequency as StoreSettings['backupFrequency']) || defaultSettings.backupFrequency,
    notificationEmail: apiData.notification_email || '',
    touchMode: apiData.touch_mode === 'true' || defaultSettings.touchMode,
    enableKds: apiData.enable_kds !== undefined ? apiData.enable_kds !== 'false' : defaultSettings.enableKds,
    industryMode: (apiData.industry_mode as StoreSettings['industryMode']) || defaultSettings.industryMode,
    productDisplay: parseProductDisplay(apiData.product_display),
    cartSettings: parseCartSettings(apiData.cart_settings),
  };
};

// Convert StoreSettings to API format
const storeToApiSettings = (settings: Partial<StoreSettings>): Record<string, string> => {
  const result: Record<string, string> = {};

  if (settings.restaurantName !== undefined) result.restaurant_name = settings.restaurantName;
  if (settings.storeAddress !== undefined) result.store_address = settings.storeAddress;
  if (settings.storePhone !== undefined) result.store_phone = settings.storePhone;
  if (settings.currency !== undefined) result.currency = settings.currency;
  if (settings.currencySymbol !== undefined) result.currency_symbol = settings.currencySymbol;
  if (settings.taxRate !== undefined) result.tax_rate = settings.taxRate.toString();
  if (settings.serviceCharge !== undefined) result.service_charge = settings.serviceCharge.toString();
  if (settings.taxRegime !== undefined) result.tax_regime = settings.taxRegime;
  if (settings.vatRates !== undefined) result.vat_rates = JSON.stringify(settings.vatRates);
  if (settings.vatNumber !== undefined) result.vat_number = settings.vatNumber;
  if (settings.showAllergens !== undefined) result.show_allergens = settings.showAllergens.toString();
  if (settings.showCalories !== undefined) result.show_calories = settings.showCalories.toString();
  if (settings.privacyPolicyUrl !== undefined) result.privacy_policy_url = settings.privacyPolicyUrl;
  if (settings.customerRetentionMonths !== undefined) {
    result.customer_retention_months = settings.customerRetentionMonths === undefined || settings.customerRetentionMonths === null
      ? ''
      : settings.customerRetentionMonths.toString();
  }
  if (settings.tippingEnabled !== undefined) result.tipping_enabled = settings.tippingEnabled.toString();
  if (settings.tippingPolicyUrl !== undefined) result.tipping_policy_url = settings.tippingPolicyUrl;
  if (settings.tipDefaultAllocationMethod !== undefined) result.tip_default_allocation_method = settings.tipDefaultAllocationMethod;
  if (settings.receiptHeader !== undefined) result.receipt_header = settings.receiptHeader;
  if (settings.receiptFooter !== undefined) result.receipt_footer = settings.receiptFooter;
  if (settings.theme !== undefined) result.theme = settings.theme;
  if (settings.language !== undefined) result.language = settings.language;
  if (settings.timezone !== undefined) result.timezone = settings.timezone;
  if (settings.backupFrequency !== undefined) result.backup_frequency = settings.backupFrequency;
  if (settings.notificationEmail !== undefined) result.notification_email = settings.notificationEmail;
  if (settings.touchMode !== undefined) result.touch_mode = settings.touchMode.toString();
  if (settings.enableKds !== undefined) result.enable_kds = settings.enableKds.toString();
  if (settings.industryMode !== undefined) result.industry_mode = settings.industryMode;
  if (settings.productDisplay !== undefined) result.product_display = JSON.stringify(settings.productDisplay);
  if (settings.cartSettings !== undefined) result.cart_settings = JSON.stringify(settings.cartSettings);

  return result;
};

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  settings: defaultSettings,
  isLoading: false,
  isInitialized: false,
  error: null,

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },

  resetSettings: () => {
    set({ settings: defaultSettings });
  },

  fetchSettings: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await settingsDb.getSettings();

      if (response.success && response.data) {
        const storeSettings = apiToStoreSettings(response.data);
        set({
          settings: storeSettings,
          isInitialized: true,
          isLoading: false,
        });
        return;
      }

      // If fetch fails, use default settings
      set({ isInitialized: true, isLoading: false });
    } catch (error: any) {
      console.warn('Failed to fetch settings, using defaults:', error.message);
      set({ isInitialized: true, isLoading: false, error: error.message });
    }
  },

  saveSettings: async (newSettings) => {
    // Optimistically update local state
    const previousSettings = get().settings;
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
      isLoading: true,
      error: null,
    }));

    try {
      const apiSettings = storeToApiSettings(newSettings);
      const response = await settingsDb.updateSettings(apiSettings);

      if (response.success && response.data) {
        const storeSettings = apiToStoreSettings(response.data);
        set({
          settings: storeSettings,
          isLoading: false,
        });
        return;
      }

      throw new Error(response.message || 'Failed to save settings');
    } catch (error: any) {
      console.error('Failed to save settings:', error.message);
      set({
        settings: previousSettings,
        isLoading: false,
        error: error.message,
      });
      throw error;
    }
  },
}));

// Helper hook to get formatted currency
// Re-export so callers can grab the formatter without crossing into apps/desktop
import { formatCurrency as formatCurrencyShared, localeForCurrency } from '../utils/format';

export const useFormatCurrency = () => {
  const { settings } = useSettingsStore();

  return (amount: number): string => {
    const formatted = formatCurrencyShared(
      amount,
      settings.currency,
      localeForCurrency(settings.currency),
    );
    // Preserve a manually-set custom symbol (e.g. "Rs." instead of "₹")
    if (!settings.currencySymbol) return formatted;
    try {
      const parts = new Intl.NumberFormat(localeForCurrency(settings.currency), {
        style: 'currency',
        currency: settings.currency,
      }).formatToParts(amount);
      const intlSymbol = parts.find(p => p.type === 'currency')?.value;
      if (intlSymbol && intlSymbol !== settings.currencySymbol) {
        return formatted.replace(intlSymbol, settings.currencySymbol);
      }
    } catch {
      // formatToParts unsupported; fall through to the Intl-formatted string
    }
    return formatted;
  };
};

// Helper hook to calculate tax
export const useCalculateTax = () => {
  const { settings } = useSettingsStore();

  return (subtotal: number): number => {
    return subtotal * (settings.taxRate / 100);
  };
};

// Helper hook to calculate service charge
export const useCalculateServiceCharge = () => {
  const { settings } = useSettingsStore();

  return (subtotal: number): number => {
    return subtotal * (settings.serviceCharge / 100);
  };
};

// Helper hook to get full total with tax and service charge
export const useCalculateTotal = () => {
  const { settings } = useSettingsStore();

  return (subtotal: number): { tax: number; serviceCharge: number; total: number } => {
    const tax = subtotal * (settings.taxRate / 100);
    const serviceCharge = subtotal * (settings.serviceCharge / 100);
    const total = subtotal + tax + serviceCharge;
    return { tax, serviceCharge, total };
  };
};

// =============================================
// UK VAT helpers — mirror the logic in create_order so cart preview matches.
// Source of truth is still server-side.
// =============================================

import type { Product, VatCategory, DiningMode, VatRates } from '@pos/types';

export interface UkVatLine {
  rate: number;            // applied rate %
  category: VatCategory;
  net: number;             // line net total (before VAT)
  vat: number;             // VAT amount on this line
}

export interface UkVatBreakdown {
  lines: UkVatLine[];
  byRate: Array<{ rate: number; net: number; vat: number }>;
  totalNet: number;
  totalVat: number;
}

export const computeLineVatRate = (
  product: Pick<Product, 'vat_category' | 'is_hot'>,
  diningMode: DiningMode | undefined,
  vatRates: VatRates,
): { rate: number; category: VatCategory } => {
  const category: VatCategory = product.vat_category ?? 'standard';
  const isHot = product.is_hot ?? false;

  if (category === 'exempt') return { rate: 0, category };
  if (isHot) return { rate: vatRates.standard, category };
  if (diningMode === 'eat_in') return { rate: vatRates.standard, category };

  // Cold takeaway → honour category
  switch (category) {
    case 'standard': return { rate: vatRates.standard, category };
    case 'reduced':  return { rate: vatRates.reduced,  category };
    case 'zero':     return { rate: vatRates.zero,     category };
    default:         return { rate: 0, category };
  }
};

export const computeUkVatBreakdown = (
  items: Array<{ product: Pick<Product, 'vat_category' | 'is_hot'>; lineNet: number }>,
  diningMode: DiningMode | undefined,
  vatRates: VatRates,
): UkVatBreakdown => {
  const lines: UkVatLine[] = items.map(({ product, lineNet }) => {
    const { rate, category } = computeLineVatRate(product, diningMode, vatRates);
    return {
      rate,
      category,
      net: lineNet,
      vat: Math.round(lineNet * rate) / 100,
    };
  });

  const byRateMap = new Map<number, { net: number; vat: number }>();
  for (const line of lines) {
    const bucket = byRateMap.get(line.rate) ?? { net: 0, vat: 0 };
    bucket.net += line.net;
    bucket.vat += line.vat;
    byRateMap.set(line.rate, bucket);
  }
  const byRate = Array.from(byRateMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([rate, v]) => ({ rate, ...v }));

  const totalNet = lines.reduce((s, l) => s + l.net, 0);
  const totalVat = lines.reduce((s, l) => s + l.vat, 0);

  return { lines, byRate, totalNet, totalVat };
};
