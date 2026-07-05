import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import MascotIllustration from '../components/MascotIllustration'

// ログイン後に表示する「場所」の登録・選択画面
// 自宅・職場・最寄り駅など、ユーザー自身が確認したい場所を自由に登録できる
export default function StoreSelect() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // 自分が登録した場所の一覧をSupabaseから取得する
  const fetchLocations = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setLocations(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  const resetForm = () => {
    setName('')
    setEditingId(null)
  }

  // 場所の新規登録・編集の送信処理（INSERT / UPDATE）
  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    const { error } = editingId
      ? await supabase.from('locations').update({ name }).eq('id', editingId)
      : await supabase.from('locations').insert({ name })

    if (error) {
      setErrorMessage(error.message)
    } else {
      resetForm()
      await fetchLocations()
    }
    setSubmitting(false)
  }

  const handleEdit = (location) => {
    setEditingId(location.id)
    setName(location.name)
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm('この場所を削除しますか？')
    if (!confirmed) return

    setErrorMessage('')
    const { error } = await supabase.from('locations').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      if (editingId === id) resetForm()
      await fetchLocations()
    }
  }

  // 選択した場所をもとに登録店チラシ一覧画面へ遷移する
  const handleSelect = (location) => {
    navigate('/competitors', { state: { storeName: location.name, locationId: location.id } })
  }

  return (
    <div className="locations-page">
      <header className="store-header">
        <span>{user?.email}</span>
        <button type="button" onClick={signOut}>
          ログアウト
        </button>
      </header>

      <div className="locations-intro">
        <MascotIllustration size={100} className="auth-mascot" />
        <h1>場所の登録・選択</h1>
        <p>自宅・職場・最寄り駅など、確認したい場所を登録してください。</p>
      </div>

      {errorMessage && <p className="auth-error">{errorMessage}</p>}

      <form className="competitor-form location-form" onSubmit={handleSubmit}>
        <h2>{editingId ? '場所の編集' : '場所の新規登録'}</h2>

        <label htmlFor="name">場所の名称</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 自宅、職場、最寄り駅"
          required
        />

        <div className="competitor-form-actions">
          <button type="submit" disabled={submitting}>
            {editingId ? '更新する' : '登録する'}
          </button>
          {editingId && (
            <button type="button" className="link-button" onClick={resetForm}>
              編集をキャンセル
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <table className="competitor-table">
          <thead>
            <tr>
              <th>場所の名称</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.id}>
                <td>{location.name}</td>
                <td className="competitor-table-actions">
                  <button type="button" onClick={() => handleSelect(location)}>
                    選択
                  </button>
                  <button type="button" onClick={() => handleEdit(location)}>
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(location.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={2}>登録されている場所はまだありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
