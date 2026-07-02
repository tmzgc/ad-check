import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// 新規登録・編集フォームの初期値
const EMPTY_FORM = {
  competitor_name: '',
  address: '',
  flyer_url: '',
  product_name: '',
  origin_or_maker: '',
  price: '',
}

export default function Competitors() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const storeName = location.state?.storeName

  const [competitors, setCompetitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // 選択中の店舗の競合店一覧をSupabaseから取得する
  const fetchCompetitors = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('competitors')
      .select('*')
      .eq('store_name', storeName)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setCompetitors(data)
    }
    setLoading(false)
  }, [storeName])

  useEffect(() => {
    if (storeName) {
      fetchCompetitors()
    }
  }, [storeName, fetchCompetitors])

  // 店舗選択画面を経由していない場合は店舗選択画面に戻す
  if (!storeName) {
    return <Navigate to="/stores" replace />
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  // 新規登録・編集フォームの送信処理（INSERT / UPDATE）
  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    const payload = {
      store_name: storeName,
      competitor_name: form.competitor_name,
      address: form.address,
      flyer_url: form.flyer_url,
      product_name: form.product_name,
      origin_or_maker: form.origin_or_maker,
      price: form.price === '' ? null : Number(form.price),
    }

    const { error } = editingId
      ? await supabase.from('competitors').update(payload).eq('id', editingId)
      : await supabase.from('competitors').insert(payload)

    if (error) {
      setErrorMessage(error.message)
    } else {
      resetForm()
      await fetchCompetitors()
    }
    setSubmitting(false)
  }

  // 一覧の「編集」ボタン押下時にフォームへ値を反映する
  const handleEdit = (competitor) => {
    setEditingId(competitor.id)
    setForm({
      competitor_name: competitor.competitor_name ?? '',
      address: competitor.address ?? '',
      flyer_url: competitor.flyer_url ?? '',
      product_name: competitor.product_name ?? '',
      origin_or_maker: competitor.origin_or_maker ?? '',
      price: competitor.price ?? '',
    })
  }

  // 一覧の「削除」ボタン押下時の削除処理（DELETE）
  const handleDelete = async (id) => {
    const confirmed = window.confirm('この競合店情報を削除しますか？')
    if (!confirmed) return

    setErrorMessage('')
    const { error } = await supabase.from('competitors').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      if (editingId === id) resetForm()
      await fetchCompetitors()
    }
  }

  return (
    <div className="competitors-page">
      <header className="store-header">
        <span>
          {storeName} / {user?.email}
        </span>
        <button type="button" onClick={signOut}>
          ログアウト
        </button>
      </header>

      <h1>競合店チラシ一覧</h1>

      {errorMessage && <p className="auth-error">{errorMessage}</p>}

      <form className="competitor-form" onSubmit={handleSubmit}>
        <h2>{editingId ? '競合店情報の編集' : '競合店の新規登録'}</h2>

        <label htmlFor="competitor_name">競合店名</label>
        <input
          id="competitor_name"
          name="competitor_name"
          value={form.competitor_name}
          onChange={handleChange}
          required
        />

        <label htmlFor="address">住所</label>
        <input
          id="address"
          name="address"
          value={form.address}
          onChange={handleChange}
        />

        <label htmlFor="flyer_url">チラシ掲載URL</label>
        <input
          id="flyer_url"
          name="flyer_url"
          type="url"
          value={form.flyer_url}
          onChange={handleChange}
        />

        <label htmlFor="product_name">商品名</label>
        <input
          id="product_name"
          name="product_name"
          value={form.product_name}
          onChange={handleChange}
        />

        <label htmlFor="origin_or_maker">産地名もしくはメーカー名</label>
        <input
          id="origin_or_maker"
          name="origin_or_maker"
          value={form.origin_or_maker}
          onChange={handleChange}
        />

        <label htmlFor="price">価格（本体価格）</label>
        <input
          id="price"
          name="price"
          type="number"
          min="0"
          step="1"
          value={form.price}
          onChange={handleChange}
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
              <th>競合店名</th>
              <th>住所</th>
              <th>チラシURL</th>
              <th>商品名</th>
              <th>産地/メーカー</th>
              <th>価格</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map((competitor) => (
              <tr key={competitor.id}>
                <td>{competitor.competitor_name}</td>
                <td>{competitor.address}</td>
                <td>
                  {competitor.flyer_url && (
                    <a
                      href={competitor.flyer_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      リンク
                    </a>
                  )}
                </td>
                <td>{competitor.product_name}</td>
                <td>{competitor.origin_or_maker}</td>
                <td>
                  {competitor.price !== null ? `${competitor.price}円` : ''}
                </td>
                <td className="competitor-table-actions">
                  <button type="button" onClick={() => handleEdit(competitor)}>
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(competitor.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {competitors.length === 0 && (
              <tr>
                <td colSpan={7}>登録されている競合店情報はありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
