import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// ログイン後に表示する店舗選択画面
// TODO: 店舗一覧はSupabaseのテーブルから取得するように拡張する
const STORE_OPTIONS = ['本店', '駅前店', '郊外店']

export default function StoreSelect() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [selectedStore, setSelectedStore] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    // 選択した店舗をもとに競合店チラシ一覧画面へ遷移する
    navigate('/competitors', { state: { storeName: selectedStore } })
  }

  return (
    <div className="store-page">
      <header className="store-header">
        <span>{user?.email}</span>
        <button type="button" onClick={signOut}>
          ログアウト
        </button>
      </header>

      <form className="store-form" onSubmit={handleSubmit}>
        <h1>店舗選択</h1>
        <label htmlFor="store">確認する店舗を選択してください</label>
        <select
          id="store"
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          required
        >
          <option value="" disabled>
            店舗を選択
          </option>
          {STORE_OPTIONS.map((store) => (
            <option key={store} value={store}>
              {store}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!selectedStore}>
          次へ
        </button>
      </form>
    </div>
  )
}
