/**
 * Funções auxiliares para cálculo de datas de parcelas
 * Baseado no ModuloCasa
 */

export const getDataNDias = (dataBase: string, dias: number): string => {
  const data = new Date(dataBase)
  data.setDate(data.getDate() + dias)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export const addMonths = (dateString: string, months: number): string => {
  const [ano, mes, dia] = dateString.split('-').map(Number)
  const date = new Date(ano, mes - 1 + months, dia)

  // Ajuste para meses com menos dias (ex: 31/01 + 1 mês = 28/02)
  if (date.getDate() !== dia) {
    date.setDate(0)
  }

  const novoAno = date.getFullYear()
  const novoMes = String(date.getMonth() + 1).padStart(2, '0')
  const novoDia = String(date.getDate()).padStart(2, '0')

  return `${novoAno}-${novoMes}-${novoDia}`
}

export const calcularDataPorPrazo = (dataBase: string, prazo: string): string => {
  switch (prazo) {
    case 'diaria':
      return getDataNDias(dataBase, 2)
    case 'semanal':
      return getDataNDias(dataBase, 8)
    case '10dias':
      return getDataNDias(dataBase, 11)
    case 'quinzenal':
      return getDataNDias(dataBase, 16)
    case '20dias':
      return getDataNDias(dataBase, 21)
    case 'mensal':
      return addMonths(dataBase, 1)
    default:
      return dataBase
  }
}
