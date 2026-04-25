import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { Gallery } from './routes/Gallery/Gallery';
import { Editor } from './routes/Editor/Editor';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/gallery" replace /> },
      { path: 'gallery', element: <Gallery /> },
      { path: 'editor/:id', element: <Editor /> },
      { path: '*', element: <Navigate to="/gallery" replace /> },
    ],
  },
]);
