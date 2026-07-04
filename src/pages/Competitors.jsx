import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// 登録店（店名・住所・チラシ掲載URL）フォームの初期値
const EMPTY_STORE_FORM = {
  competitor_name: '',
  address: '',
  flyer_url: '',
}

// 商品価格情報フォームの初期値
const EMPTY_PRODUCT_FORM = {
  competitor_id: '',
  product_name: '',
  origin_or_maker: '',
  price: '',
}

export default function Competitors() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const storeName = location.state?.storeName

  const [competitors, setCompetitors] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [storeForm, setStoreForm] = useState(EMPTY_STORE_FORM)
  const [editingStoreId, setEditingStoreId] = useState(null)
  const [storeSubmitting, setStoreSubmitting] = useState(false)

  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM)
  const [editingProductId, setEditingProductId] = useState(null)
  const [productSubmitting, setProductSubmitting] = useState(false)

  const [ocrFile, setOcrFile] = useState(null)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrCandidates, setOcrCandidates] = useState([])
  const [ocrImagePath, setOcrImagePath] = useState(null)

  // 選択中の店舗の登録店一覧をSupabaseから取得する
  const fetchCompetitors = useCallback(async () => {
    const { data, error } = await supabase
      .from('competitors')
      .select('*')
      .eq('store_name', storeName)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      return []
    }
    setCompetitors(data)
    return data
  }, [storeName])

  // 登録店に紐づく商品価格情報をSupabaseから取得する
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('competitor_products')
      .select('*, competitors!inner(competitor_name, store_name)')
      .eq('competitors.store_name', storeName)
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      return
    }
    setProducts(data)
  }, [storeName])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    await Promise.all([fetchCompetitors(), fetchProducts()])
    setLoading(false)
  }, [fetchCompetitors, fetchProducts])

  useEffect(() => {
    if (storeName) {
      fetchAll()
    }
  }, [storeName, fetchAll])

  // 商品名ごとにグルーピングした一覧（完成形は複数登録店の同じ商品を横並びで比較できるイメージ）
  const groupedProducts = useMemo(() => {
    const groups = new Map()
    for (const product of products) {
      const key = product.product_name || '（商品名未設定）'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(product)
    }
    return Array.from(groups.entries())
  }, [products])

  // 店舗選択画面を経由していない場合は店舗選択画面に戻す
  if (!storeName) {
    return <Navigate to="/stores" replace />
  }

  const handleStoreChange = (event) => {
    const { name, value } = event.target
    setStoreForm((prev) => ({ ...prev, [name]: value }))
  }

  const resetStoreForm = () => {
    setStoreForm(EMPTY_STORE_FORM)
    setEditingStoreId(null)
  }

  const handleProductChange = (event) => {
    const { name, value } = event.target
    setProductForm((prev) => ({ ...prev, [name]: value }))
  }

  const resetProductForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM)
    setEditingProductId(null)
    setOcrFile(null)
    setOcrCandidates([])
    setOcrImagePath(null)
  }

  // 登録店の新規登録・編集の送信処理（INSERT / UPDATE）
  const handleStoreSubmit = async (event) => {
    event.preventDefault()
    setStoreSubmitting(true)
    setErrorMessage('')

    const payload = {
      store_name: storeName,
      competitor_name: storeForm.competitor_name,
      address: storeForm.address,
      flyer_url: storeForm.flyer_url,
    }

    const { error } = editingStoreId
      ? await supabase.from('competitors').update(payload).eq('id', editingStoreId)
      : await supabase.from('competitors').insert(payload)

    if (error) {
      setErrorMessage(error.message)
    } else {
      resetStoreForm()
      await fetchAll()
    }
    setStoreSubmitting(false)
  }

  const handleStoreEdit = (competitor) => {
    setEditingStoreId(competitor.id)
    setStoreForm({
      competitor_name: competitor.competitor_name ?? '',
      address: competitor.address ?? '',
      flyer_url: competitor.flyer_url ?? '',
    })
  }

  // 登録店の削除（紐づく商品価格情報も連動して削除される）
  const handleStoreDelete = async (id) => {
    const confirmed = window.confirm(
      'この登録店を削除しますか？紐づく商品価格情報もすべて削除されます。',
    )
    if (!confirmed) return

    setErrorMessage('')
    const { error } = await supabase.from('competitors').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      if (editingStoreId === id) resetStoreForm()
      await fetchAll()
    }
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

  // OCR候補の選択で商品フォームへ自動入力する（登録店は別途選択する）
  const handleApplyCandidate = (candidate) => {
    setProductForm((prev) => ({
      ...prev,
      product_name: candidate.product_name,
      origin_or_maker: candidate.origin_or_maker,
      price: candidate.price,
    }))
  }

  // 商品価格情報の新規登録・編集の送信処理（INSERT / UPDATE）
  const handleProductSubmit = async (event) => {
    event.preventDefault()
    setProductSubmitting(true)
    setErrorMessage('')

    const payload = {
      competitor_id: productForm.competitor_id,
      product_name: productForm.product_name,
      origin_or_maker: productForm.origin_or_maker,
      price: productForm.price === '' ? null : Number(productForm.price),
      flyer_image_path: ocrImagePath,
    }

    const { error } = editingProductId
      ? await supabase
          .from('competitor_products')
          .update(payload)
          .eq('id', editingProductId)
      : await supabase.from('competitor_products').insert(payload)

    if (error) {
      setErrorMessage(error.message)
    } else {
      resetProductForm()
      await fetchProducts()
    }
    setProductSubmitting(false)
  }

  const handleProductEdit = (product) => {
    setEditingProductId(product.id)
    setProductForm({
      competitor_id: product.competitor_id,
      product_name: product.product_name ?? '',
      origin_or_maker: product.origin_or_maker ?? '',
      price: product.price ?? '',
    })
    setOcrCandidates([])
    setOcrFile(null)
  }

  const handleProductDelete = async (id) => {
    const confirmed = window.confirm('この商品価格情報を削除しますか？')
    if (!confirmed) return

    setErrorMessage('')
    const { error } = await supabase
      .from('competitor_products')
      .delete()
      .eq('id', id)

    if (error) {
      setErrorMessage(error.message)
    } else {
      if (editingProductId === id) resetProductForm()
      await fetchProducts()
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

      {/* 登録店（店名・住所・チラシ掲載URL）の登録エリア */}
      <form className="competitor-form" onSubmit={handleStoreSubmit}>
        <h2>{editingStoreId ? '登録店情報の編集' : '登録店の新規登録'}</h2>

        <label htmlFor="competitor_name">登録店名</label>
        <input
          id="competitor_name"
          name="competitor_name"
          value={storeForm.competitor_name}
          onChange={handleStoreChange}
          required
        />

        <label htmlFor="address">住所</label>
        <input
          id="address"
          name="address"
          value={storeForm.address}
          onChange={handleStoreChange}
        />

        <label htmlFor="flyer_url">チラシ掲載URL</label>
        <input
          id="flyer_url"
          name="flyer_url"
          type="url"
          value={storeForm.flyer_url}
          onChange={handleStoreChange}
        />

        <div className="competitor-form-actions">
          <button type="submit" disabled={storeSubmitting}>
            {editingStoreId ? '更新する' : '登録する'}
          </button>
          {editingStoreId && (
            <button
              type="button"
              className="link-button"
              onClick={resetStoreForm}
            >
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
                <td className="competitor-table-actions">
                  <button
                    type="button"
                    onClick={() => handleStoreEdit(competitor)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStoreDelete(competitor.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {competitors.length === 0 && (
              <tr>
                <td colSpan={4}>登録店の情報はまだありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* 商品価格情報の登録エリア（将来的にはOCRで自動入力する想定） */}
      <div className="ocr-panel">
        <h2>商品価格を登録する</h2>

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
            {ocrRunning ? '読み取り中...' : 'チラシ画像から読み取る'}
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

        <form className="competitor-form" onSubmit={handleProductSubmit}>
          <h2>{editingProductId ? '商品価格情報の編集' : '商品価格の新規登録'}</h2>

          <label htmlFor="competitor_id">登録店</label>
          <select
            id="competitor_id"
            name="competitor_id"
            value={productForm.competitor_id}
            onChange={handleProductChange}
            required
          >
            <option value="" disabled>
              登録店を選択
            </option>
            {competitors.map((competitor) => (
              <option key={competitor.id} value={competitor.id}>
                {competitor.competitor_name}
              </option>
            ))}
          </select>

          <label htmlFor="product_name">商品名</label>
          <input
            id="product_name"
            name="product_name"
            value={productForm.product_name}
            onChange={handleProductChange}
            required
          />

          <label htmlFor="origin_or_maker">産地名もしくはメーカー名</label>
          <input
            id="origin_or_maker"
            name="origin_or_maker"
            value={productForm.origin_or_maker}
            onChange={handleProductChange}
          />

          <label htmlFor="price">価格（本体価格）</label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            step="1"
            value={productForm.price}
            onChange={handleProductChange}
          />

          <div className="competitor-form-actions">
            <button type="submit" disabled={productSubmitting}>
              {editingProductId ? '更新する' : '登録する'}
            </button>
            {editingProductId && (
              <button
                type="button"
                className="link-button"
                onClick={resetProductForm}
              >
                編集をキャンセル
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 商品名ごとにグルーピングした価格一覧（複数登録店の同一商品を比較するイメージ） */}
      {!loading &&
        groupedProducts.map(([productName, entries]) => (
          <div key={productName} className="product-group">
            <h3>{productName}</h3>
            <table className="competitor-table">
              <thead>
                <tr>
                  <th>登録店名</th>
                  <th>産地/メーカー</th>
                  <th>価格</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((product) => (
                  <tr key={product.id}>
                    <td>{product.competitors?.competitor_name}</td>
                    <td>{product.origin_or_maker}</td>
                    <td>{product.price !== null ? `${product.price}円` : ''}</td>
                    <td className="competitor-table-actions">
                      <button
                        type="button"
                        onClick={() => handleProductEdit(product)}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProductDelete(product.id)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {!loading && groupedProducts.length === 0 && (
        <p>商品価格の情報はまだありません。</p>
      )}
    </div>
  )
}
