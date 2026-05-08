import { Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';

function Layout() {
  return (
    <div className='page relative transition-colors duration-200'>
      <ThemeToggle className='translate-y-4 translate-x-2 hidden sm:flex' />
      <Outlet />
      <ThemeToggle className='fixed bottom-3 left-3 sm:hidden' />
    </div>
  );
}

export default Layout;
