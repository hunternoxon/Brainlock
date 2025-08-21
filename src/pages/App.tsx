import React from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import DatasetTrickLab from '@/features/dataset/DatasetTrickLab'
import SkateSession from '@/features/skate/SkateSession'

function Nav(){
  const link = 'px-3 py-2 rounded-xl border border-zinc-800 hover:border-zinc-600'
  const active = 'bg-zinc-100 text-black border-zinc-100'
  return (
    <nav className="flex items-center justify-between p-4 border-b border-zinc-900 bg-black sticky top-0 z-10">
      <div className="text-xl font-extrabold">Brainlock</div>
      <div className="flex gap-2">
        <NavLink to="/skate" className={({isActive}) => isActive ? `${link} ${active}` : link}>SKATE</NavLink>
        <NavLink to="/tricks" className={({isActive}) => isActive ? `${link} ${active}` : link}>Tricks</NavLink>
      </div>
    </nav>
  )
}

export default function App(){
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Nav />
      <Routes>
        <Route path="/" element={<SkateSession />} />
        <Route path="/skate" element={<SkateSession />} />
        <Route path="/tricks" element={<DatasetTrickLab />} />
      </Routes>
    </div>
  )
}
