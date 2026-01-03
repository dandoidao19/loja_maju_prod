/**
 * Utilitários para gerenciar recursos baseados em ambiente
 */

/**
 * Verifica se os recursos de desenvolvimento estão habilitados
 * Em produção, esta variável deve ser 'false' ou não definida
 */
export const isDevFeaturesEnabled = (): boolean => {
  // Retorna true diretamente para habilitar todos os recursos em todos os ambientes
  return true
}

/**
 * Verifica se está em ambiente de produção
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production'
}

/**
 * Verifica se está em ambiente de desenvolvimento
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development'
}
