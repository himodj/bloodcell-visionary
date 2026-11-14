
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Analysis from "./pages/Analysis";
import Management from "./pages/Management";
import Search from "./pages/Search";
import ReportTemplate from "./pages/ReportTemplate";
import NotFound from "./pages/NotFound";
import { AnalysisProvider } from "./contexts/AnalysisContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <HashRouter>
        <AnalysisProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/management" element={<Management />} />
            <Route path="/search" element={<Search />} />
            <Route path="/report-template" element={<ReportTemplate />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnalysisProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
