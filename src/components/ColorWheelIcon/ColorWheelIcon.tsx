interface ColorWheelIconProps {
  size?: number;
  className?: string;
}

export function ColorWheelIcon({ size = 24, className }: ColorWheelIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 8 8"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <path fill="#f7ccca" fillRule="evenodd" d="M0 0L2 0L2 2L0 2Z" />
      <path fill="#ec4d3f" fillRule="evenodd" d="M0 2L2 2L2 4L0 4Z" />
      <path fill="#bb2f1d" fillRule="evenodd" d="M0 4L2 4L2 6L0 6Z" />
      <path fill="#320c07" fillRule="evenodd" d="M0 6L2 6L2 8L0 8Z" />
      <path fill="#d2fbcc" fillRule="evenodd" d="M2 0L4 0L4 2L2 2Z" />
      <path fill="#74f84c" fillRule="evenodd" d="M2 2L4 2L4 4L2 4Z" />
      <path fill="#55c52e" fillRule="evenodd" d="M2 4L4 4L4 6L2 6Z" />
      <path fill="#16340c" fillRule="evenodd" d="M2 6L4 6L4 8L2 8Z" />
      <path fill="#c9cafb" fillRule="evenodd" d="M4 0L6 0L6 2L4 2Z" />
      <path fill="#353bf7" fillRule="evenodd" d="M4 2L6 2L6 4L4 4Z" />
      <path fill="#0017c4" fillRule="evenodd" d="M4 4L6 4L6 6L4 6Z" />
      <path fill="#000534" fillRule="evenodd" d="M4 6L6 6L6 8L4 8Z" />
      <path fill="#f7ccfc" fillRule="evenodd" d="M6 0L8 0L8 2L6 2Z" />
      <path fill="#ec51f9" fillRule="evenodd" d="M6 2L8 2L8 4L6 4Z" />
      <path fill="#bb34c6" fillRule="evenodd" d="M6 4L8 4L8 6L6 6Z" />
      <path fill="#320e35" fillRule="evenodd" d="M6 6L8 6L8 8L6 8Z" />
    </svg>
  );
}
