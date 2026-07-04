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
  const [ocrFile, setOcrFile] = useState(null)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrCandidates, setOcrCandidates] = useState([])
  const [ocrImagePath, setOcrImagePath] = useState(null)

  // 選択中の店舗の登録店一覧をSupabaseから取得する
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
    setOcrFile(null)
    setOcrCandidates([])
    setOcrImagePath(null)
  }

  // チラシ画像をStorageにアップロードし、Edge Function経由でOCRを実行する
  const handleOcrRun = async () => {
    if (!ocrFile) return
    setOcrRunning(true)
    setErrorMessage('')
    setOcrCandidates([])

    const path = `${storeName}/${Date.now()}-${ocrFile.name}`
    const { error: uploadError } = await supabase.storage
      .from('flyer-images')
      .upload(path, ocrFile)

    if (uploadError) {
      setErrorMessage(uploadError.message)
      setOcrRunning(false)
      return
    }

    setOcrImagePath(path)

    const { data, error } = await supabase.functions.invoke('ocr-flyer', {
      body: { path },
    })

    if (error) {
      setErrorMessage(error.message)
    } else if (data.candidates.length === 0) {
      setErrorMessage('画像から商品情報を読み取れませんでした。手動で入力してください。')
    } else {
      setOcrCandidates(data.candidates)
    }

    setOcrRunning(false)
  }

  // OCR候補の選択でフォームへ自動入力する
  const handleApplyCandidate = (candidate) => {
    setForm((prev) => ({
      ...prev,
      product_name: candidate.product_name,
      origin_or_maker: candidate.origin_or_maker,
      price: candidate.price,
    }))
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
      flyer_image_path: ocrImagePath,
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
    const confirmed = window.confirm('この登録店情報を削除しますか？')
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

      <h1>登録店チラシ一覧</h1>

      {errorMessage && <p className="auth-error">{errorMessage}</p>}

      <div className="ocr-panel">
        <h2>チラシ画像から読み取る</h2>
        <div className="ocr-panel-controls">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setOcrFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={handleOcrRun}
            disabled={!ocrFile || ocrRunning}
          >
            {ocrRunning ? '読み取り中...' : '画像から読み取る'}
          </button>
        </div>

        {ocrCandidates.length > 0 && (
          <ul className="ocr-candidate-list">
            {ocrCandidates.map((candidate, index) => (
              <li key={index}>
                <span>
                  {candidate.origin_or_maker} {candidate.product_name}{' '}
                  {candidate.price}円
                </span>
                <button
                  type="button"
                  onClick={() => handleApplyCandidate(candidate)}
                >
                  この内容を使う
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="competitor-form" onSubmit={handleSubmit}>
        <h2>{editingId ? '登録店情報の編集' : '登録店の新規登録'}</h2>

        <label htmlFor="competitor_name">登録店名</label>
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
              <th>登録店名</th>
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
                <td colSpan={7}>登録店の情報はまだありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
