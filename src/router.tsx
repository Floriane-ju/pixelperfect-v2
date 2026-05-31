import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { Gallery } from './routes/Gallery/Gallery';
import { Editor } from './routes/Editor/Editor';
import { Login } from './routes/Login';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const router = createBrowserRouter([
  {
    path: 'login',
    element: <Login />,
  },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <ErrorBoundary><Gallery /></ErrorBoundary> },
      { path: 'editor/:id', element: <ErrorBoundary><Editor /></ErrorBoundary> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
