// components/ModalValidacaoErros.tsx
'use client'

import { ResultadoValidacao } from '@/lib/ValidadorImportacao'
import { useState } from 'react'

interface ModalValidacaoErrosProps {
  resultado: ResultadoValidacao
  onFechar: () => void
  onTentarNovamente: () => void
  onBaixarRelatorio: (formato: 'txt' | 'html') => void
}

export default function ModalValidacaoErros({
  resultado,
  onFechar,
  onTentarNovamente,
  onBaixarRelatorio
}: ModalValidacaoErrosProps) {
  const [abaAtiva, setAbaAtiva] = useState<'resumo' | 'erros' | 'avisos'>('resumo')
  
  // Agrupar erros por linha
  const errosPorLinha = new Map<number, typeof resultado.erros>()
  resultado.erros.forEach(erro => {
    if (!errosPorLinha.has(erro.linha)) {
      errosPorLinha.set(erro.linha, [])
    }
    errosPorLinha.get(erro.linha)!.push(erro)
  })
  
  const linhasComErro = Array.from(errosPorLinha.entries()).sort((a, b) => a[0] - b[0])

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`p-6 rounded-t-lg ${resultado.valido ? 'bg-green-50 border-b-4 border-green-500' : 'bg-red-50 border-b-4 border-red-500'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-2xl font-bold ${resultado.valido ? 'text-green-800' : 'text-red-800'}`}>
                {resultado.valido ? '✅ Validação Concluída' : '❌ Validação Falhou'}
              </h2>
              <p className={`mt-1 ${resultado.valido ? 'text-green-700' : 'text-red-700'}`}>
                {resultado.valido 
                  ? 'Todos os dados estão corretos e prontos para importação!'
                  : 'Foram encontrados erros que impedem a importação. Corrija-os e tente novamente.'}
              </p>
            </div>
            <button
              onClick={onFechar}
              className="text-gray-500 hover:text-gray-700 text-3xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          <button
            onClick={() => setAbaAtiva('resumo')}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              abaAtiva === 'resumo'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📊 Resumo
          </button>
          {resultado.erros.length > 0 && (
            <button
              onClick={() => setAbaAtiva('erros')}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                abaAtiva === 'erros'
                  ? 'border-b-2 border-red-500 text-red-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🚨 Erros ({resultado.erros.length})
            </button>
          )}
          {resultado.avisos.length > 0 && (
            <button
              onClick={() => setAbaAtiva('avisos')}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                abaAtiva === 'avisos'
                  ? 'border-b-2 border-yellow-500 text-yellow-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ⚠️ Avisos ({resultado.avisos.length})
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Aba Resumo */}
          {abaAtiva === 'resumo' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-600 font-medium">Total de Linhas</div>
                  <div className="text-3xl font-bold text-blue-800 mt-1">{resultado.totalLinhas}</div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 font-medium">✅ Linhas Válidas</div>
                  <div className="text-3xl font-bold text-green-800 mt-1">{resultado.linhasValidas}</div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="text-sm text-red-600 font-medium">❌ Linhas Inválidas</div>
                  <div className="text-3xl font-bold text-red-800 mt-1">{resultado.linhasInvalidas}</div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="text-sm text-yellow-600 font-medium">🚨 Total de Erros</div>
                  <div className="text-3xl font-bold text-yellow-800 mt-1">{resultado.erros.length}</div>
                </div>
              </div>

              {resultado.valido && (
                <div className="bg-green-100 border border-green-300 rounded-lg p-4 mt-6">
                  <h3 className="font-semibold text-green-800 mb-2">✅ Pronto para Importar!</h3>
                  <p className="text-green-700 text-sm">
                    Todas as {resultado.linhasValidas} linhas foram validadas com sucesso. 
                    Você pode prosseguir com a importação clicando no botão "Importar Dados" abaixo.
                  </p>
                </div>
              )}

              {!resultado.valido && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-4 mt-6">
                  <h3 className="font-semibold text-red-800 mb-2">❌ Importação Bloqueada</h3>
                  <p className="text-red-700 text-sm mb-3">
                    Foram encontrados {resultado.erros.length} erro(s) em {resultado.linhasInvalidas} linha(s). 
                    Corrija os erros no arquivo Excel e tente novamente.
                  </p>
                  <div className="bg-white rounded p-3 text-sm">
                    <p className="font-medium text-gray-800 mb-2">💡 Dicas para correção:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      <li>Verifique a aba "Erros" para ver detalhes de cada problema</li>
                      <li>Baixe o relatório completo para facilitar a correção</li>
                      <li>Certifique-se de que todas as colunas obrigatórias estão preenchidas</li>
                      <li>Verifique se os formatos de data e valor estão corretos</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aba Erros */}
          {abaAtiva === 'erros' && (
            <div className="space-y-4">
              {linhasComErro.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">✅</div>
                  <p>Nenhum erro encontrado!</p>
                </div>
              ) : (
                linhasComErro.map(([linha, erros]) => (
                  <div key={linha} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-red-800">📍 Linha {linha}</h3>
                      <span className="bg-red-200 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                        {erros.length} erro(s)
                      </span>
                    </div>
                    <div className="space-y-2">
                      {erros.map((erro, index) => (
                        <div key={index} className="bg-white rounded p-3 border border-red-100">
                          <div className="flex items-start">
                            <span className="text-red-500 mr-2">❌</span>
                            <div className="flex-1">
                              <div className="font-medium text-red-800">{erro.campo}</div>
                              <div className="text-sm text-red-700 mt-1">{erro.mensagem}</div>
                              <div className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded font-mono">
                                Valor recebido: <span className="font-semibold">"{erro.valor}"</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Aba Avisos */}
          {abaAtiva === 'avisos' && (
            <div className="space-y-3">
              {resultado.avisos.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">✅</div>
                  <p>Nenhum aviso encontrado!</p>
                </div>
              ) : (
                resultado.avisos.map((aviso, index) => (
                  <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <span className="text-yellow-500 mr-2 text-xl">⚠️</span>
                      <div className="flex-1">
                        <div className="font-medium text-yellow-800">
                          Linha {aviso.linha} - {aviso.campo}
                        </div>
                        <div className="text-sm text-yellow-700 mt-1">{aviso.mensagem}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-lg">
          <div className="flex flex-wrap gap-3">
            {/* Botões de download */}
            <button
              onClick={() => onBaixarRelatorio('txt')}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              📄 Baixar Relatório (.txt)
            </button>
            
            <button
              onClick={() => onBaixarRelatorio('html')}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              🌐 Baixar Relatório (.html)
            </button>

            <div className="flex-1"></div>

            {/* Botões de ação */}
            {!resultado.valido && (
              <button
                onClick={onTentarNovamente}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                🔄 Tentar Novamente
              </button>
            )}
            
            <button
              onClick={onFechar}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm font-medium"
            >
              {resultado.valido ? 'Fechar' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
