import { createBrowserRouter } from 'react-router-dom';

import Home from '@screens/Home';
import Layout from '@ui/Layout';
import Loading from '@ui/Loading';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'about',
        HydrateFallback: Loading,
        lazy: async () => {
          const { default: About } = await import('@screens/About');
          return { Component: About };
        },
      },
      {
        path: 'privacy-policy',
        HydrateFallback: Loading,
        lazy: async () => {
          const { default: PrivacyPolicy } = await import('@screens/PrivacyPolicy');
          return { Component: PrivacyPolicy };
        },
      },
    ],
  },
]);
