import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Discuss from "./pages/Discuss";
import DiscussPost from "./pages/DiscussPost";
import Learn from "./pages/Learn";
import LearnTerm from "./pages/LearnTerm";
import AppLayout from "./components/AppLayout";

const isSignedIn = () => Boolean(localStorage.getItem("token"));

function RequireAuth() {
  return isSignedIn() ? <Outlet /> : <Navigate to="/login" replace />;
}

function RedirectIfSignedIn() {
  return isSignedIn() ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RedirectIfSignedIn />}>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/discuss" element={<Discuss />} />
            <Route path="/discuss/:id" element={<DiscussPost />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/learn/:slug" element={<LearnTerm />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to={isSignedIn() ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
