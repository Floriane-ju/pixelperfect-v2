import styles from './Icons.module.scss';

export type IconName =
  | 'pen'
  | 'more'
  | 'circle'
  | 'rect'
  | 'line'
  | 'export'
  | 'save'
  | 'close'
  | 'grid'
  | 'eye'
  | 'eye-off'
  | 'add'
  | 'mirror'
  | 'mirror-v'
  | 'undo'
  | 'redo'
  | 'back'
  | 'drag'
  | 'edit'
  | 'select'
  | 'duplicate'
  | 'check'
  | 'trash'
  | 'layers'
  | 'reference'
  | 'fill'
  | 'erase';

export interface IconsProps {
  icon: IconName;
  size?: number;
  className?: string;
}

function renderIcon(icon: IconName): React.ReactNode {
  switch (icon) {
    case 'pen':
      return (
        <>
          <path d="M1 4L2 4L2 6L4 6L4 7L1 7zM2 3L3 3L3 4L2 4zM3 2L4 2L4 3L3 3zM4 1L5 1L5 2L4 2zM4 5L5 5L5 6L4 6zM5 2L6 2L6 3L5 3zM5 4L6 4L6 5L5 5zM6 3L7 3L7 4L6 4z"/>
        </>
      );
    case 'more':
      return (
        <>
          <path d="M3 0L4 0L4 1L3 1zM3 3L4 3L4 4L3 4zM3 6L4 6L4 7L3 7zM4 1L5 1L5 2L4 2zM4 4L5 4L5 5L4 5zM4 7L5 7L5 8L4 8z"/>
        </>
      );
    case 'circle':
      return (
        <>
          <path d="M0 2L1 2L1 6L0 6zM1 1L2 1L2 2L1 2zM1 6L2 6L2 7L1 7zM2 0L6 0L6 1L2 1zM2 7L6 7L6 8L2 8zM6 1L7 1L7 2L6 2zM6 6L7 6L7 7L6 7zM7 2L8 2L8 6L7 6z"/>
        </>
      );
    case 'rect':
      return (
        <>
          <path d="M1 1L7 1L7 7L1 7zM2 2L2 6L6 6L6 2z"/>
        </>
      );
    case 'line':
      return (
        <>
          <path d="M0 6L2 6L2 8L0 8zM2 5L3 5L3 6L2 6zM3 4L4 4L4 5L3 5zM4 3L5 3L5 4L4 4zM5 2L6 2L6 3L5 3zM6 0L8 0L8 2L6 2z"/>
        </>
      );
    case 'export':
      return (
        <>
          <path d="M0 5L1 5L1 7L7 7L7 5L8 5L8 8L0 8zM1 2L2 2L2 3L1 3zM2 1L3 1L3 2L2 2zM3 0L5 0L5 1L3 1zM3 3L4 3L4 4L3 4zM3 5L4 5L4 6L3 6zM4 2L5 2L5 3L4 3zM4 4L5 4L5 5L4 5zM5 1L6 1L6 2L5 2zM6 2L7 2L7 3L6 3z"/>
        </>
      );
    case 'save':
      return (
        <>
          <path d="M0 0L7 0L7 1L5 1L5 2L6 2L6 3L2 3L2 1L1 1L1 7L2 7L2 5L6 5L6 7L7 7L7 1L8 1L8 8L0 8z"/>
        </>
      );
    case 'close':
      return (
        <>
          <path d="M1 1L2 1L2 2L1 2zM1 6L2 6L2 7L1 7zM2 2L3 2L3 3L2 3zM2 5L3 5L3 6L2 6zM3 3L4 3L4 4L3 4zM4 4L5 4L5 5L4 5zM5 2L6 2L6 3L5 3zM5 5L6 5L6 6L5 6zM6 1L7 1L7 2L6 2zM6 6L7 6L7 7L6 7z"/>
        </>
      );
    case 'grid':
      return (
        <>
          <path d="M0 2L2 2L2 0L3 0L3 2L5 2L5 0L6 0L6 2L8 2L8 3L6 3L6 5L8 5L8 6L6 6L6 8L5 8L5 6L3 6L3 8L2 8L2 6L0 6L0 5L2 5L2 3L0 3zM3 3L3 5L5 5L5 3z"/>
        </>
      );
    case 'eye':
      return (
        <>
          <path d="M0 3L1 3L1 5L0 5zM1 2L2 2L2 3L1 3zM1 5L2 5L2 6L1 6zM2 1L6 1L6 2L5 2L5 3L4 3L4 4L5 4L5 3L6 3L6 5L5 5L5 6L6 6L6 7L2 7L2 6L3 6L3 5L2 5L2 3L3 3L3 2L2 2zM6 2L7 2L7 3L6 3zM6 5L7 5L7 6L6 6zM7 3L8 3L8 5L7 5z"/>
        </>
      );
    case 'eye-off':
      return (
        <>
          <path d="M0 0L1 0L1 1L0 1zM0 3L1 3L1 5L0 5zM1 1L6 1L6 2L5 2L5 3L4 3L4 4L3 4L3 3L2 3L2 2L1 2zM1 5L2 5L2 6L1 6zM2 6L4 6L4 7L2 7zM4 4L5 4L5 3L6 3L6 5L7 5L7 6L8 6L8 8L7 8L7 7L6 7L6 6L5 6L5 5L4 5zM6 2L7 2L7 3L6 3zM7 3L8 3L8 5L7 5z"/>
        </>
      );
    case 'add':
      return (
        <>
          <path d="M1 3L3 3L3 1L5 1L5 3L7 3L7 5L5 5L5 7L3 7L3 5L1 5z"/>
        </>
      );
    case 'mirror':
      return (
        <>
          <path d="M4 4.37115e-08V1H3V0L4 4.37115e-08ZM8 1V7H6V6H7V2H6L6 1L8 1ZM5 1L5 2H4L4 1L5 1ZM2 1V2L1 2L1 6H2V7H0L2.62268e-07 1L2 1ZM4 2V3H3V2H4ZM5 3V4H4V3H5ZM4 4V5H3L3 4H4ZM5 5V6H4V5H5ZM4 6V7H3V6H4ZM5 7V8H4V7H5Z"/>

        </>
      );
    case 'mirror-v':
      return (
        <>
          <path d="M0 4L1 4L1 5L0 5zM1 0L7 0L7 2L6 2L6 1L2 1L2 2L1 2zM1 3L2 3L2 4L1 4zM1 6L2 6L2 7L6 7L6 6L7 6L7 8L1 8zM2 4L3 4L3 5L2 5zM3 3L4 3L4 4L3 4zM4 4L5 4L5 5L4 5zM5 3L6 3L6 4L5 4zM6 4L7 4L7 5L6 5zM7 3L8 3L8 4L7 4z"/>
        </>
      );
    case 'undo':
      return (
        <>
          <path d="M0 3L1 3L1 2L2 2L2 3L7 3L7 4L2 4L2 5L1 5L1 4L0 4zM2 1L3 1L3 2L2 2zM2 5L3 5L3 6L2 6zM5 6L7 6L7 7L5 7zM7 4L8 4L8 6L7 6z"/>
        </>
      );
    case 'redo':
      return (
        <>
          <path d="M8 3H7V2H6V3H1V4H6V5H7V4H8V3ZM6 1H5V2H6V1ZM6 5H5V6H6V5ZM3 6H1V7H3V6ZM1 4H0V6H1V4Z"/>
        </>
      );
    case 'back':
      return (
        <>
          <path d="M2 3L3 3L3 5L2 5zM3 2L4 2L4 3L3 3zM3 5L4 5L4 6L3 6zM4 1L5 1L5 2L4 2zM4 6L5 6L5 7L4 7z"/>
        </>
      );
    case 'drag':
      return (
        <>
          <path d="M1 0L3 0L3 2L1 2zM1 3L3 3L3 5L1 5zM1 6L3 6L3 8L1 8zM5 0L7 0L7 2L5 2zM5 3L7 3L7 5L5 5zM5 6L7 6L7 8L5 8z"/>
        </>
      );
    case 'edit':
      return (
        <>
          <path d="M0 1L3 1L3 2L1 2L1 7L6 7L6 5L7 5L7 8L0 8zM2 4L3 4L3 5L4 5L4 6L2 6zM3 3L4 3L4 4L3 4zM4 2L5 2L5 3L4 3zM4 4L5 4L5 5L4 5zM5 1L6 1L6 2L5 2zM5 3L6 3L6 4L5 4zM6 0L7 0L7 1L6 1zM6 2L7 2L7 3L6 3zM7 1L8 1L8 2L7 2z"/>
        </>
      );
    case 'select':
      return (
        <>
          <path d="M4 4V16L8 12L10 20L13 18L11 11L16 11L4 4Z" />
        </>
      );
    case 'duplicate':
      return (
        <>
          <path d="M1 1L5 1L5 2L2 2L2 5L1 5zM3 3L7 3L7 7L3 7zM4 4L4 6L6 6L6 4z"/>;
        </>
      );
    case 'check':
      return (
        <>
          <path d="M1 5L2 5L2 6L1 6zM2 6L3 6L3 7L2 7zM3 5L4 5L4 6L3 6zM4 4L5 4L5 5L4 5zM5 3L6 3L6 4L5 4zM6 2L7 2L7 3L6 3z"/>
        </>
      );
    case 'trash':
      return (
        <>
          <path d="M0 2L2 2L2 0L6 0L6 2L8 2L8 3L7 3L7 7L6 7L6 8L2 8L2 7L1 7L1 3L0 3zM2 3L2 6L3 6L3 7L5 7L5 6L6 6L6 3zM3 1L3 2L5 2L5 1zM3 4L5 4L5 5L3 5z"/>
        </>
      );
    case 'layers':
      return (
        <>
          <path d="M1 2L2 2L2 3L1 3zM1 5L2 5L2 6L1 6zM2 1L3 1L3 2L2 2zM2 3L3 3L3 4L2 4zM2 6L3 6L3 7L2 7zM3 0L5 0L5 1L3 1zM3 4L5 4L5 5L3 5zM3 7L5 7L5 8L3 8zM5 1L6 1L6 2L5 2zM5 3L6 3L6 4L5 4zM5 6L6 6L6 7L5 7zM6 2L7 2L7 3L6 3zM6 5L7 5L7 6L6 6z"/>
        </>
      );
    case 'reference':
      return (
        <>
          <path d="M0 0L7 0L7 1L5 1L5 2L6 2L6 3L2 3L2 1L1 1L1 7L2 7L2 5L6 5L6 7L7 7L7 1L8 1L8 8L0 8z"/>
        </>
      );
    case 'fill':
      return (
        <>
          <path d="M1 4L2 4L2 3L3 3L3 4L6 4L6 5L5 5L5 6L4 6L4 7L3 7L3 6L2 6L2 5L1 5zM3 2L4 2L4 3L3 3zM4 1L5 1L5 2L4 2zM5 2L6 2L6 3L5 3zM6 3L7 3L7 4L6 4zM6 6L7 6L7 7L6 7z"/>
        </>
      );
    case 'erase':
      return (
        <>
          <path d="M1 4L2 4L2 5L1 5zM1 6L2 6L2 5L3 5L3 6L4 6L4 5L5 5L5 6L6 6L6 7L1 7zM2 3L3 3L3 4L2 4zM3 2L4 2L4 3L3 3zM4 1L5 1L5 2L4 2zM5 2L6 2L6 3L5 3zM5 4L6 4L6 5L5 5zM6 3L7 3L7 4L6 4z"/>
        </>
      );
    default:
      return null;
  }
}

export function Icons({ icon, size = 24, className }: IconsProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 8 8"
      width={size}
      height={size}
      fill="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[styles.icon, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {renderIcon(icon)}
    </svg>
    
  );
}
