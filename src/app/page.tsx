
'use client';

import AuthGuard from '@/components/AuthGuard';
import TelaInicialLoja from '@/components/TelaInicialLoja';

export default function Home() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-100 p-4">
        <div className="container mx-auto">
          <TelaInicialLoja />
        </div>
      </main>
    </AuthGuard>
  );
}
