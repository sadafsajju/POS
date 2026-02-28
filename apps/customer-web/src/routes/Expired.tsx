export default function Expired() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">⏰</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Expired</h1>
        <p className="text-gray-600 mb-6">
          Your session has expired. Please scan the QR code on your table again.
        </p>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = '/';
          }}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
        >
          Scan QR Code
        </button>
      </div>
    </div>
  );
}
