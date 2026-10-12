import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './AppLayout';
import { Gallery } from './routes/Gallery/Gallery';
import { Login } from './routes/Login';
import { ErrorBoundary, ErrorFallback } from '@/components/ErrorBoundary';

// Erreurs hors des limites React (chargement d'un chunk après déploiement, layout, page de login).
const routeError = <ErrorFallback onRetry={() => window.location.reload()} />;

export const router = createBrowserRouter([
  {
    path: 'login',
    element: <Login />,
    errorElement: routeError,
  },
  {
    // Lien public en lecture seule : sans session ni layout de l'application.
    path: 'p/:token',
    errorElement: routeError,
    lazy: async () => {
      const { PublicView } = await import('./routes/PublicView/PublicView');
      return { element: <ErrorBoundary><PublicView /></ErrorBoundary> };
    },
  },
  {
    element: <AppLayout />,
    errorElement: routeError,
    children: [
      { index: true, element: <ErrorBoundary><Gallery /></ErrorBoundary> },
      {
        path: 'editor/:id',
        // Canvas, calques, export : hors du bundle initial de la galerie.
        lazy: async () => {
          const { Editor } = await import('./routes/Editor/Editor');
          return { element: <ErrorBoundary><Editor /></ErrorBoundary> };
        },
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
