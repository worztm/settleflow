import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app/auth" element={<Auth />} />
        <Route path="/app" element={<Dashboard />} />
      </Routes>
    </AuthProvider>
  )
}
