import React from 'react'
import { Link } from 'react-router-dom'

function Brand({ homeLink = true }) {
  const mark = <img className="nyx-brand-mark" src="/icons/nyx-192.png" alt="" />

  return (
    <header className="nyx-brand">
      {homeLink ? (
        <Link className="nyx-brand-home" to="/" aria-label="Open Nyx home">
          {mark}
        </Link>
      ) : mark}
      <span>Nyx</span>
    </header>
  )
}

export default Brand
