import styles from './ReferenceImage.module.scss';

interface Props {
  src: string;
  x: number;
  y: number;
  scale: number;
  naturalWidth: number;
}

export function ReferenceImage({ src, x, y, scale, naturalWidth }: Props) {
  return (
    <div
      className={styles.wrapper}
      style={{ left: x, top: y, width: naturalWidth * scale }}
    >
      <img src={src} alt="Référence" className={styles.image} draggable={false} />
    </div>
  );
}
