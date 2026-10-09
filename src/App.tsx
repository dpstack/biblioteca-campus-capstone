import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="catalogo" element={<CatalogPage />} />
            <Route path="libro/:workId" element={<BookPage />} />
            <Route path="acceso" element={<AuthPage />} />
            <Route path="mi-biblioteca" element={<AccountPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
