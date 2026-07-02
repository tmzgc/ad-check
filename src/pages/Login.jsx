import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// ログイン・会員登録を行う画面（未ログイン時のみ表示）
export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // すでにログイン済みの場合は店舗選択画面へ遷移する
  if (session) {
    return <Navigate to="/stores" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setInfoMessage('')
    setSubmitting(true)

    const { error } =
      mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password)

    if (error) {
      setErrorMessage(error.message)
    } else if (mode === 'signup') {
      setInfoMessage('確認メールを送信しました。メール内のリンクから認証してください。')
    }

    setSubmitting(false)
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>競合店チラシチェック</h1>
        <h2>{mode === 'signin' ? 'ログイン' : '会員登録'}</h2>

        <label htmlFor="email">メールアドレス</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />

        {errorMessage && <p className="auth-error">{errorMessage}</p>}
        {infoMessage && <p className="auth-info">{infoMessage}</p>}

        <button type="submit" disabled={submitting}>
          {mode === 'signin' ? 'ログイン' : '会員登録'}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setErrorMessage('')
            setInfoMessage('')
          }}
        >
          {mode === 'signin'
            ? 'アカウントをお持ちでない方はこちら'
            : 'すでにアカウントをお持ちの方はこちら'}
        </button>
      </form>
    </div>
  )
}
