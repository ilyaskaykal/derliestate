/** Circular avatar: shows profile photo if set, otherwise colored initials. */

function initials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface UserAvatarProps {
  name: string;
  fotoUrl?: string | null;
  size?: number;   // px, default 32
  className?: string;
}

export default function UserAvatar({ name, fotoUrl, size = 32, className = '' }: UserAvatarProps) {
  const style = { width: size, height: size, minWidth: size, minHeight: size };
  const textSize = size <= 28 ? 'text-[10px]' : size <= 36 ? 'text-xs' : size <= 48 ? 'text-sm' : 'text-base';

  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={name}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold shrink-0 text-white ${textSize} ${className}`}
      style={{ ...style, background: '#C8804B' }}
    >
      {initials(name)}
    </div>
  );
}
