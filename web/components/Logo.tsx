import Image from "next/image";

type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 40, className = "" }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Fletch the hood cat"
      width={size}
      height={size}
      className={`rounded-lg object-cover ${className}`}
      priority
    />
  );
}
