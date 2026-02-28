import { useEffect, useState } from 'react';
import { customerAPI } from '../lib/api';

interface InitSessionProps {
  onSuccess: () => void;
}

export default function InitSession({ onSuccess }: InitSessionProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const qrToken = urlParams.get('qr');

        if (!qrToken) {
          setError('Invalid QR code. Please scan again.');
          setIsLoading(false);
          return;
        }

        await customerAPI.initSession({ qr_token: qrToken });

        // Clear QR from URL
        window.history.replaceState(null, '', '/');

        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Failed to initialize session');
        setIsLoading(false);
      }
    };

    initializeSession();
  }, [onSuccess]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700">Setting up your table...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
