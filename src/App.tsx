import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Clients from "./pages/Clients";
import ClientProfile from "./pages/ClientProfile";
import GalleryCreate from "./pages/GalleryCreate";
import DeliverCreate from "./pages/DeliverCreate";
import GalleryDetail from "./pages/GalleryDetail";
import GalleryEdit from "./pages/GalleryEdit";
import GalleryPreview from "./pages/GalleryPreview";
import ClientGallery from "./pages/ClientGallery";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import Credits from "./pages/Credits";
import CreditsCheckout from "./pages/CreditsCheckout";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Retry once for 401 errors (auth race condition safety net)
        if ((error as any)?.code === '401' || (error as any)?.status === 401) {
          return failureCount < 1;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/access-denied" element={<AccessDenied />} />
              {/* Client gallery access via public token - new route */}
              <Route path="/g/:token" element={<ClientGallery />} />
              {/* Legacy route - redirect to new format (will be handled in component) */}
              <Route path="/client/:id" element={<ClientGallery />} />
              
              {/* Photographer preview route (no layout - simulates client view) */}
              <Route path="/gallery/:id/preview" element={
                <ProtectedRoute>
                  <GalleryPreview />
                </ProtectedRoute>
              } />
              
              {/* Protected photographer routes (with layout) */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout><Index /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/clients" element={
                <ProtectedRoute>
                  <Layout><Clients /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/clients/:clientId" element={
                <ProtectedRoute>
                  <Layout><ClientProfile /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/gallery/new" element={
                <ProtectedRoute>
                  <Layout><GalleryCreate /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/deliver/new" element={
                <ProtectedRoute>
                  <Layout><DeliverCreate /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/gallery/:id" element={
                <ProtectedRoute>
                  <Layout><GalleryDetail /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/gallery/:id/edit" element={
                <ProtectedRoute>
                  <Layout><GalleryEdit /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout><Settings /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/account" element={
                <ProtectedRoute>
                  <Layout><Account /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/credits" element={
                <ProtectedRoute>
                  <Layout><Credits /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/credits/checkout" element={
                <ProtectedRoute>
                  <CreditsCheckout />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute>
                  <Layout><Admin /></Layout>
                </ProtectedRoute>
              } />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
