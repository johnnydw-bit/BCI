import Image from 'next/image'

interface BramleyHeaderProps {
  subtitle?: string
  right?: React.ReactNode
}

export default function BramleyHeader({ subtitle, right }: BramleyHeaderProps) {
  return (
    <div className="bramley-header flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Image
          src="https://bramley.intelligentgolf.co.uk/images/resources/bramley/bramley-new-home-logo-white.png"
          alt="Bramley Golf Club"
          width={48}
          height={48}
          className="shrink-0 object-contain"
          unoptimized
        />
        <div>
          <h1 className="text-lg font-bold leading-tight">Bramley Golf Club</h1>
          {subtitle && <p className="text-sm opacity-80 leading-tight">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
