import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// 未ログインの場合はログイン画面へリダイレクトするラッパーコンポーネント
export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="loading">読み込み中...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}
