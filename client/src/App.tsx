import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Splash from "@/pages/Splash";
import Auth from "@/pages/Auth";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import Review from "@/pages/Review";
import DriverHome from "@/driver/pages/DriverHome";
import DriverProfile from "@/driver/pages/DriverProfile";
import RideHistory from "@/pages/RideHistory";
import DriverHistory from "@/driver/pages/DriverHistory";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Splash} />
      <Route path="/auth" component={Auth} />
      <Route path="/home" component={Home} />
      <Route path="/driver/home" component={DriverHome} />
      <Route path="/driver/profile" component={DriverProfile} />
      <Route path="/driver/history" component={DriverHistory} />
      <Route path="/profile" component={Profile} />
      <Route path="/history" component={RideHistory} />
      <Route path="/review" component={Review} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
