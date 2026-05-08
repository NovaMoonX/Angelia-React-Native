import { ErrorBoundary } from '@moondreamsdev/dreamer-ui/components';
import { DreamerUIProvider } from '@moondreamsdev/dreamer-ui/providers';
import { router } from '@routes/AppRoutes';
import { RouterProvider } from 'react-router-dom';

function App() {
  return (
    <ErrorBoundary
      fallback={<div className='p-6 text-center'>Something went wrong.</div>}
    >
      <DreamerUIProvider theme={{ defaultTheme: 'light' }}>
        <RouterProvider router={router} />
      </DreamerUIProvider>
    </ErrorBoundary>
  );
}

export default App;
