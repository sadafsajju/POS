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
  currency: 'USD',
  currencySymbol: '$',
  taxRate: 10,
  serviceCharge: 0,
  receiptHeader: 'Thank you for dining with us!',
  receiptFooter: 'Visit again soon!',
  theme: 'light',
  language: 'en',
  backupFrequency: 'daily',
  notificationEmail: '',
  touchMode: false,
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
    receiptHeader: apiData.receipt_header || defaultSettings.receiptHeader,
    receiptFooter: apiData.receipt_footer || defaultSettings.receiptFooter,
    theme: (apiData.theme as StoreSettings['theme']) || defaultSettings.theme,
    language: apiData.language || defaultSettings.language,
    backupFrequency: (apiData.backup_frequency as StoreSettings['backupFrequency']) || defaultSettings.backupFrequency,
    notificationEmail: apiData.notification_email || '',
    touchMode: apiData.touch_mode === 'true' || defaultSettings.touchMode,
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
  if (settings.receiptHeader !== undefined) result.receipt_header = settings.receiptHeader;
  if (settings.receiptFooter !== undefined) result.receipt_footer = settings.receiptFooter;
  if (settings.theme !== undefined) result.theme = settings.theme;
  if (settings.language !== undefined) result.language = settings.language;
  if (settings.backupFrequency !== undefined) result.backup_frequency = settings.backupFrequency;
  if (settings.notificationEmail !== undefined) result.notification_email = settings.notificationEmail;
  if (settings.touchMode !== undefined) result.touch_mode = settings.touchMode.toString();
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
export const useFormatCurrency = () => {
  const { settings } = useSettingsStore();

  return (amount: number): string => {
    return `${settings.currencySymbol}${amount.toFixed(2)}`;
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
