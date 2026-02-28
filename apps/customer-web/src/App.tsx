import { useEffect, useState } from 'react';
import { customerAPI } from './lib/api';
import InitSession from './routes/InitSession';
import Menu from './routes/Menu';
import Cart from './routes/Cart';
import Orders from './routes/Orders';
import Expired from './routes/Expired';

type Page = 'init' | 'menu' | 'cart' | 'orders' | 'expired';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('init');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if session exists
    if (customerAPI.hasActiveSession()) {
      setCurrentPage('menu');
    } else {
      // Check URL for QR token
      const urlParams = new URLSearchParams(window.location.search);
      const qrToken = urlParams.get('qr');

      if (qrToken) {
        setCurrentPage('init');
      }
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const navigate = (page: Page) => {
    setCurrentPage(page);
    window.history.pushState(null, '', `/${page === 'menu' ? '' : page}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {currentPage === 'init' && <InitSession onSuccess={() => navigate('menu')} />}
      {currentPage === 'menu' && <Menu onNavigateToCart={() => navigate('cart')} />}
      {currentPage === 'cart' && (
        <Cart
          onBack={() => navigate('menu')}
          onOrderPlaced={() => navigate('orders')}
        />
      )}
      {currentPage === 'orders' && <Orders onBackToMenu={() => navigate('menu')} />}
      {currentPage === 'expired' && <Expired />}
    </div>
  );
}

export default App;
