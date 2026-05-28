import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cookie-consent-v1';

type Choice = 'accepted' | 'rejected';

interface StoredConsent {
  choice: Choice;
  ts: string;
}

function readStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConsent;
  } catch {
    return null;
  }
}

export function hasAcceptedAnalyticsCookies(): boolean {
  return readStoredConsent()?.choice === 'accepted';
}

export function CookieBanner({ privacyPolicyUrl }: { privacyPolicyUrl?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readStoredConsent() === null);
  }, []);

  const persist = (choice: Choice) => {
    const payload: StoredConsent = { choice, ts: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage unavailable — banner just won't persist; that's the user's setup
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-2xl"
    >
      <div className="mx-auto max-w-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 text-sm text-gray-700 leading-relaxed">
          We use strictly necessary cookies to keep your session active. With your permission we also use optional
          analytics cookies to improve the menu experience.{' '}
          {privacyPolicyUrl && (
            <a
              href={privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 underline hover:text-primary-700"
            >
              Privacy notice
            </a>
          )}
        </div>
        <div className="flex flex-row gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => persist('rejected')}
            className="flex-1 sm:flex-none px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reject optional
          </button>
          <button
            type="button"
            onClick={() => persist('accepted')}
            className="flex-1 sm:flex-none px-4 py-2 rounded-md bg-primary-600 text-sm font-medium text-white hover:bg-primary-700"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
