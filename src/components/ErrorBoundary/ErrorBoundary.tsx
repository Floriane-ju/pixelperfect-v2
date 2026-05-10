import { Component } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/Button';
import styles from './ErrorBoundary.module.scss';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <p className={styles.message}>Une erreur inattendue s'est produite.</p>
          <div className={styles.actions}>
            <Button variant="primary" onClick={this.handleRetry}>Réessayer</Button>
            <Button variant="secondary" onClick={() => { window.location.href = '/'; }}>← Retour à la galerie</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
