import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { lazyPage } from "./lib/lazyPage";
import PageBoundary from "./components/PageBoundary";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";
import PublicLayout from "./components/PublicLayout";
import ScrollManager from "./components/ScrollManager";
import ToastProvider from "./components/ToastProvider";
import Landing from "./pages/Landing";

// Login, sign-up and the landing page are in the main file, since they're what visitors see first.
// Every other page's code is downloaded when it's first opened.
const Tracker = lazyPage(() => import("./pages/Tracker"));
const ImportTransactions = lazyPage(() => import("./pages/ImportTransactions"));
const MonthlyRecap = lazyPage(() => import("./pages/MonthlyRecap"));
const YearReview = lazyPage(() => import("./pages/YearReview"));
const Home = lazyPage(() => import("./pages/Home"));
const Discuss = lazyPage(() => import("./pages/Discuss"));
const DiscussPost = lazyPage(() => import("./pages/DiscussPost"));
const Learn = lazyPage(() => import("./pages/Learn"));
const LearnTerm = lazyPage(() => import("./pages/LearnTerm"));
const Calculators = lazyPage(() => import("./pages/Calculators"));
const CalculatorPage = lazyPage(() => import("./pages/CalculatorPage"));
const Profile = lazyPage(() => import("./pages/Profile"));
const FollowList = lazyPage(() => import("./pages/FollowList"));
const FollowRequests = lazyPage(() => import("./pages/FollowRequests"));
const SettingsLayout = lazyPage(() => import("./pages/settings/SettingsLayout"));
const SettingsSection = lazyPage(() => import("./pages/settings/SettingsLayout").then((m) => ({ default: m.SettingsSection })));
const ForgotPassword = lazyPage(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyPage(() => import("./pages/ResetPassword"));
const VerifyEmail = lazyPage(() => import("./pages/VerifyEmail"));

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
        {/* Pages outside the layouts (password reset, email confirmation) load here */}
        <PageBoundary>
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
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/home" element={<Home />} />
                <Route path="/tracker" element={<Tracker />} />
                <Route path="/tracker/import" element={<ImportTransactions />} />
                <Route path="/tracker/recap/:month" element={<MonthlyRecap />} />
                <Route path="/tracker/year/:year" element={<YearReview />} />
                {/* Old address, kept so bookmarks and installed apps still work */}
                <Route path="/dashboard" element={<Navigate to="/home" replace />} />
                <Route path="/discuss" element={<Discuss />} />
                <Route path="/discuss/:id" element={<DiscussPost />} />
                <Route path="/u/:username" element={<Profile />} />
                <Route path="/u/:username/followers" element={<FollowList which="followers" />} />
                <Route path="/u/:username/following" element={<FollowList which="following" />} />
                <Route path="/follow-requests" element={<FollowRequests />} />
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
        </PageBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
