import { Link } from "react-router-dom";

function NotFound() {
  const signedIn = Boolean(localStorage.getItem("token"));

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">Page not found</h1>
        <p className="mt-2 text-ink-500">The page you're looking for doesn't exist or has moved.</p>
        <Link
          to={signedIn ? "/dashboard" : "/login"}
          className="mt-6 inline-block bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-brand-700 transition"
        >
          {signedIn ? "Back to dashboard" : "Go to login"}
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
