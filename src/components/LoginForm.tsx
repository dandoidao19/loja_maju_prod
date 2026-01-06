'use client'

import { supabase } from '@/lib/supabase'
import { useState } from 'react'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Tenta fazer login direto (se usuário já existe)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Se não conseguiu login, tenta cadastrar
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          alert('Erro: ' + signUpError.message)
        } else {
          alert('Cadastrado com sucesso! Faça login agora.')
        }
      } else {
        // Login bem-sucedido
        window.location.href = '/dashboard'
      }
    } catch (error) {
      alert('Erro inesperado: ' + error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Login - Loja Maju</h2>
      
      {/* BOTÃO DE TESTE RÁPIDO */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setEmail('teste@lojamaju.com')
            setPassword('123456')
          }}
          className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 mb-2"
        >
          Preencher Dados de Teste
        </button>
        <p className="text-xs text-gray-600 text-center">
          Email: teste@lojamaju.com | Senha: 123456
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Carregando...' : 'Entrar / Cadastrar'}
        </button>
      </form>
    </div>
  )
}