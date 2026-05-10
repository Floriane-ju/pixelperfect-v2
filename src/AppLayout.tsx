import { Outlet } from 'react-router-dom';
import styles from './AppLayout.module.scss';

export function AppLayout() {
  return (
    <div className={styles.app}>
      <Outlet />
    </div>
  );
}
