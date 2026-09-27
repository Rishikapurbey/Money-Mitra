import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Discuss from "./pages/Discuss";
import DiscussPost from "./pages/DiscussPost";
import Learn from "./pages/Learn";
import LearnTerm from "./pages/LearnTerm";
import Calculators from "./pages/Calculators";
import CalculatorPage from "./pages/CalculatorPage";
import Settings from "./pages/Settings";
import AppLayout from "./components/AppLayout";
import PublicLayout from "./components/PublicLayout";
import Landing from "./pages/Landing";

const isSignedIn = () => Boolean(localStorage.getItem("token"));

function RequireAuth() {
  return isSignedIn() ? <Outlet /> : <Navigate to="/login" replace />;
}

function RedirectIfSignedIn() {
  return isSignedIn() ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

// Public pages (Learn, Calculators): signed-in users see them inside the app, visitors inside the public site
function PublicOrAppLayout() {
  return isSignedIn() ? <AppLayout /> : <PublicLayout />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RedirectIfSignedIn />}>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
          </Route>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/discuss" element={<Discuss />} />
            <Route path="/discuss/:id" element={<DiscussPost />} />
            <Route path="/settings" element={<Settings />} />
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
    </BrowserRouter>
  );
}

export default App;
