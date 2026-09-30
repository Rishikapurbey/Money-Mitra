import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Tracker from "./pages/Tracker";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Discuss from "./pages/Discuss";
import DiscussPost from "./pages/DiscussPost";
import Learn from "./pages/Learn";
import LearnTerm from "./pages/LearnTerm";
import Calculators from "./pages/Calculators";
import CalculatorPage from "./pages/CalculatorPage";
import SettingsLayout, { SettingsSection } from "./pages/settings/SettingsLayout";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AppLayout from "./components/AppLayout";
import PublicLayout from "./components/PublicLayout";
import ScrollManager from "./components/ScrollManager";
import ToastProvider from "./components/ToastProvider";
import Landing from "./pages/Landing";

const isSignedIn = () => Boolean(localStorage.getItem("token"));

function RequireAuth() {
  return isSignedIn() ? <Outlet /> : <Navigate to="/login" replace />;
}

function RedirectIfSignedIn() {
  return isSignedIn() ? <Navigate to="/home" replace /> : <Outlet />;
}

// Public pages (Learn, Calculators): signed-in users see them inside the app, visitors inside the public site
function PublicOrAppLayout() {
  return isSignedIn() ? <AppLayout /> : <PublicLayout />;
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ScrollManager />
        <Routes>
          <Route element={<RedirectIfSignedIn />}>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Landing />} />
            </Route>
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
          </Route>
          {/* Open to everyone: a reset link may be opened on a browser that's still logged in */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/tracker" element={<Tracker />} />
              {/* Old address, kept so bookmarks and installed apps still work */}
              <Route path="/dashboard" element={<Navigate to="/home" replace />} />
              <Route path="/discuss" element={<Discuss />} />
              <Route path="/discuss/:id" element={<DiscussPost />} />
              <Route path="/settings" element={<SettingsLayout />}>
                <Route path=":section" element={<SettingsSection />} />
              </Route>
            </Route>
          </Route>
          <Route element={<PublicOrAppLayout />}>
            <Route path="/learn" element={<Learn />} />
            <Route path="/learn/:slug" element={<LearnTerm />} />
            <Route path="/calculators" element={<Calculators />} />
            <Route path="/calculators/:slug" element={<CalculatorPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
