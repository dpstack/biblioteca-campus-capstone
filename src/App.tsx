import { lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SiteLayout } from "./components/SiteLayout";
import { HomePage } from "./pages/HomePage";
const CatalogPage = lazy(() =>
  import("./pages/CatalogPage").then((module) => ({
    default: module.CatalogPage,
  })),
);
const BookPage = lazy(() =>
  import("./pages/BookPage").then((module) => ({ default: module.BookPage })),
);
const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })),
);

const AccountPage = lazy(() => import("./pages/AccountPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

function LegacyRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

function LegacyBookRedirect() {
  const { workId } = useParams();
  return <LegacyRedirect to={`/books/${workId}`} />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="books/:workId" element={<BookPage />} />
            <Route path="login" element={<AuthPage />} />
            <Route path="my-library" element={<AccountPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="catalogo" element={<LegacyRedirect to="/catalog" />} />
            <Route path="libro/:workId" element={<LegacyBookRedirect />} />
            <Route path="acceso" element={<LegacyRedirect to="/login" />} />
            <Route
              path="mi-biblioteca"
              element={<LegacyRedirect to="/my-library" />}
            />
            <Route
              path="administracion"
              element={<LegacyRedirect to="/admin" />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
