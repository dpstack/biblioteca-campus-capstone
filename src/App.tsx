import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SiteLayout } from "./components/SiteLayout";
import { HomePage } from "./pages/HomePage";
import { CatalogPage } from "./pages/CatalogPage";
import { BookPage } from "./pages/BookPage";
import { AuthPage } from "./pages/AuthPage";

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
            <Route
              path="mi-biblioteca"
              element={
                <Suspense
                  fallback={
                    <div className="page-status">Cargando tu biblioteca…</div>
                  }
                >
                  <AccountPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
