import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import StoreSelect from './pages/StoreSelect'
import Competitors from './pages/Competitors'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/stores"
          element={
            <ProtectedRoute>
              <StoreSelect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/competitors"
          element={
            <ProtectedRoute>
              <Competitors />
            </ProtectedRoute>
          }
        />
        {/* 未定義のパスは店舗選択画面へ寄せる（未ログインならProtectedRouteがログイン画面へ戻す） */}
        <Route path="*" element={<Navigate to="/stores" replace />} />
      </Routes>
    </AuthProvider>
  )
}
