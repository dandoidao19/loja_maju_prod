'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function OrcamentoMetasCasa() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Lógica para buscar dados de orçamento e metas da casa
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Orçamento e Metas - Casa</h2>
      {/* Formulários e lógica para orçamento e metas da casa virão aqui */}
    </div>
  );
}
