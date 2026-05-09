import { createBrowserRouter } from 'react-router-dom';

import ConnectRedirect from '@screens/ConnectRedirect';
import Home from '@screens/Home';
import InviteRedirect from '@screens/InviteRedirect';
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
        path: 'connect',
        element: <ConnectRedirect />,
      },
      {
        path: 'invite/:channelId/:inviteCode',
        element: <InviteRedirect />,
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
      {
        path: 'data-deletion',
        HydrateFallback: Loading,
        lazy: async () => {
          const { default: DataDeletion } = await import('@screens/DataDeletion');
          return { Component: DataDeletion };
        },
      },
    ],
  },
]);
