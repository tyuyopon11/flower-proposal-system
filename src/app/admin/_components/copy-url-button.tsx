"use client"

import { useState } from "react"

type CopyUrlButtonProps = {
  url: string
}

export default function CopyUrlButton({ url }: CopyUrlButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert("URLのコピーに失敗しました")
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-800"
    >
      {copied ? "コピー済み" : "URLコピー"}
    </button>
  )
}