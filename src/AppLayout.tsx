import { Outlet } from 'react-router';
import { SnackbarProvider } from '@/components/Snackbar';
import { SessionProvider } from '@/components/SessionProvider';
import styles from './AppLayout.module.scss';

export function AppLayout() {
  return (
    <SessionProvider>
      <SnackbarProvider>
        <div className={styles.app}>
          <Outlet />
        </div>
      </SnackbarProvider>
    </SessionProvider>
  );
}
