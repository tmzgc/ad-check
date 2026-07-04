// 買い物袋＋虫眼鏡のかわいいマスコットイラスト（装飾用のSVG）
export default function MascotIllustration({ size = 140, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 背景の丸 */}
      <circle cx="120" cy="120" r="110" fill="#FFE7EF" />

      {/* 飾りの花（ピンク） */}
      <g>
        <circle cx="40" cy="58" r="7" fill="#FFC9DE" />
        <circle cx="29" cy="49" r="7" fill="#FFC9DE" />
        <circle cx="51" cy="49" r="7" fill="#FFC9DE" />
        <circle cx="29" cy="67" r="7" fill="#FFC9DE" />
        <circle cx="51" cy="67" r="7" fill="#FFC9DE" />
        <circle cx="40" cy="58" r="5" fill="#FFB74D" />
      </g>

      {/* 飾りの花（グリーン） */}
      <g>
        <circle cx="202" cy="188" r="6" fill="#C8F4D8" />
        <circle cx="193" cy="180" r="6" fill="#C8F4D8" />
        <circle cx="211" cy="180" r="6" fill="#C8F4D8" />
        <circle cx="193" cy="196" r="6" fill="#C8F4D8" />
        <circle cx="211" cy="196" r="6" fill="#C8F4D8" />
        <circle cx="202" cy="188" r="4" fill="#66BB6A" />
      </g>

      {/* 買い物バッグの持ち手 */}
      <path
        d="M95 110 C95 80 145 80 145 110"
        stroke="#E3A867"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* 買い物バッグ本体 */}
      <path
        d="M70 110 H170 L160 195 C160 205 150 210 140 210 H100 C90 210 80 205 80 195 Z"
        fill="#FBD8A6"
        stroke="#EAB876"
        strokeWidth="4"
      />

      {/* バッグの折り返し */}
      <path d="M70 110 H170 L166 130 H74 Z" fill="#F6C583" />

      {/* 顔:目 */}
      <circle cx="105" cy="160" r="6" fill="#5B4636" />
      <circle cx="135" cy="160" r="6" fill="#5B4636" />

      {/* ほっぺ */}
      <circle cx="95" cy="172" r="7" fill="#FFAFC0" opacity="0.8" />
      <circle cx="145" cy="172" r="7" fill="#FFAFC0" opacity="0.8" />

      {/* 口 */}
      <path
        d="M110 175 Q120 185 130 175"
        stroke="#5B4636"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {/* 虫眼鏡（チラシをチェックするイメージ） */}
      <circle
        cx="185"
        cy="95"
        r="22"
        fill="#FFF7EC"
        stroke="#F4A6C6"
        strokeWidth="6"
      />
      <line
        x1="201"
        y1="111"
        x2="218"
        y2="128"
        stroke="#F4A6C6"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  )
}
