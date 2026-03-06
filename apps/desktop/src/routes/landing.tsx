import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Store,
  Wifi,
  Clock,
  BarChart3,
  Users,
  ShoppingCart,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Smartphone,
  Sparkles
} from 'lucide-react';

export const Route = createFileRoute('/landing')({
  component: LandingPage,
});

function LandingPage() {
  // Clean up any stale flags on landing
  useEffect(() => {
    sessionStorage.removeItem('pos-logging-out')
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Store className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-zinc-100">YourPOS</span>
          </div>
          <div className="flex gap-3">
            <Link to="/login">
              <Button variant="ghost" className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800">
                Login
              </Button>
            </Link>
            <Link to="/setup">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero - Square Style */}
      <section className="relative overflow-hidden">
        {/* Two-column hero like Square */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="text-left">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/20 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-medium text-blue-400">Trusted by 500+ restaurants</span>
              </div>

              {/* Headline - Square style: short, punchy */}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-zinc-100 leading-tight">
                Run your restaurant.
                <br />
                <span className="text-blue-500">Online or offline.</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg md:text-xl text-zinc-400 mb-8 max-w-xl leading-relaxed">
                Accept orders, manage your kitchen, and track sales—even without internet. Built for restaurants that can't afford downtime.
              </p>

              {/* CTAs - Square style: primary + text link */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Link to="/setup">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-6 text-base rounded-lg shadow-lg shadow-blue-600/20">
                    Get started
                  </Button>
                </Link>
                <a href="#pricing" className="flex items-center gap-2 text-zinc-300 hover:text-zinc-100 font-medium px-4 py-3">
                  See pricing
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap gap-6 text-sm text-zinc-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Free 14-day trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Setup in 5 minutes</span>
                </div>
              </div>
            </div>

            {/* Right: Hero Image/Product Shot */}
            <div className="relative lg:ml-8">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl"></div>

              {/* Product screenshot */}
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-zinc-950 p-4">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-2 mb-4 px-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                    </div>
                    <div className="flex-1 h-6 bg-zinc-800 rounded-md flex items-center px-3">
                      <span className="text-xs text-zinc-600">yourpos.com</span>
                    </div>
                  </div>

                  {/* Mock POS interface */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-lg h-24 flex items-center justify-center hover:border-blue-600/50 transition-all hover:scale-105">
                          <ShoppingCart className="h-6 w-6 text-zinc-600" />
                        </div>
                      ))}
                    </div>
                    {/* Cart preview */}
                    <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Order Total</span>
                        <span className="text-lg font-bold text-zinc-100">₹450.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Square Style: Simple, Direct */}
      <section id="features" className="bg-zinc-900/30 border-y border-zinc-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-zinc-100 mb-4">
              Everything you need to run your restaurant
            </h2>
            <p className="text-lg text-zinc-400">
              From order taking to kitchen management, payments to reports—all in one place
            </p>
          </div>

          {/* Features grid - cleaner, simpler */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Feature 1 */}
            <div className="text-center md:text-left">
              <div className="inline-flex w-12 h-12 rounded-full bg-blue-600/10 items-center justify-center mb-4">
                <Wifi className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Works offline</h3>
              <p className="text-zinc-400">
                Keep taking orders even when your internet goes down. Everything syncs automatically when you're back online.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center md:text-left">
              <div className="inline-flex w-12 h-12 rounded-full bg-yellow-600/10 items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Kitchen display</h3>
              <p className="text-zinc-400">
                Real-time order updates on your kitchen display. Track prep times and keep your team in sync.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center md:text-left">
              <div className="inline-flex w-12 h-12 rounded-full bg-green-600/10 items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Sales reports</h3>
              <p className="text-zinc-400">
                Track your sales, inventory, and staff performance with detailed analytics and insights.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="text-center md:text-left">
              <div className="inline-flex w-12 h-12 rounded-full bg-purple-600/10 items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Multi-location</h3>
              <p className="text-zinc-400">
                Manage all your restaurant locations from one dashboard. Switch between branches instantly.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="text-center md:text-left">
              <div className="inline-flex w-12 h-12 rounded-full bg-orange-600/10 items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Online ordering</h3>
              <p className="text-zinc-400">
                Accept orders from Swiggy and Zomato directly in your POS. All orders in one place.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="text-center md:text-left">
              <div className="inline-flex w-12 h-12 rounded-full bg-pink-600/10 items-center justify-center mb-4">
                <Smartphone className="h-6 w-6 text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">Touch optimized</h3>
              <p className="text-zinc-400">
                Works great on tablets and touchscreens. On-screen keyboard included for easy input.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-zinc-100 mb-4">Why Choose YourPOS?</h2>
            <p className="text-xl text-zinc-400">
              Built specifically for restaurants who can't afford downtime
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-600/30">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-zinc-100">Lightning Fast</h3>
              <p className="text-zinc-400">
                Native desktop app built with Tauri for instant performance, even on older hardware.
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-green-600/30">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-zinc-100">100% Secure</h3>
              <p className="text-zinc-400">
                Your data is encrypted and isolated per restaurant. We never share data across tenants.
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-yellow-600/30">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-zinc-100">Easy Setup</h3>
              <p className="text-zinc-400">
                Get started in minutes. No complicated hardware or long training required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - Square Style */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold text-zinc-100 mb-4">
            Simple pricing that grows with you
          </h2>
          <p className="text-lg text-zinc-400">
            Start with a free trial. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Trial */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-2xl text-zinc-100">Trial</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-zinc-100">Free</span>
                <span className="text-zinc-500"> / 14 days</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">1 location</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">5 users</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">100 products</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">All features</span>
                </li>
              </ul>
              <Link to="/setup" className="block">
                <Button className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100" variant="outline">Start Free Trial</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Basic */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-2xl text-zinc-100">Basic</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-zinc-100">₹999</span>
                <span className="text-zinc-500"> / month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">1 location</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">5 users</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">100 products</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">Basic reports</span>
                </li>
              </ul>
              <Link to="/setup" className="block">
                <Button className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100" variant="outline">Get Started</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="bg-zinc-900 border-blue-600 border-2 relative shadow-lg shadow-blue-600/20">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                POPULAR
              </span>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl text-zinc-100">Pro</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-zinc-100">₹2,999</span>
                <span className="text-zinc-500"> / month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">3 locations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">15 users</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">500 products</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">Aggregator integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">Advanced reports</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300">Priority support</span>
                </li>
              </ul>
              <Link to="/setup" className="block">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">Get Started</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-zinc-500">
            Need more? <a href="/contact" className="text-blue-500 hover:text-blue-400 hover:underline">Contact us</a> for Enterprise pricing
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-black text-zinc-100 mb-4">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-xl text-zinc-300 mb-8">
            Join hundreds of restaurants already using YourPOS
          </p>
          <Link to="/setup">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 shadow-lg shadow-blue-600/20">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="mt-6 text-sm text-zinc-500">
            No credit card required • 14 days free • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-900/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-blue-600 p-1.5 rounded-lg">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-zinc-100">YourPOS</span>
              </div>
              <p className="text-sm text-zinc-400">
                The offline-first POS system built for modern restaurants.
              </p>
            </div>

            <div>
              <h3 className="text-zinc-100 font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-zinc-400 hover:text-zinc-100 transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-zinc-400 hover:text-zinc-100 transition-colors">Pricing</a></li>
                <li><Link to="/setup" className="text-zinc-400 hover:text-zinc-100 transition-colors">Sign Up</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-zinc-100 font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/docs" className="text-zinc-400 hover:text-zinc-100 transition-colors">Documentation</a></li>
                <li><a href="/contact" className="text-zinc-400 hover:text-zinc-100 transition-colors">Contact Us</a></li>
                <li><a href="/faq" className="text-zinc-400 hover:text-zinc-100 transition-colors">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-zinc-100 font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/privacy" className="text-zinc-400 hover:text-zinc-100 transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="text-zinc-400 hover:text-zinc-100 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-800 mt-12 pt-8 text-center text-sm text-zinc-500">
            <p>&copy; 2024 YourPOS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
