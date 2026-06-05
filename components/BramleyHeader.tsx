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
          src="/bramley-logo.jpg"
          alt="Bramley Golf Club"
          width={48}
          height={48}
          className="shrink-0 object-contain rounded-sm"
        />
        <div>
          <h1 className="text-lg font-bold leading-tight">Bramley Golf Club</h1>
          {subtitle && <p className="text-sm opacity-80 leading-tight">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex-1 flex justify-end">{right}</div>}
    </div>
  )
}
