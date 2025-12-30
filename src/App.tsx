import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Clients from "./pages/Clients";
import GalleryCreate from "./pages/GalleryCreate";
import GalleryDetail from "./pages/GalleryDetail";
import ClientGallery from "./pages/ClientGallery";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <Routes>
            {/* Client-facing routes (no layout) */}
            <Route path="/client/:id" element={<ClientGallery />} />
            
            {/* Photographer routes (with layout) */}
            <Route path="/" element={<Layout><Index /></Layout>} />
            <Route path="/clients" element={<Layout><Clients /></Layout>} />
            <Route path="/gallery/new" element={<Layout><GalleryCreate /></Layout>} />
            <Route path="/gallery/:id" element={<Layout><GalleryDetail /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
