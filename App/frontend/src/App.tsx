import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import AnalyzePage from './pages/AnalyzePage';
import ResultsPage from './pages/ResultsPage';
import StyleDetailPage from './pages/StyleDetailPage';
import ProTutorialPage from './pages/ProTutorialPage';
import HistoryPage from './pages/HistoryPage';
import LipstickFitPage from './pages/LipstickFitPage';
import SpinWheelPage from './pages/SpinWheelPage';

import CardTestPage from './pages/CardTestPage';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import AuthPage from './pages/AuthPage';
import LogoutCallbackPage from './pages/LogoutCallbackPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import CheckoutPlanPage from './pages/CheckoutPlanPage';
import BlogRoutes from './blog-routes';
import { AuthProvider } from './contexts/AuthContext';
import PageLayout from './components/PageLayout';
import ScrollToTop from './components/ScrollToTop';

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<PageLayout><Index /></PageLayout>} />
    <Route path="/analyze" element={<PageLayout><AnalyzePage /></PageLayout>} />
    <Route path="/results" element={<PageLayout><ResultsPage /></PageLayout>} />
    <Route path="/style/:styleId" element={<PageLayout><StyleDetailPage /></PageLayout>} />
    <Route path="/style/:styleId/pro" element={<PageLayout><ProTutorialPage /></PageLayout>} />
    <Route path="/style/:styleId/pro/:subStyleSlug" element={<PageLayout><ProTutorialPage /></PageLayout>} />
    <Route path="/history" element={<PageLayout><HistoryPage /></PageLayout>} />
    <Route path="/lipstick-fit" element={<PageLayout><LipstickFitPage /></PageLayout>} />
    <Route path="/spin-wheel" element={<PageLayout><SpinWheelPage /></PageLayout>} />

    <Route path="/card-test" element={<PageLayout><CardTestPage /></PageLayout>} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/logout-callback" element={<LogoutCallbackPage />} />
    <Route path="/checkout/plan" element={<PageLayout><CheckoutPlanPage /></PageLayout>} />
    <Route path="/checkout/success" element={<PageLayout><CheckoutSuccessPage /></PageLayout>} />
    <Route path="/blog/*" element={<PageLayout><BlogRoutes /></PageLayout>} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };