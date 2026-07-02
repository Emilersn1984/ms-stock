import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import Livraisons from './pages/Livraisons'
import Fabrication from './pages/Fabrication'
import Nomenclature from './pages/Nomenclature'
import Historique from './pages/Historique'

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/livraisons" element={<Livraisons />} />
          <Route path="/fabrication" element={<Fabrication />} />
          <Route path="/nomenclature" element={<Nomenclature />} />
          <Route path="/historique" element={<Historique />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
