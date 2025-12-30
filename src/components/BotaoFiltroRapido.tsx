'use client'

interface BotaoFiltroRapidoProps {
  texto: string
  ativo: boolean
  onClick: () => void
  icone?: string
}

export default function BotaoFiltroRapido({ texto, ativo, onClick, icone }: BotaoFiltroRapidoProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
        ativo 
          ? 'bg-blue-500 text-white shadow-sm' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {icone && <span>{icone}</span>}
      {texto}
    </button>
  )
}