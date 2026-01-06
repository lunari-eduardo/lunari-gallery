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
import GalleryCreate from "./pages/GalleryCreate";
import GalleryDetail from "./pages/GalleryDetail";
import GalleryPreview from "./pages/GalleryPreview";
import ClientGallery from "./pages/ClientGallery";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              <Route path="/gallery/new" element={
                <ProtectedRoute>
                  <Layout><GalleryCreate /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/gallery/:id" element={
                <ProtectedRoute>
                  <Layout><GalleryDetail /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout><Settings /></Layout>
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
