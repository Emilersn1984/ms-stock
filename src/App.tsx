import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">MS Stock</h1>
          <p className="text-gray-500">Mooring Solution — Gestion des stocks</p>
          <p className="mt-4 text-sm text-green-600 font-medium">✅ Phase 0 — Environnement opérationnel</p>
        </div>
      </div>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
