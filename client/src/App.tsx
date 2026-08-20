import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import RequireSession from "./components/RequireSession";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PublicSupport from "./pages/PublicSupport";

function ProtectedSupport() {
  return <RequireSession><PublicSupport /></RequireSession>;
}

function Router() {
  return <Switch><Route path="/login" component={Login} /><Route path="/" component={ProtectedSupport} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster theme="light" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
